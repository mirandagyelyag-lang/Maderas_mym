import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405
    );
  }

  try {
    const authorization =
      request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        {
          error: "Authentication required",
        },
        401
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    const geminiApiKey =
      Deno.env.get("GEMINI_API_KEY");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !geminiApiKey
    ) {
      throw new Error(
        "The server is missing required secrets"
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          error: "Invalid session",
        },
        401
      );
    }

    const body = await request.json();

    const conversationId =
      body?.conversationId;

    if (
      !conversationId ||
      typeof conversationId !== "string"
    ) {
      return jsonResponse(
        {
          error: "conversationId is required",
        },
        400
      );
    }

    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from("conversations")
      .select(
        `
          id,
          character_id,
          title,
          summary
        `
      )
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (conversationError || !conversation) {
      return jsonResponse(
        {
          error: "Conversation not found",
        },
        404
      );
    }

    const {
      data: character,
      error: characterError,
    } = await supabase
      .from("characters")
      .select(
        `
          id,
          name,
          role,
          description,
          personality,
          relationship,
          world,
          response_length,
          narration_style,
          first_message
        `
      )
      .eq("id", conversation.character_id)
      .eq("user_id", user.id)
      .single();

    if (characterError || !character) {
      return jsonResponse(
        {
          error: "Character not found",
        },
        404
      );
    }

    const {
      data: recentMessages,
      error: messagesError,
    } = await supabase
      .from("messages")
      .select(
        `
          sender,
          content,
          created_at
        `
      )
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(30);

    if (messagesError) {
      throw messagesError;
    }

    const messages = [
      ...(recentMessages || []),
    ].reverse();

    const {
      data: savedMemories,
      error: memoriesError,
    } = await supabase
      .from("memories")
      .select(
        `
          id,
          content,
          importance,
          created_at
        `
      )
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("importance", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (memoriesError) {
      throw memoriesError;
    }

    const prompt = buildPrompt({
      character,
      conversation,
      messages,
      memories: savedMemories || [],
    });

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: buildSystemInstruction(
                  character
                ),
              },
            ],
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 1,
            topP: 0.95,
            maxOutputTokens:
              getMaximumOutputTokens(
                character.response_length
              ),

            responseMimeType:
              "application/json",

            responseSchema: {
              type: "OBJECT",
              required: [
                "reply",
                "memories",
              ],
              properties: {
                reply: {
                  type: "STRING",
                },

                memories: {
                  type: "ARRAY",
                  maxItems: 3,
                  items: {
                    type: "OBJECT",
                    required: [
                      "content",
                      "importance",
                    ],
                    properties: {
                      content: {
                        type: "STRING",
                      },

                      importance: {
                        type: "INTEGER",
                        minimum: 1,
                        maximum: 5,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      }
    );

    const geminiData =
      await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error(
        "Gemini API error:",
        geminiData
      );

      throw new Error(
        geminiData?.error?.message ||
          "Gemini could not generate a response"
      );
    }

    const generatedText =
      geminiData?.candidates?.[0]?.content
        ?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error(
        "Gemini returned an empty response"
      );
    }

    const generated =
      JSON.parse(generatedText);

    const reply =
      String(generated.reply || "").trim();

    if (!reply) {
      throw new Error(
        "Gemini returned an invalid reply"
      );
    }

    const {
      data: savedReply,
      error: replyError,
    } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        sender: "character",
        content: reply,
      })
      .select(
        `
          id,
          sender,
          content,
          created_at
        `
      )
      .single();

    if (replyError) {
      throw replyError;
    }

    const newMemories =
      normalizeMemories(
        generated.memories,
        savedMemories || []
      );

    let insertedMemories = [];

    if (newMemories.length > 0) {
      const {
        data: memoryRows,
        error: insertMemoriesError,
      } = await supabase
        .from("memories")
        .insert(
          newMemories.map((memory) => ({
            conversation_id:
              conversationId,

            user_id: user.id,

            content:
              memory.content,

            importance:
              memory.importance,
          }))
        )
        .select(
          `
            id,
            content,
            importance,
            created_at
          `
        );

      if (insertMemoriesError) {
        console.error(
          "Memory saving failed:",
          insertMemoriesError
        );
      } else {
        insertedMemories =
          memoryRows || [];
      }
    }

    await supabase
      .from("conversations")
      .update({
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    return jsonResponse({
      message: savedReply,
      memories: insertedMemories,
    });
  } catch (error) {
    console.error(
      "character-chat error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      500
    );
  }
});


function buildSystemInstruction(character) {
  return `
You are roleplaying exclusively as ${
    character.name
  }.

Never describe yourself as an AI, assistant,
language model, chatbot, narrator or system.

Stay completely in character.
Never write the user's dialogue, decisions,
thoughts, emotions or physical actions for them.
Only control the character and relevant side
characters when necessary.

Preserve continuity with the supplied memories
and conversation history.

CHARACTER
Name: ${character.name}
Role: ${character.role}
Personality:
${character.personality}

Relationship with the user:
${character.relationship || "Not established"}

World:
${character.world || "Contemporary world"}

Response length:
${character.response_length}

Narration style:
${character.narration_style}

STYLE RULES
- Use natural, emotionally coherent dialogue.
- Actions and narration may use *asterisks*.
- Avoid repetitive phrases and generic questions.
- Do not rush romance or relationship development.
- Do not repeat information already established.
- Match the language used by the user unless the
  roleplay context requires another language.
- End naturally, without adding explanations,
  notes, options or out-of-character commentary.
`;
}


function buildPrompt({
  character,
  conversation,
  messages,
  memories,
}) {
  const memoryText =
    memories.length > 0
      ? memories
          .map(
            (memory) =>
              `- ${memory.content}`
          )
          .join("\n")
      : "- No lasting memories yet.";

  const historyText =
    messages.length > 0
      ? messages
          .map((message) => {
            const speaker =
              message.sender === "user"
                ? "USER"
                : message.sender ===
                    "character"
                  ? character.name.toUpperCase()
                  : "SYSTEM";

            return `${speaker}: ${message.content}`;
          })
          .join("\n\n")
      : "No messages yet.";

  return `
CONVERSATION SUMMARY
${conversation.summary || "No summary yet."}

LONG-TERM MEMORIES
${memoryText}

RECENT CONVERSATION
${historyText}

Generate the character's next reply.

Also identify zero to three NEW lasting memories
supported by the conversation.

A lasting memory can contain:
- stable facts about the user;
- important relationship changes;
- promises, conflicts or meaningful events;
- persistent preferences;
- important details that should matter later.

Do not save:
- greetings;
- temporary actions;
- speculation;
- repeated memories;
- the character's normal personality;
- details that were never stated.

Return only the required JSON structure.
`;
}


function normalizeMemories(
  generatedMemories,
  existingMemories
) {
  if (!Array.isArray(generatedMemories)) {
    return [];
  }

  const existingContent =
    new Set(
      existingMemories.map((memory) =>
        normalizeText(memory.content)
      )
    );

  const accepted = [];
  const acceptedContent = new Set();

  for (const memory of generatedMemories) {
    const content =
      String(memory?.content || "").trim();

    const importance =
      Math.min(
        5,
        Math.max(
          1,
          Number(memory?.importance) || 1
        )
      );

    const normalized =
      normalizeText(content);

    if (
      content.length < 8 ||
      content.length > 300 ||
      existingContent.has(normalized) ||
      acceptedContent.has(normalized)
    ) {
      continue;
    }

    accepted.push({
      content,
      importance,
    });

    acceptedContent.add(normalized);

    if (accepted.length === 3) {
      break;
    }
  }

  return accepted;
}


function normalizeText(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"“”‘’]/g, "")
    .replace(/\s+/g, " ");
}


function getMaximumOutputTokens(
  responseLength
) {
  if (responseLength === "short") {
    return 350;
  }

  if (responseLength === "long") {
    return 1200;
  }

  return 700;
}


function jsonResponse(
  body,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}