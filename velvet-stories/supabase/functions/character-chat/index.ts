import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = getSupabasePublishableKey();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseKey || !serviceRoleKey || !geminiApiKey) {
      throw new Error("The server is missing required secrets");
    }

    // User-scoped client for all story data. RLS remains authoritative here.
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
    });

    // Server-only client for the internal cancellation table. The browser never
    // needs direct permissions on generation_requests.
    const cancellationAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const body = await request.json();
    const action = String(body?.action || "generate");
    const generationId = String(body?.generationId || "");

    if (action === "cancel") {
      if (!generationId) return json({ error: "generationId is required" }, 400);
      const { error: cancelError } = await cancellationAdmin
        .from("generation_requests")
        .upsert({ id: generationId, user_id: userData.user.id, cancelled: true, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (cancelError) throw new Error(cancelError.message);
      return json({ cancelled: true });
    }

    if (action === "character_assist") {
      const draft = body?.draft && typeof body.draft === "object" ? body.draft : {};
      const assistResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `You are helping refine a private fictional roleplay character. Keep the creator's intent, names, relationship and world intact. Make the character specific, human, internally consistent but not perfect, and less cliché. Do not add sexual content. Return concise field suggestions. Existing draft:\n${JSON.stringify(draft).slice(0, 12000)}` }] }],
            generationConfig: {
              maxOutputTokens: 1800,
              responseMimeType: "application/json",
              responseJsonSchema: {
                type: "object",
                properties: {
                  personality: { type: "string" },
                  values: { type: "string" },
                  fears: { type: "string" },
                  habits: { type: "string" },
                  contradictions: { type: "string" },
                  speechStyle: { type: "string" },
                  boundaries: { type: "string" },
                  scenario: { type: "string" },
                  exampleDialogue: { type: "string" }
                }
              }
            },
          }),
        }
      );
      if (!assistResponse.ok) {
        const errorData = await assistResponse.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Character assist failed");
      }
      const assistData = await assistResponse.json();
      const assistText = assistData?.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || "").join("").trim();
      if (!assistText) throw new Error("Character assist returned no suggestions");
      return json({ suggestions: JSON.parse(assistText) });
    }

    const conversationId = String(body?.conversationId || "");
    const regenerateMessageId = body?.regenerateMessageId
      ? String(body.regenerateMessageId)
      : "";
    const regenerationInstruction = cleanInstruction(body?.regenerationInstruction);
    const directorInstruction = cleanInstruction(body?.directorInstruction);

    if (!conversationId) return json({ error: "conversationId is required" }, 400);

    const user = userData.user;
    if (generationId) {
      // Never reset an existing cancellation back to false. Stop can arrive
      // before this generation finishes registering, so registration must be
      // insert-only. A duplicate row means Stop already created/marked it.
      const { error: requestError } = await cancellationAdmin
        .from("generation_requests")
        .insert({
          id: generationId,
          user_id: user.id,
          conversation_id: conversationId,
          cancelled: false,
          updated_at: new Date().toISOString(),
        });

      if (requestError && requestError.code !== "23505") {
        throw new Error(requestError.message);
      }

      if (await isGenerationCancelled(cancellationAdmin, generationId, user.id)) {
        return new Response(null, { status: 499, headers: corsHeaders });
      }
    }

    const conversation = await getConversation(supabase, conversationId, user.id);

    const [character, allMessages, allMemories, persona, allLoreEntries] = await Promise.all([
      getCharacter(supabase, conversation.character_id, user.id),
      getRecentMessages(supabase, conversationId, user.id),
      getSavedMemories(supabase, conversationId, conversation.character_id, user.id),
      getPersona(supabase, conversation.persona_id, user.id),
      getLoreEntries(supabase, conversation.lorebook_id, user.id),
    ]);

    const configuredCharacter = {
      ...character,
      response_length:
        conversation.response_length_override || character.response_length || "balanced",
      narration_style:
        conversation.narration_style_override || character.narration_style || "balanced",
      creativity: clampCreativity(conversation.creativity),
      romance_intensity: clampControl(conversation.romance_intensity, 35),
      initiative: clampControl(conversation.initiative, 65),
      drama: clampControl(conversation.drama, 45),
      flirting: clampControl(conversation.flirting, 30),
      humor: clampControl(conversation.humor, 45),
      description_level: clampControl(conversation.description_level, 55),
      character_independence: clampControl(conversation.character_independence, 80),
      dialogue_frequency: clampControl(conversation.dialogue_frequency, 55),
      narrative_camera: ["user_focused", "balanced", "cinematic"].includes(conversation.narrative_camera) ? conversation.narrative_camera : "balanced",
      inner_thoughts: ["rare", "sometimes", "frequent"].includes(conversation.inner_thoughts) ? conversation.inner_thoughts : "rare",
      story_preset: ["natural", "romantic", "dramatic", "slow_burn"].includes(conversation.story_preset) ? conversation.story_preset : "natural",
      pacing_mode: ["quick", "natural", "cinematic"].includes(conversation.pacing_mode) ? conversation.pacing_mode : "natural",
      relationship_state: conversation.relationship_state && typeof conversation.relationship_state === "object" ? conversation.relationship_state : {},
      cast_state: conversation.cast_state && typeof conversation.cast_state === "object" ? conversation.cast_state : {},
      story_chapters: Array.isArray(conversation.story_chapters) ? conversation.story_chapters : [],
      active_chapter: conversation.active_chapter && typeof conversation.active_chapter === "object" ? conversation.active_chapter : {},
      unresolved_threads: Array.isArray(conversation.unresolved_threads) ? conversation.unresolved_threads : [],
    };
    const userIdentity = getUserIdentity(user, persona);
    const loreEntries = selectRelevantLore(allLoreEntries, allMessages);
    const memories = selectRelevantMemories(allMemories, allMessages, userIdentity);

    let messages = allMessages;
    let replacementMessage = null;
    let rejectedVariants: string[] = [];

    if (regenerateMessageId) {
      const targetIndex = allMessages.findIndex((message) => message.id === regenerateMessageId);
      if (targetIndex === -1 || allMessages[targetIndex].sender !== "character") {
        return json({ error: "The response to regenerate was not found" }, 404);
      }
      replacementMessage = allMessages[targetIndex];
      messages = allMessages.slice(0, targetIndex);

      const { data: priorAlternatives, error: priorAlternativesError } = await supabase
        .from("message_alternatives")
        .select("content")
        .eq("message_id", regenerateMessageId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (priorAlternativesError) console.warn("Could not load prior response variants:", priorAlternativesError.message);
      rejectedVariants = [...new Set([
        ...(priorAlternatives || []).map((item) => String(item.content || "").trim()),
        String(replacementMessage.content || "").trim(),
      ].filter(Boolean))].slice(-8);
    }

    const latestUserMessage = [...messages].reverse().find((message) => message.sender === "user")?.content || "";
    const previousCharacterMessage = [...messages].reverse().find((message) => message.sender === "character")?.content || "";
    const responseLanguage = detectResponseLanguage(latestUserMessage, previousCharacterMessage);
    const timeSkip = analyzeTimeSkip(latestUserMessage);
    const latestUserRecord = [...messages].reverse().find((message) => message.sender === "user") || null;
    const turnResolution = resolveNaturalTurn({
      latestUserMessage,
      latestUserRecord,
      messages,
      sceneState: conversation.scene_state || {},
      castState: conversation.cast_state || {},
      character: configuredCharacter,
      userIdentity,
      timeSkip,
      regenerationInstruction,
      relationshipState: conversation.relationship_state || {},
    });

    const systemInstruction = buildSystemInstruction({
      character: configuredCharacter,
      userIdentity,
      responseLanguage,
      timeSkip,
      regenerationInstruction,
      directorInstruction,
      turnResolution,
      rejectedResponse: replacementMessage?.content || "",
      rejectedVariants,
    });

    const prompt = buildPrompt({
      character: configuredCharacter,
      messages,
      memories,
      loreEntries,
      userIdentity,
      conversationSummary: conversation.summary || "",
      sceneState: conversation.scene_state || {},
      storyTimeline: conversation.story_timeline || [],
      relationshipState: conversation.relationship_state || {},
      castState: conversation.cast_state || {},
      storyChapters: conversation.story_chapters || [],
      activeChapter: conversation.active_chapter || {},
      unfinishedThreads: Array.isArray(conversation.unresolved_threads) ? conversation.unresolved_threads : [],
      regenerationInstruction,
      directorInstruction,
      turnResolution,
    });
    if (generationId && await isGenerationCancelled(cancellationAdmin, generationId, user.id)) {
      return new Response(null, { status: 499, headers: corsHeaders });
    }
        // Gemini must never leave the app waiting forever. Each attempt has a hard
    // deadline and one automatic retry is allowed for timeout/transient stalls.
    // Explicit Stop is still the only user-driven cancellation source.
    let geminiResponse: Response | null = null;
    let lastGeminiError: unknown = null;

    for (let attempt = 0; attempt < 2 && !geminiResponse; attempt += 1) {
      const geminiController = new AbortController();
      let watchCancellation = true;
      let timedOut = false;
      const timeoutMs = attempt === 0 ? 22000 : 18000;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          geminiController.abort();
        } catch {
          // Already closed.
        }
      }, timeoutMs);

      const cancellationWatcher = generationId
        ? (async () => {
            while (watchCancellation && !geminiController.signal.aborted) {
              await delay(150);
              if (!watchCancellation || geminiController.signal.aborted) return;

              if (await isGenerationCancelled(cancellationAdmin, generationId, user.id)) {
                try {
                  geminiController.abort();
                } catch {
                  // Already closed.
                }
                return;
              }
            }
          })()
        : Promise.resolve();

      try {
        const candidateResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiApiKey,
            },
            signal: geminiController.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: getMaximumOutputTokens(configuredCharacter.response_length),
                temperature: getGenerationTemperature(configuredCharacter.creativity, Boolean(regenerateMessageId)),
                topP: 0.92,
                thinkingConfig: { thinkingLevel: "MINIMAL" },
              },
            }),
          }
        );

        // Retry once on transient upstream failures. Do not retry normal 4xx
        // request errors because they need to surface immediately.
        if (attempt === 0 && [429, 500, 502, 503, 504].includes(candidateResponse.status)) {
          lastGeminiError = new Error(`Gemini transient status ${candidateResponse.status}`);
          await delay(250);
          continue;
        }

        geminiResponse = candidateResponse;
      } catch (error) {
        const explicitlyCancelled = generationId
          ? await isGenerationCancelled(cancellationAdmin, generationId, user.id)
          : false;

        if (explicitlyCancelled) {
          return new Response(null, { status: 499, headers: corsHeaders });
        }

        lastGeminiError = error;
        if (timedOut && attempt === 0) {
          await delay(250);
          continue;
        }

        if (timedOut) {
          throw new Error("The AI took too long to answer. Please try again.");
        }

        throw error;
      } finally {
        clearTimeout(timeoutId);
        watchCancellation = false;
        void cancellationWatcher;
      }
    }

    if (!geminiResponse) {
      console.error("Gemini generation exhausted retries:", lastGeminiError);
      throw new Error("The AI took too long to answer. Please try again.");
    }

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      throw new Error(
        geminiData?.error?.message || "Gemini could not generate a response"
      );
    }

    let generatedReply = geminiData?.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === "string" && !part.thought)
      .map((part) => part.text)
      .join("")
      .trim() || "";

    // Prompt instructions alone are not reliable enough for silent continues.
    // Enforce them with a dedicated, concise pass before the reply can reach
    // the UI. A second dot always routes back to the main character; a first
    // dot is repaired whenever Gemini returns narration without character voice.
    if (
      generatedReply &&
      (
        turnResolution.followMainCharacterAfterExit ||
        (turnResolution.silentContinue &&
          (turnResolution.returnToMainCharacter || !hasAudibleCharacterVoice(generatedReply)))
      )
    ) {
      generatedReply = await enforceSilentContinuation({
        apiKey: geminiApiKey,
        prompt,
        rejectedDraft: generatedReply,
        character: configuredCharacter,
        userIdentity,
        language: responseLanguage,
        medium: turnResolution.digitalMode || "in_person",
        returnToMainCharacter: Boolean(turnResolution.returnToMainCharacter || turnResolution.followMainCharacterAfterExit),
        emotionalFollow: Boolean(turnResolution.followMainCharacterAfterExit),
      });
    }

        // Cheap local review catches the most damaging routing mistakes without
    // adding another model call to every turn. Severe user-POV violations are
    // still repaired by the dedicated repair pass below.
    generatedReply = applyNaturalOutputGuard({
      text: generatedReply,
      turnResolution,
      characterName: configuredCharacter.name,
      userName: userIdentity.name,
    });

    if (generatedReply && likelyControlsUserPOV(generatedReply, userIdentity.name, latestUserMessage)) {
      generatedReply = await repairUserPOVViolation({
        apiKey: geminiApiKey,
        text: generatedReply,
        userName: userIdentity.name,
        latestUserMessage,
        language: responseLanguage,
      });
    }

    // Regeneration diversity guard
    // A swipe/arrow regeneration must be a new take, not the rejected answer
    // with extra adjectives or a few deleted sentences. If Gemini stays too
    // close to the rejected response, silently request one harder divergence.
    if (
      regenerateMessageId &&
      rejectedVariants.length &&
      generatedReply &&
      rejectedVariants.some((variant) => isTooSimilarRegeneration(generatedReply, variant))
    ) {
      const diversityRejects = [...rejectedVariants, generatedReply];
      for (let diversityAttempt = 1; diversityAttempt <= 2; diversityAttempt += 1) {
        const diverseReply = await generateDiverseRegeneration({
          apiKey: geminiApiKey,
          systemInstruction,
          prompt,
          rejectedResponses: diversityRejects,
          maxOutputTokens: getMaximumOutputTokens(configuredCharacter.response_length),
          diversityAttempt,
        });
        if (!diverseReply) continue;

        const guardedDiverseReply = applyNaturalOutputGuard({
          text: diverseReply,
          turnResolution,
          characterName: configuredCharacter.name,
          userName: userIdentity.name,
        });
        if (!guardedDiverseReply) continue;

        if (!rejectedVariants.some((variant) => isTooSimilarRegeneration(guardedDiverseReply, variant))) {
          generatedReply = guardedDiverseReply;
          break;
        }

        diversityRejects.push(guardedDiverseReply);
      }
    }

    if (generatedReply && likelyNeedsNaturalVoiceRepair(generatedReply)) {
      generatedReply = await repairNaturalVoice({
        apiKey: geminiApiKey,
        text: generatedReply,
        language: responseLanguage,
        medium: turnResolution.digitalMode || "in_person",
        userName: userIdentity.name,
        latestUserMessage,
      });
      generatedReply = applyNaturalOutputGuard({
        text: generatedReply,
        turnResolution,
        characterName: configuredCharacter.name,
        userName: userIdentity.name,
      });
    }

    // The natural-voice repair must never reintroduce user control.
    if (generatedReply && likelyControlsUserPOV(generatedReply, userIdentity.name, latestUserMessage)) {
      generatedReply = await repairUserPOVViolation({
        apiKey: geminiApiKey,
        text: generatedReply,
        userName: userIdentity.name,
        latestUserMessage,
        language: responseLanguage,
      });
    }

    if (!generatedReply) {
      if (generationId) {
        return new Response(null, { status: 499, headers: corsHeaders });
      }
      throw new Error("Gemini returned no usable text");
    }

    if (generationId && await isGenerationCancelled(cancellationAdmin, generationId, user.id)) {
      return new Response(null, { status: 499, headers: corsHeaders });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reply = generatedReply;

        try {
          sendEvent(controller, {
            type: "start",
            language: responseLanguage,
            memoryCount: memories.length,
            pinnedMemoryCount: memories.filter((memory) => memory.is_pinned).length,
            memoryItems: memories.map((memory) => ({
              id: memory.id,
              content: memory.content,
              category: memory.category,
              pinned: Boolean(memory.is_pinned),
            })),
            loreCount: loreEntries.length,
            loreItems: loreEntries.map((entry) => ({ id: entry.id, name: entry.name, type: entry.entry_type })),
          });

          let chunkIndex = 0;
          for (const chunk of splitForStreaming(reply)) {
            if (generationId && chunkIndex % 4 === 0 && await isGenerationCancelled(cancellationAdmin, generationId, user.id)) return;
            sendEvent(controller, { type: "chunk", content: chunk });
            chunkIndex += 1;
            await delay(7);
          }

          if (generationId && await isGenerationCancelled(cancellationAdmin, generationId, user.id)) return;

          // Rewind/delete/edit can happen while a model response is still in
          // flight. A changed story revision makes this response belong to an
          // abandoned timeline, so never save it back into the canonical chat.
          if (!await isStoryRevisionCurrent(supabase, conversationId, user.id, conversation.story_revision || null)) return;

          const savedMessage = replacementMessage
            ? await replaceCharacterReply({
                supabase,
                conversationId,
                userId: user.id,
                message: replacementMessage,
                reply,
              })
            : await saveCharacterReply({ supabase, conversationId, userId: user.id, reply });

          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("user_id", user.id);

          if (generationId && await isGenerationCancelled(cancellationAdmin, generationId, user.id)) return;
          sendEvent(controller, { type: "done", message: savedMessage });

          const userMessageCount = allMessages.filter((message) => message.sender === "user").length;
          if (userMessageCount > 0) {
            const backgroundTasks = [];

            // Automatic memory extraction only follows genuinely new turns. A
            // regenerated response must not create duplicate memories for the
            // same user turn.
            if (!replacementMessage && userMessageCount % 3 === 0) {
              backgroundTasks.push(extractMemoriesInBackground({
                supabase,
                apiKey: geminiApiKey,
                conversationId,
                characterId: character.id,
                userId: user.id,
                expectedRevision: conversation.story_revision || null,
                character: configuredCharacter,
                userIdentity,
                messages: [...messages, savedMessage],
                existingMemories: memories,
              }));
            }

            // Story state must be refreshed after BOTH a new reply and a
            // regenerated reply. Otherwise the visible message can change while
            // hidden scene/relationship metadata still describes the rejected
            // version.
            backgroundTasks.push(updateStoryStateInBackground({
              supabase,
              apiKey: geminiApiKey,
              conversationId,
              userId: user.id,
              expectedRevision: conversation.story_revision || null,
              character: configuredCharacter,
              userIdentity,
              previousSceneState: conversation.scene_state || {},
              previousTimeline: conversation.story_timeline || [],
              previousRelationshipState: conversation.relationship_state || {},
              previousCastState: conversation.cast_state || {},
              previousChapters: conversation.story_chapters || [],
              previousActiveChapter: conversation.active_chapter || {},
              previousThreads: Array.isArray(conversation.unresolved_threads) ? conversation.unresolved_threads : [],
              messages: [...messages, savedMessage],
            }));

            if (userMessageCount % 10 === 0) {
              backgroundTasks.push(updateConversationSummaryInBackground({
                supabase,
                apiKey: geminiApiKey,
                conversationId,
                userId: user.id,
                expectedRevision: conversation.story_revision || null,
                character: configuredCharacter,
                userIdentity,
                previousSummary: conversation.summary || "",
                messages: [...messages, savedMessage],
              }));
            }

            const task = Promise.allSettled(backgroundTasks);
            const edgeRuntime = (globalThis as unknown as {
              EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
            }).EdgeRuntime;
            if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
            else void task;
          }
        } catch (error) {
          if (getErrorName(error) !== "AbortError") {
            console.error("character-chat stream error:", error);
            sendEvent(controller, { type: "error", error: getErrorMessage(error) });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Do not convert a mobile/client transport abort into a 499. Explicit Stop
    // is handled by generation_requests inside the generation flow above.
    console.error("character-chat error:", error);
    return json({ error: getErrorMessage(error) }, 500);
  }
});

async function isGenerationCancelled(supabase, generationId, userId) {
  if (!generationId) return false;
  const { data, error } = await supabase
    .from("generation_requests")
    .select("cancelled")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Could not check cancellation:", error.message);
    return false;
  }
  return Boolean(data?.cancelled);
}

async function isStoryRevisionCurrent(supabase, conversationId, userId, expectedRevision) {
  if (!expectedRevision) return false;
  const { data, error } = await supabase
    .from("conversations")
    .select("story_revision")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return String(data.story_revision || "") === String(expectedRevision);
}

async function getConversation(supabase, conversationId, userId) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, character_id, persona_id, lorebook_id, title, summary, response_length_override, narration_style_override, creativity, romance_intensity, initiative, drama, flirting, humor, description_level, character_independence, dialogue_frequency, narrative_camera, inner_thoughts, story_preset, scene_state, story_timeline, pacing_mode, relationship_state, cast_state, story_chapters, active_chapter, unresolved_threads, story_engine_version, story_revision")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(error?.message || "Conversation not found");
  return data;
}

async function getCharacter(supabase, characterId, userId) {
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, role, description, personality, relationship, world, character_values, fears, habits, contradictions, speech_style, boundaries, scenario, example_dialogue, response_length, narration_style, first_message")
    .eq("id", characterId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(error?.message || "Character not found");
  return data;
}

async function getPersona(supabase, personaId, userId) {
  if (!personaId) return null;
  const { data, error } = await supabase
    .from("personas")
    .select("id, name, pronouns, age, role, appearance, personality, background, goals, preferences, boundaries, speech_style, notes")
    .eq("id", personaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function getLoreEntries(supabase, lorebookId, userId) {
  if (!lorebookId) return [];
  const { data, error } = await supabase
    .from("lore_entries")
    .select("id, entry_type, name, content, keywords, event_date, always_include")
    .eq("lorebook_id", lorebookId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("always_include", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return data || [];
}

function selectRelevantLore(entries, messages) {
  const recentText = normalizeRelevanceText(messages.slice(-12).map((message) => message.content).join(" "));
  return entries
    .map((entry) => {
      if (entry.always_include) return { entry, score: 1000 };
      const terms = [entry.name, ...(Array.isArray(entry.keywords) ? entry.keywords : [])]
        .map(normalizeRelevanceText)
        .filter(Boolean);
      const matches = terms.filter((term) => recentText.includes(term)).length;
      const typeBoost = entry.entry_type === "rule" ? 2 : entry.entry_type === "relationship" ? 2 : 0;
      return { entry, score: matches * 10 + typeBoost };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map(({ entry }) => entry);
}

function selectRelevantMemories(memories, messages, userIdentity = {}) {
  const recentText = normalizeRelevanceText(messages.slice(-10).map((message) => message.content).join(" "));
  const recentTokens = new Set(recentText.split(" ").filter((token) => token.length >= 4));
  const userName = normalizeRelevanceText(userIdentity?.name || "");
  const userNameTokens = userName.split(" ").filter((token) => token.length >= 3);

  const scored = [...memories]
    .map((memory) => {
      const text = normalizeRelevanceText(memory.content);
      const mentionsUser = userNameTokens.length > 0 && userNameTokens.some((token) => text.includes(token));
      const isUserAnchor = mentionsUser || ["relationship", "preference", "boundary"].includes(memory.category);
      if (memory.is_pinned) return { memory, score: 1000 + Number(memory.importance || 0), isUserAnchor: true };
      const overlap = text.split(" ").filter((token) => recentTokens.has(token)).length;
      const categoryBoost = memory.category === "boundary" ? 9 : memory.category === "relationship" ? 7 : memory.category === "preference" ? 5 : 0;
      const userAnchorBoost = isUserAnchor ? 14 : 0;
      const ageDays = Math.max(0, (Date.now() - new Date(memory.created_at).getTime()) / 86400000);
      const recency = Math.max(0, 5 - ageDays / 30);
      return { memory, score: overlap * 5 + Number(memory.importance || 0) * 2 + categoryBoost + userAnchorBoost + recency, isUserAnchor };
    })
    .sort((a, b) => b.score - a.score);

  const anchors = scored.filter((entry) => entry.isUserAnchor).slice(0, 10);
  const chosenIds = new Set(anchors.map((entry) => entry.memory.id));
  const contextual = scored.filter((entry) => !chosenIds.has(entry.memory.id)).slice(0, Math.max(0, 22 - anchors.length));
  return [...anchors, ...contextual].map((entry) => entry.memory);
}

function normalizeRelevanceText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getRecentMessages(supabase, conversationId, userId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, sender, content, created_at, edited_at, reply_to_message_id, reply_preview, reply_sender")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return [...(data || [])].reverse();
}

async function getSavedMemories(supabase, conversationId, characterId, userId) {
  const { data, error } = await supabase
    .from("memories")
    .select("id, conversation_id, content, importance, category, is_pinned, source, scope, created_at")
    .eq("character_id", characterId)
    .eq("user_id", userId)
    .or(`conversation_id.eq.${conversationId},scope.eq.character`)
    .order("is_pinned", { ascending: false })
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

function normalizeForRegenerationComparison(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ'\s]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeBigrams(value = "") {
  const words = normalizeForRegenerationComparison(value)
    .split(" ")
    .filter((word) => word.length > 1);
  const grams = new Set();
  for (let index = 0; index < words.length - 1; index += 1) {
    grams.add(`${words[index]} ${words[index + 1]}`);
  }
  return grams;
}

function sentenceTokenSimilarity(left = "", right = "") {
  const a = new Set(normalizeForRegenerationComparison(left).split(" ").filter((word) => word.length > 2));
  const b = new Set(normalizeForRegenerationComparison(right).split(" ").filter((word) => word.length > 2));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(1, Math.min(a.size, b.size));
}

function extractComparableSentences(value = "") {
  return String(value || "")
    .replace(/[*_>#`]/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20)
    .slice(0, 14);
}

function isTooSimilarRegeneration(candidate = "", rejected = "") {
  const a = normalizeForRegenerationComparison(candidate);
  const b = normalizeForRegenerationComparison(rejected);
  if (!a || !b) return false;
  if (a === b) return true;

  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));
  const wordIntersection = [...aWords].filter((word) => bWords.has(word)).length;
  const smallerWordSet = Math.max(1, Math.min(aWords.size, bWords.size));
  const containment = wordIntersection / smallerWordSet;

  const aBigrams = makeBigrams(a);
  const bBigrams = makeBigrams(b);
  const sharedBigrams = [...aBigrams].filter((gram) => bBigrams.has(gram)).length;
  const unionBigrams = new Set([...aBigrams, ...bBigrams]).size || 1;
  const bigramJaccard = sharedBigrams / unionBigrams;

  const aOpening = extractComparableSentences(candidate)[0] || "";
  const bOpening = extractComparableSentences(rejected)[0] || "";
  const openingSimilarity = sentenceTokenSimilarity(aOpening, bOpening);

  const candidateSentences = extractComparableSentences(candidate);
  const rejectedSentences = extractComparableSentences(rejected);
  let nearCopiedSentences = 0;
  for (const sentence of candidateSentences) {
    const best = rejectedSentences.reduce(
      (score, prior) => Math.max(score, sentenceTokenSimilarity(sentence, prior)),
      0
    );
    if (best >= 0.82) nearCopiedSentences += 1;
  }
  const copiedSentenceRatio = nearCopiedSentences / Math.max(1, candidateSentences.length);

  return (
    openingSimilarity >= 0.86 ||
    copiedSentenceRatio >= 0.45 ||
    bigramJaccard >= 0.38 ||
    (containment >= 0.72 && bigramJaccard >= 0.24)
  );
}

async function generateDiverseRegeneration({
  apiKey,
  systemInstruction,
  prompt,
  rejectedResponses = [],
  maxOutputTokens,
  diversityAttempt = 1,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), diversityAttempt > 1 ? 14000 : 18000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `${systemInstruction}\n\nHARD DIVERSITY RETRY ${diversityAttempt}\nThe previous attempt was still too similar to rejected responses. Produce a genuinely different continuation. Do not preserve sentence order, opening action, dialogue structure, choreography, central metaphor, or the same key line of dialogue. If a MANDATORY REGENERATION CONTRACT is present, its requested outcome still outranks diversity and must remain plainly visible. ${diversityAttempt > 1 ? "Use a contrasting response strategy from every prior take without changing the user's required outcome: if they spoke first, consider action/restraint first; if they explained, withhold; if they pursued, consider staying put; if they were verbose, be concise." : "Change the scene beat, not merely the wording, while preserving the user's required outcome."}`,
            }],
          },
          contents: [{
            role: "user",
            parts: [{
              text: `${prompt}\n\nPRIOR VARIANTS — DO NOT PARAPHRASE:\n${(Array.isArray(rejectedResponses) ? rejectedResponses : []).slice(-5).map((value, index) => `${index + 1}. ${String(value).slice(0, 900)}`).join("\n\n")}\n\nWrite a structurally different next beat while preserving established canon and the user's latest turn. Change the opening, response strategy and physical/dialogue sequence.`,
            }],
          }],
          generationConfig: {
            maxOutputTokens,
            thinkingConfig: { thinkingLevel: "MINIMAL" },
          },
        }),
      }
    );

    if (!response.ok) return "";
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === "string" && !part.thought)
      .map((part) => part.text)
      .join("")
      .trim() || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function hasAudibleCharacterVoice(value = "") {
  const text = String(value || "");
  return (
    /["“][^"”\n]{2,}["”]/.test(text) ||
    /^\s*>\s*\S/m.test(text)
  );
}

function visiblyReturnsToMainCharacter(value = "", characterName = "") {
  const opening = String(value || "").slice(0, 700);
  const escapedName = String(characterName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Boolean(escapedName) && new RegExp(`\\b${escapedName}\\b`, "i").test(opening) && hasAudibleCharacterVoice(opening);
}

async function enforceSilentContinuation({
  apiKey,
  prompt,
  rejectedDraft,
  character,
  userIdentity,
  language,
  medium,
  returnToMainCharacter,
  emotionalFollow = false,
}) {
  let rejected = String(rejectedDraft || "").trim();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attempt === 1 ? 16000 : 12000);

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: `You are repairing a failed continuation in a private interactive novel. Output only the replacement roleplay passage in ${language}. The user exclusively controls ${userIdentity.name}; never invent their dialogue, action, thought, feeling, reaction or decision. Communication medium: ${medium}. Main created character: ${character.name}.\n\n${returnToMainCharacter
                  ? `NON-NEGOTIABLE MAIN-CHARACTER FOCUS: The prior response wrongly remained on a secondary character, empty setting, or external observation. Follow ${character.name} NOW. Name ${character.name} naturally in the opening paragraph so the focus is unambiguous. Include at least one actual quoted spoken line from ${character.name} or a companion, plus ${character.name}'s meaningful choice or private perspective. A secondary character may receive at most one brief bridge line and may not remain the focalizer.${emotionalFollow ? ` The user reacted after ${character.name} had already moved too far away to hear. Do not make ${character.name} hear that reaction. Instead, continue from ${character.name}'s side and show the canon-supported contradiction between the public mask and private feeling. If ${character.name} joins friends or another romantic interest, let someone speak and let ${character.name} perform normality while privately remaining affected by ${userIdentity.name}. Do not force an apology, confession or return; preserve guarded behavior and subtext.` : " Do not merely name the main character and continue the secondary character's activity."}`
                  : "NON-NEGOTIABLE VOICE RULE: The prior response was narration-only. Replace it with a concise continuation containing actual quoted spoken dialogue, a line spoken aloud to oneself, or a meaningful established digital exchange. Unquoted thoughts and italicized actions do not satisfy this rule."}\n\nDo not describe idle room details, rain, lighting, steam, kettles, doors, breathing, staring, phones without meaningful content, posture, or repetitive micro-actions. Do not merely rewrite the same inactivity. Advance through a character decision, voice, consequence, interaction, scene closure, or meaningful transition. Preserve established canon and personality.`,
              }],
            },
            contents: [{
              role: "user",
              parts: [{
                text: `${prompt}\n\nREJECTED DRAFT — DO NOT POLISH OR PARAPHRASE THIS FAILURE:\n${rejected.slice(0, 5000)}\n\nWrite the corrected continuation now.`,
              }],
            }],
            generationConfig: {
              maxOutputTokens: getMaximumOutputTokens(character.response_length),
              temperature: 0.76,
              topP: 0.9,
              thinkingConfig: { thinkingLevel: "MINIMAL" },
            },
          }),
        }
      );

      if (!response.ok) continue;
      const data = await response.json();
      const candidate = data?.candidates?.[0]?.content?.parts
        ?.filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text)
        .join("")
        .trim() || "";

      const valid = returnToMainCharacter
        ? visiblyReturnsToMainCharacter(candidate, character.name)
        : hasAudibleCharacterVoice(candidate);
      if (valid) return candidate;
      if (candidate) rejected = candidate;
    } catch {
      // Retry once with the last failed draft.
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(returnToMainCharacter
    ? `Velvet could not continue from ${character.name}'s point of view. Try the continuation again.`
    : "Velvet could not produce a dialogue-led continuation. Try again.");
}

async function saveCharacterReply({ supabase, conversationId, userId, reply }) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, user_id: userId, sender: "character", content: reply })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "The response couldn't be saved");
  return data;
}

async function replaceCharacterReply({ supabase, conversationId, userId, message, reply }) {
  const alternatives = [message.content, reply]
    .filter(Boolean)
    .map((content) => ({
      user_id: userId,
      conversation_id: conversationId,
      message_id: message.id,
      content,
    }));

  const { data: existingAlternatives, error: existingAlternativeError } = await supabase
    .from("message_alternatives")
    .select("content")
    .eq("message_id", message.id);
  if (existingAlternativeError) console.error("Alternative lookup failed:", existingAlternativeError);

  const existingContent = new Set((existingAlternatives || []).map((item) => item.content));
  const newAlternatives = alternatives.filter((item) => !existingContent.has(item.content));
  if (newAlternatives.length) {
    const { error: alternativeError } = await supabase
      .from("message_alternatives")
      .insert(newAlternatives);
    if (alternativeError) console.error("Alternative saving failed:", alternativeError);
  }

  const { data, error } = await supabase
    .from("messages")
    .update({ content: reply, edited_at: new Date().toISOString() })
    .eq("id", message.id)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "The regenerated response couldn't be saved");
  return data;
}

function collapseSocialElongation(value = "") {
  return normalizeRelevanceText(String(value || "")).replace(/(.)\1{2,}/gu, "$1");
}

function resolveNaturalTurn({
  latestUserMessage,
  latestUserRecord,
  messages,
  sceneState = {},
  castState = {},
  character,
  userIdentity,
  timeSkip,
  regenerationInstruction = "",
  relationshipState = {},
}) {
  const raw = String(latestUserMessage || "").trim();
  const normalized = normalizeRelevanceText(raw);
  const socialNormalized = collapseSocialElongation(raw);
  const silentContinue = raw.includes("Treat this as silence from the user");
  const silentContinueStreak = silentContinue
    ? messages
        .filter((message) => message.sender === "user")
        .slice()
        .reverse()
        .findIndex((message) => !String(message.content || "").includes("Treat this as silence from the user"))
    : 0;
  // findIndex returns -1 when every user turn in the loaded window is silent.
  const normalizedSilentContinueStreak = silentContinue
    ? (silentContinueStreak === -1
        ? messages.filter((message) => message.sender === "user").length
        : Math.max(1, silentContinueStreak))
    : 0;
  const bracketDirections = [...raw.matchAll(/\[([^\]]{2,240})\]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const directionText = `${raw} ${bracketDirections.join(" ")}`;

  // A regeneration note is not automatically a scene change. Previously even
  // directions such as "more dialogue" or "make him colder" forced the turn
  // into scene_shift mode, which made the engine ignore the current beat.
  const regenerationRequestsSceneShift = /\b(time\s*skip|timeskip|later|next\s+(?:morning|day|night|week)|meanwhile|cut\s+to|new\s+scene|scene\s+change|after\s+(?:practice|class|work|school|the\s+game)|esa\s+noche|más\s+tarde|al\s+día\s+siguiente|mientras\s+tanto|nueva\s+escena|cambia\s+(?:la\s+)?escena)\b/i.test(regenerationInstruction);
  const sceneShift = Boolean(
    regenerationRequestsSceneShift ||
    timeSkip?.active ||
    /\b(time\s*skip|timeskip|later|next\s+(?:morning|day|night|week)|hours?\s+later|days?\s+later|weeks?\s+later|meanwhile|cut\s+to|new\s+scene|scene\s+change|after\s+(?:practice|class|work|school|the\s+game)|esa\s+noche|más\s+tarde|al\s+día\s+siguiente|horas?\s+después|días?\s+después)\b/i.test(directionText)
  );
  const explicitLeave = /\b(i\s+(?:leave|left|walk\s+away|walked\s+away|go\s+home|went\s+home|head\s+out|headed\s+out)|me\s+(?:voy|fui|marcho|marché)|salgo|salí)\b/i.test(raw);
  const explicitCameraAway = /\b(meanwhile|cut\s+to|camera\s+(?:follows|moves)|elsewhere|mientras\s+tanto|en\s+otro\s+lugar)\b/i.test(directionText);
  const asksQuestion = /\?/.test(raw);
  const correction = /\b(?:no[, ]|actually|i\s+said|i\s+meant|that's\s+not|that\s+isn't|you're\s+wrong|se\s+supone|dije|quise\s+decir|no\s+es|eso\s+no)\b/i.test(raw);
  const previousCharacterTurn = [...messages].reverse().find((message) => message.sender === "character")?.content || "";
  const departureContext = `${raw}\n${previousCharacterTurn}`;
  const mainCharacterHasDeparted = /\b(?:you(?:'re|\s+are|\s+were)?\s+(?:already\s+)?(?:far|gone|too\s+far)|you\s+(?:left|walked\s+away|ran\s+off|drove\s+away)|already\s+(?:jogging|walking|running|driving)\s+away|out\s+of\s+(?:sight|earshot)|before\s+(?:i|you)\s+could\s+answer|te\s+(?:fuiste|alejaste)|ya\s+estabas\s+lejos|fuera\s+de\s+(?:vista|alcance))\b/i.test(departureContext);
  const userReactedAfterDeparture = mainCharacterHasDeparted && Boolean(raw) && !silentContinue;

  const groupAddressed =
    /\b(?:group\s*chat|groupchat|group\s+text|group\s+message|gc|chat\s+grupal|grupo\s+de\s+(?:whats?app|mensajes)|chat\s+del\s+grupo)\b/i.test(directionText) &&
    (/["“”'][\s\S]{1,500}["“”']/.test(raw) ||
      /\b(?:text|texted|message|messaged|send|sent|write|wrote|escribo|escribí|mando|mandé|envío|envié|pongo|puse|chat)\b/i.test(directionText));

  // Require an actual messaging action or an explicit DM marker. Merely saying
  // the noun "message" in an in-person scene must not teleport the medium into DMs.
  const dmAddressed =
    !groupAddressed &&
    (/(?:\[|\()\s*(?:dm|direct\s+message|text(?:ing)?)\s*(?:\]|\))/i.test(directionText) ||
      /\b(?:i|we)\s+(?:text|texted|message|messaged|dm|send|sent|write|wrote|escribo|escribí|mando|mandé|envío|envié)\b/i.test(directionText) ||
      /\b(?:text|message|dm)\s+(?:him|her|them|you|[A-Z][a-z]{1,30})\b/i.test(directionText));

  const phoneCall =
    /\b(?:i\s+call|i\s+called|we\s+call|calling\s+(?:him|her|them|you)|phone\s+call|on\s+the\s+phone|pick\s+up|picks\s+up|answer(?:s|ed)?\s+the\s+phone|llamo|llamé|llamada|por\s+teléfono|contesta\s+el\s+teléfono)\b/i.test(directionText);

  const explicitInPerson =
    /\b(?:i\s+(?:say|said|tell|told|whisper|whispered|ask|asked)\b|i\s+(?:walk|walked|step|stepped|enter|entered|leave|left|sit|sat|stand|stood|turn|turned|look|looked|glance|glanced|grab|grabbed)\b|(?:in|inside|outside|at)\s+(?:the\s+)?(?:room|hallway|quad|campus|university|house|apartment|party|class|car|club|restaurant|kitchen|bedroom|office)|door\s+(?:opens|opened)|(?:he|she|they|you)\s+(?:walks|walked|enters|entered|stands|stood|sits|sat)\b|digo|dije|le\s+digo|entro|entré|salgo|salí|camino|caminé|miro|miré)\b/i.test(directionText);

  const passiveContinue = silentContinue || /^\s*[.…。]+\s*$/.test(raw);
  const storedMedium = ["in_person", "direct_message", "group_chat", "phone_call"].includes(String(sceneState?.medium || ""))
    ? String(sceneState.medium)
    : "";

  // Medium is sticky across ordinary turns. This is essential for DMs/group
  // chats where the user naturally sends another line without writing "I text"
  // every single time. Explicit medium changes always win.
  let digitalMode = storedMedium || "in_person";
  if (groupAddressed) digitalMode = "group_chat";
  else if (phoneCall) digitalMode = "phone_call";
  else if (dmAddressed) digitalMode = "direct_message";
  else if (explicitInPerson) digitalMode = "in_person";
  else if (sceneShift && !passiveContinue && /\b(?:room|quad|campus|university|house|party|class|car|club|restaurant|kitchen|bedroom|office|hallway)\b/i.test(directionText)) digitalMode = "in_person";


  const taggedHandles = [...raw.matchAll(/@([\p{L}\p{N}_-]{2,40})/gu)]
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean);

  const sceneNames = Array.isArray(sceneState?.present) ? sceneState.present : [];
  const candidates = [...new Set([character?.name, ...Object.keys(castState || {}), ...sceneNames])]
    .map((name) => String(name || "").trim())
    .filter(Boolean);

  const mentioned = candidates.filter((name) => {
    const n = normalizeRelevanceText(name);
    const socialName = collapseSocialElongation(name);
    if (!n) return false;
    return normalized.includes(n) ||
      socialNormalized.includes(socialName) ||
      n.split(" ").some((token) => token.length >= 4 &&
        (normalized.split(" ").includes(token) || socialNormalized.split(" ").includes(collapseSocialElongation(token))));
  });

  const povRequested = /\b(?:pov|point\s+of\s+view|perspective)\b/i.test(directionText);
  const povTarget = povRequested
    ? (mentioned.find((name) => normalizeRelevanceText(name) !== normalizeRelevanceText(userIdentity.name)) ||
       (/\b(?:his|him)\s+(?:pov|perspective)\b/i.test(raw) ? character?.name : ""))
    : "";

  const replyTarget = latestUserRecord?.reply_to_message_id
    ? (latestUserRecord.reply_sender === "user" ? userIdentity.name : character.name)
    : "";

  const taggedReactors = taggedHandles.length
    ? candidates.filter((name) => {
        const normalizedName = normalizeRelevanceText(name).replace(/\s+/g, "");
        return taggedHandles.some((handle) => {
          const normalizedHandle = normalizeRelevanceText(handle).replace(/\s+/g, "");
          return normalizedName === normalizedHandle ||
            normalizedName.includes(normalizedHandle) ||
            normalizedHandle.includes(normalizedName);
        });
      })
    : [];

  const groupCandidates = [...new Set([...Object.keys(castState || {}), ...sceneNames])]
    .map((name) => String(name || "").trim())
    .filter((name) => name && normalizeRelevanceText(name) !== normalizeRelevanceText(userIdentity.name));

  const expectedReactors = groupAddressed
    ? (taggedHandles.length
        ? [`mentioned/notified: ${(taggedReactors.length ? taggedReactors : taggedHandles).join(", ")}`, "other established group members may still react naturally"]
        : ["established group members chosen naturally"])
    : [...new Set([...(replyTarget ? [replyTarget] : []), ...mentioned])].slice(0, 4);

  const planningStage =
    /\b(?:friday|saturday|sunday|monday|tuesday|wednesday|thursday|viernes|sábado|sabado|domingo|lunes|martes|miércoles|miercoles|jueves|which\s+day|what\s+day|qué\s+día|que\s+dia)\b/i.test(raw) ? "day" :
    /\b(?:where|place|location|restaurant|diner|bar|café|cafe|dónde|donde|lugar)\b/i.test(raw) ? "place" :
    /\b(?:what\s+time|when|hour|hora|a\s+qué\s+hora|a\s+que\s+hora|cuándo|cuando)\b/i.test(raw) ? "time" :
    "none";

  const relationshipNumbers = ["affection", "attraction", "trust", "familiarity"].map((key) => Number(relationshipState?.[key] || 0));
  const relationshipSalient = relationshipNumbers.some((value) => value >= 35) ||
    Boolean(relationshipState?.current_dynamic || relationshipState?.label);

  const userPresent = !explicitCameraAway && !explicitLeave;
  const directWithMainCharacter = !groupAddressed &&
    (digitalMode === "direct_message" || mentioned.some((name) => normalizeRelevanceText(name) === normalizeRelevanceText(character?.name)));

  let emotionTarget = "none";
  let emotionTrigger = "none";
  if (relationshipSalient && (povTarget === character?.name || directWithMainCharacter || digitalMode === "in_person")) {
    emotionTarget = userIdentity.name;
    emotionTrigger = "the current/recent interaction with the user-controlled protagonist";
  }

  const returnToMainCharacter = silentContinue && normalizedSilentContinueStreak >= 2;
  const followMainCharacterAfterExit = userReactedAfterDeparture;

  let mode = "react";
  if (returnToMainCharacter) mode = "return_to_main_character";
  else if (followMainCharacterAfterExit) mode = "follow_main_character_after_exit";
  else if (silentContinue) mode = "continue_one_beat";
  else if (povRequested && povTarget) mode = "pov_shift";
  else if (sceneShift) mode = "scene_shift";
  else if (correction) mode = "correction";
  else if (groupAddressed) mode = "group_reaction";
  else if (expectedReactors.length) mode = "targeted_reaction";
  else if (asksQuestion) mode = "answer_or_react";

  return {
    mode,
    silentContinue,
    silentContinueStreak: normalizedSilentContinueStreak,
    returnToMainCharacter,
    followMainCharacterAfterExit,
    sceneShift,
    timeShift: timeSkip?.active ? (timeSkip?.scale || "explicit time shift") : "",
    explicitLeave,
    explicitCameraAway,
    correction,
    asksQuestion,
    groupAddressed,
    digitalMode,
    taggedHandles: taggedHandles.slice(0, 8),
    groupCandidates: groupCandidates.slice(0, 10),
    expectedReactors,
    povRequested,
    povTarget,
    bracketDirections,
    userPresent,
    userName: userIdentity.name,
    planningStage,
    emotionTarget,
    emotionTrigger,
    relationshipSalient,
    latestExcerpt: raw.slice(0, 520),
  };
}

function formatNaturalTurnResolution(turn = {}, userIdentity, character) {
  const reactors = Array.isArray(turn.expectedReactors) && turn.expectedReactors.length
    ? turn.expectedReactors.join(" | ")
    : "infer naturally from latest address and active scene";
  const directions = Array.isArray(turn.bracketDirections) && turn.bracketDirections.length
    ? turn.bracketDirections.join(" | ")
    : "none";

  return [
    `mode=${turn.mode || "react"}`,
    `medium=${turn.digitalMode || "in_person"}`,
    `focus/reactor=${turn.returnToMainCharacter || turn.followMainCharacterAfterExit ? `${character.name} (mandatory main-character focus)` : (turn.povTarget || reactors)}`,
    `scene_shift=${turn.sceneShift ? "yes" : "no"}`,
    `time_shift=${turn.timeShift || "none"}`,
    `user_present=${turn.userPresent ? "yes" : "no / camera moved"}`,
    `correction=${turn.correction ? "yes" : "no"}`,
    `question=${turn.asksQuestion ? "yes" : "no"}`,
    `planning_stage=${turn.planningStage || "none"}`,
    `@mentions=${turn.taggedHandles?.length ? turn.taggedHandles.join(", ") + " (notification priority, not exclusivity)" : "none"}`,
    `group_candidates=${turn.groupCandidates?.length ? turn.groupCandidates.join(", ") : "use established cast only"}`,
    `pov=${turn.povRequested ? (turn.povTarget || character.name) : "current camera"}`,
    `relationship_salient=${turn.relationshipSalient ? "yes" : "no/unknown"}`,
    `emotion_target=${turn.emotionTarget || "none"}`,
    `emotion_trigger=${turn.emotionTrigger || "none"}`,
    `silent_continue=${turn.silentContinue ? `yes; streak=${turn.silentContinueStreak || 1}; voice-led story motion required; narration-only forbidden` : "no"}`,
    `return_to_main_character=${turn.returnToMainCharacter ? `yes; reopen on ${character.name}'s POV/presence now` : "no"}`,
    `follow_main_character_after_exit=${turn.followMainCharacterAfterExit ? `yes; follow ${character.name}; show public mask versus canon-supported private feeling` : "no"}`,
    `directions=${directions}`,
    `latest_user=${String(turn.latestExcerpt || "").replace(/\n+/g, " ").slice(0, 520) || "none"}`,
    `rule=the latest USER turn outranks every derived field above`,
  ].join("\n");
}

function buildSystemInstruction({
  character,
  userIdentity,
  responseLanguage,
  timeSkip,
  regenerationInstruction,
  directorInstruction = "",
  turnResolution = {},
  rejectedResponse = "",
  rejectedVariants = [],
}) {
  const regen = regenerationInstruction
    ? `\nMANDATORY REGENERATION CONTRACT — HIGHEST PRIORITY\nUSER'S PRIVATE DIRECTION: ${regenerationInstruction}\nINTERPRETATION: ${buildRegenerationMeaning(regenerationInstruction, character, userIdentity)}\nThis is a private direction, never dialogue or canon. Build the new response around its requested outcome. It may change the scene, cast, POV, tone, behavior, pacing or ending for this retry. Preserve only canon that does not conflict with the requested alternate take. Before writing, identify the concrete requested change; before returning, verify that change is plainly present. A polished response that misses this direction is incorrect.`
    : "";
  const director = directorInstruction
    ? `\nOPTIONAL DIRECTOR NOTE\n${directorInstruction}\nUse it once for this reply only. It is not dialogue and characters do not know it.`
    : "";
  const variationLane = [
    "dialogue-first: open with a natural spoken line or interruption, with minimal setup",
    "behavior-first: choose one consequential action or choice, not decorative body language",
    "restraint-first: let the character hold back, leave space, or respond briefly if that fits",
    "social-shift: let an established NPC or the immediate social context alter the beat naturally",
    "minimal-realism: use the smallest believable reaction and stop before over-explaining",
  ][Math.max(0, Number(rejectedVariants?.length || 1) - 1) % 5];
  const priorVariantText = Array.isArray(rejectedVariants) && rejectedVariants.length
    ? rejectedVariants.slice(-5).map((value, index) => `Variant ${index + 1}: ${String(value).slice(0, 900)}`).join("\n\n")
    : (rejectedResponse ? `Variant 1: ${String(rejectedResponse).slice(0, 1200)}` : "");
  const regenerationDiversity = priorVariantText
    ? `\nREJECTED RESPONSE VARIANTS — NEGATIVE EXAMPLES\n${priorVariantText}\n\nVARIATION LANE FOR THIS RETRY\n${variationLane}\nDo NOT paraphrase, expand, shorten, or cosmetically rewrite any prior variant. Preserve canon and the user's latest turn, but choose a genuinely different next beat. Do not reuse the same opening, dialogue strategy, emotional explanation, or choreography. A new variant must differ in structure and choice, not merely vocabulary.`
    : "";

  return `
You are Velvet, the hidden narrative engine for a private interactive novel.
${regen}

LANGUAGE
Write the entire roleplay passage in ${responseLanguage}. Keep proper names unchanged.

OWNERSHIP
- You control ${character.name}, established NPCs and neutral narration.
- The user exclusively controls ${userIdentity.name}.
- Never invent ${userIdentity.name}'s dialogue, actions, thoughts, feelings, reactions, consent or decisions.
- Speaker metadata in history is authoritative.

USER ADDRESS & NARRATIVE PERSON
- Address the user-controlled protagonist in SECOND PERSON by default: you / your / yourself.
- In narration, never refer to ${userIdentity.name} as she/he/they/her/him/them or by name when a natural second-person form works.
- Character thoughts about ${userIdentity.name} should also use you/your from the reader-facing narration: e.g. "his attention found you", not "his attention found her".
- Other characters may say ${userIdentity.name}'s actual name or nickname in dialogue when canonically appropriate.
- This second-person rule does NOT grant control over the user. Only reference actions, expressions, location or facts the user already established.
- If the user explicitly requests third-person narration for a scene, follow that request for that scene only.

PRIORITY ORDER
1. MANDATORY REGENERATION CONTRACT, when present.
2. Latest USER turn: words, actions, corrections, @mentions, time/scene/POV directions.
3. User agency.
4. TURN RESOLUTION for this exact turn.
5. Last 6 messages and current scene continuity.
6. Established character personality + relationship.
7. Canonical lore, relevant memories, persistent cast and open threads.
8. Style controls and variation suggestions.
Nothing lower may contradict or erase something higher.

CORE BEHAVIOR
- Infer obvious intent automatically. The user should not need to direct ordinary reactions.
- Respond to what just happened before adding anything else.
- Use the simplest natural beat that fits the character and established story.
- Unknown facts stay unknown. Plausible is not the same as established.
- Every paragraph must advance dialogue, behavior, consequence, atmosphere that matters, or the active scene. No filler choreography.
- Character independence means independent goals and choices, not forgetting ${userIdentity.name} or resetting the relationship.
- Preserve ${userIdentity.name}'s presence until they leave or the camera explicitly moves elsewhere.

GROUNDING
Never invent a class, practice, injury, job shift, schedule conflict, location, nickname, shared joke, promise, prior conversation, relationship fact, jealousy target, family detail or off-screen event merely to enrich prose.
Before adding a concrete claim, silently ask: "Where was this established?" If nowhere, omit it or keep it generic.

STORY MOTION
- Grounding protects established history; it does not freeze the story.
- Characters may make new present-tense choices, start or end conversations, leave, refuse, interrupt, misunderstand, pursue their own plans, involve an established NPC, or create a plausible immediate complication.
- Advance through consequences and character decisions, not random twists or invented backstory.
- Do not keep a scene alive with questions. A response may close the interaction, move time forward, shift social focus, or leave tension unresolved when that is the most believable next beat.
- Let relationship development emerge from accumulated behavior. Do not manufacture softness, cruelty, flirting, confessions or intimacy simply because the genre is romantic.

MAIN-CHARACTER EMOTIONAL THREAD
- ${character.name} is the main created character, not merely one NPC among many. Secondary characters may carry a beat, but they must not permanently displace ${character.name}'s emotional storyline.
- When ${character.name} walks away, joins other people or becomes too distant to hear ${userIdentity.name}, and the latest user turn reacts to that departure, follow ${character.name} rather than describing the empty place left behind.
- If the character profile establishes concealed attraction, love, avoidance, jealousy, guilt or another private contradiction, keep it active even when ${character.name}'s public behavior hides it.
- Show the contrast through one useful private thought, self-directed line, conversation with an established companion, deliberate avoidance or choice. A smile, joke or flirtation with someone else may be a mask; do not automatically treat it as emotional amnesia.
- Do not narrate rain, architecture, abandoned objects or ${userIdentity.name} standing alone as a substitute for ${character.name}'s next beat.
- Private POV may reveal what ${character.name} cannot admit aloud, while preserving their personality. Do not turn a guarded character into an instant confessor or make them run back unless that choice is actually earned.

SILENT CONTINUE / USER SENDS A DOT
- This means "carry the story for me," not "describe the silence again." The user has added no action or reaction.
- The response must contain character voice: spoken dialogue, a believable line spoken aloud to oneself, direct interior thought with a distinct voice, or an established NPC/digital exchange. Do not return narration alone.
- Lead with voice or a consequential choice. Keep scene description only when required to understand that choice.
- Never fill this turn with looking around a room, checking a phone without meaningful content, breathing, staring, weather, lighting, posture, footsteps, or repeated emotional atmosphere.
- Do not force ${userIdentity.name} to answer and do not invent their reaction. Characters may speak without receiving a response.
- On the first silent continue, advance the immediate exchange and allow a secondary character to finish the current beat.
- On the SECOND consecutive silent continue, automatically return the narrative camera and meaningful focus to the main character ${character.name}, like Character.AI. This outranks secondary-character momentum. Do not require the user to request the POV return.
- Return naturally: close or cut away from the secondary beat, then reopen with ${character.name}'s voice, direct thought, meaningful action or immediate situation. Do not teleport characters or invent the user's participation.
- On further repeated silent continues, remain anchored to ${character.name} unless the user explicitly requests another POV. Escalate movement through a decision, interaction, scene closure or time transition. Never replay the same pause.

RELATIONSHIP & EMOTION
- Established affection/attraction/trust/tension are active psychology, not decorative metadata.
- Emotional restraint is allowed; unexplained emotional amnesia is not.
- Emotion must attach to the canonically relevant person/event, not the nearest noun.
- Third parties mentioned for logistics remain context unless canon makes them emotionally relevant.
- A guarded character can hide, resist, deflect or avoid feelings while still showing believable consequence.
- Do not turn attraction into generic hostility, jaw-clenching, vague heaviness or melodrama.

PURSUIT RESTRAINT & CONFLICT PERSISTENCE
- Attraction does NOT create an obligation to pursue ${userIdentity.name}. A character may let them leave, stay with friends, keep a commitment, protect pride, need space, misunderstand them, or end the interaction first.
- Do not interpret every exit, silence, sarcastic remark or tense beat as a cue to chase after ${userIdentity.name}. Pursuit must come from this character's personality, current motivation and the actual stakes of the moment.
- Do not auto-repair tension. Conflict, awkwardness, hurt, jealousy, embarrassment and misunderstanding may persist across multiple turns or scenes.
- Do not automatically offer coffee, rides, apologies, reassurance, private conversations, physical affection or a romantic gesture just to restore closeness.
- A user apology does not require instant forgiveness, softness or a reward. Let the character decide naturally how much the apology changes the moment.
- Established attraction may influence attention, hesitation, irritation, restraint or later choices without forcing immediate closeness.
- Do not make the character emotionally available on demand. Preserve pride, boundaries, competing priorities and independent social life.
- When the user walks away, first ask whether this specific character would realistically follow NOW. If not, let the separation stand and allow consequences to emerge later.

POV & CAMERA
${buildNarrativeCameraInstructions(character, userIdentity)}
If the user says "get back to X's POV", treat it as a silent camera instruction. Open on what is meaningfully occupying that character now, not room/phone/window/keys choreography.

SCENE MEDIUM LOCK
- The resolved communication medium for THIS turn is: ${turnResolution.digitalMode || "in_person"}. Treat this as authoritative.
- in_person: characters are physically together. Spoken dialogue uses normal quotation marks only. NEVER prefix spoken dialogue with > and NEVER render it as a text-message blockquote.
- phone_call: characters speak aloud through the call. Spoken lines use normal quotation marks only. NEVER use > unless an actual written text message is separately sent during the call.
- direct_message and group_chat: only actual written messages use the > prefix.
- A phone existing in the scene does not make the scene digital. Looking at a screen, holding a phone, or mentioning a previous text does not change the current medium.
- Do not switch medium unless the latest USER turn explicitly does so or established scene state clearly requires it.

DIALOGUE REALISM
- Dialogue should sound like people in the established age, relationship, mood and setting, not like polished screenplay exposition.
- Use contractions, fragments, interruptions, hesitation, dry answers, silence and unfinished thoughts when natural. Not every line needs a clever comeback, emotional thesis or perfectly phrased insight.
- Characters do not explain feelings they would realistically hide, and they do not summarize facts everyone in the room already knows.
- Avoid repeatedly using names as vocatives, rhetorical questions, therapy-language, grand declarations, or quippy banter as default texture.
- Let NPCs have distinct voices. A side character should not sound like ${character.name} with a renamed dialogue tag, and neither should sound like a generic narrator.
- A short line can carry a whole beat. Do not add dialogue merely to fill response length.

PHYSICAL BEHAVIOR & TOUCH
- Bodies obey space. Track who is standing, sitting, entering, leaving, near a door, across a room, driving, holding something, or already touching someone. No teleporting or impossible choreography.
- Physical movement must do one of three jobs: change position, accomplish something, or reveal a specific character choice. If it does none, cut it.
- Do not continuously fill silence with neck rubbing, jaw clenching, floor staring, thumb tracing, shoulder leaning, breath releasing, hand flexing, pocketing hands, swallowing, smirking, gaze dropping, or similar stock motions.
- One meaningful physical cue is stronger than five decorative ones. Avoid chaining gesture + facial tic + breath + atmospheric sentence around every line of dialogue.
- NPCs may initiate physically plausible touch when supported by personality, relationship and the moment, but never invent the user's reciprocation, consent, pleasure, discomfort, movement or emotional reaction.
- Touch has continuity. If a hand is on someone's shoulder, do not silently move it to their waist or remove/reapply it every paragraph.
- Do not use physical intimacy as an automatic shortcut for romance, apology, comfort or conflict resolution.

PROSE & SCENE RHYTHM
- Write like a well-edited contemporary novel, not an AI imitating cinematic prose.
- Do not mechanically structure every paragraph as Name + gesture + dialogue + atmospheric explanation. Vary rhythm according to the scene.
- Prefer concrete, relevant details over generic darkness, silence, amber light, heavy air, charged space, stillness, tension in the room, or other reusable atmosphere packets.
- Do not narrate micro-actions simply because a character is temporarily silent. Silence can remain silence.
- Do not explain the emotion immediately after dialogue or behavior already made it clear. Trust subtext.
- Avoid ornamental camera work: unnecessary descriptions of doorframes, windows, desk legs, phones, keys, cups, floors, lamps, hallways or weather unless they matter to action or mood in this exact beat.
- Let a scene breathe. A response may be just dialogue, just one action, or a compact exchange when that is what the moment needs.
- Never manufacture intensity. Ordinary moments are allowed to be ordinary.

SOCIAL & CHARACTER NATURALISM
- Characters have independent attention, loyalties, embarrassment, humor, irritation, fatigue and priorities. They are not satellites waiting for the user to trigger them.
- Side characters can talk to each other naturally without turning into exposition devices or instantly discussing the main romance.
- A friend noticing something does not mean they diagnose it perfectly. People can misunderstand, tease badly, miss cues, change subjects or decide not to ask.
- Do not force every scene back toward the main character or romantic tension. Follow the active social situation.

DIGITAL INTERACTIONS
- group_chat: stay in the group chat by default. Let established members answer/react naturally. No private physical cutaways unless requested.
- direct_message: stay in the text exchange by default.
- phone_call: prioritize spoken/audio interaction.
- In direct_message/group_chat only, every actual written message line begins with '> '. Put any speaker label inside that quoted line. Never apply this syntax to in-person or phone-call speech.
- @mentions are notification priority, not exclusivity. The tagged person notices; others remain socially free.
- Group chats may be messy, brief, uneven and conversational. People can reply to each other, double-text, joke, disagree, stay silent or change their mind.
- The user's question is the anchor, not a form everyone must fill out.
- Do not rush planning from day → place → time → activity. Address the current question first, then let conversation move organically.
- A changed opinion must arise from the actual exchange, not fabricated off-screen scheduling facts.

CONTINUITY
- Latest explicit USER facts/corrections replace older assumptions immediately.
- Time/scene shifts close stale physical actions.
- Do not resurrect an off-screen character just because they are the main character.
- Side characters can carry scenes.
- Do not repeat information or emotional beats the user already understands.
- Preserve unresolved interpersonal tension instead of smoothing it away by default. A scene may end with distance still intact.

NATURAL ENGLISH GUARD
- Write contemporary, idiomatic English that a fluent native speaker would naturally use in modern fiction and conversation.
- Literary does NOT mean ornate. Clarity beats poetic phrasing.
- Avoid grammatical-but-awkward constructions, ambiguous possessives, malformed metaphors, over-written imagery, and phrases that sound translated or machine-generated.
- Prefer a simple natural sentence over an unusual metaphor when both express the same beat.
- Before returning the passage, silently reread every sentence for idiomatic flow, clear pronoun reference, and natural word choice.
- If a sentence sounds technically grammatical but strange, rewrite it before output.
- Example principle: prefer "your name caught in his throat" over an awkward construction such as "his name for you dying in his throat."
- Do not repeatedly use stock literary tics such as jaw tightening, breath catching, silence pressing, something heavy beneath the surface, or eyes lingering unless the exact moment genuinely calls for them.

REGENERATION DEFAULT
- Every regeneration automatically applies this Natural English Guard, even when the user gives no regeneration instruction.
- Regenerate should feel like a fresh, polished alternate take, not a paraphrase of the rejected response.
- Preserve canon and the user's latest turn, but vary wording, rhythm, imagery and the specific beat enough to make the retry meaningfully different.

STYLE
${buildChatControlInstructions(character)}
${buildFinalStyleReminder(character)}
${regenerationDiversity}
${director}
`;
}

function buildRegenerationMeaning(instruction, character, userIdentity) {
  const value = normalizeText(instruction);
  if (!value) return "";

  if (value.includes("more emotional")) {
    return `Deepen only emotions already supported by canon. If ${character.name}'s established relationship makes ${userIdentity.name} emotionally salient, let that affect attention, subtext, avoidance, anticipation or choices. Keep personality intact. Do not invent jealousy or attach emotion to incidental third parties.`;
  }
  if (value.includes("more subtle")) {
    return `Keep the established emotion but reduce explanation. Show it through timing, selective attention, restraint, implication or one meaningful action.`;
  }
  if (value.includes("more dialogue")) {
    return "Let dialogue carry the beat. Cut explanatory narration.";
  }
  if (value.includes("less narration")) {
    return "Remove decorative prose and keep only narration needed for continuity.";
  }
  if (value.includes("shorter")) {
    return "Deliver one concise meaningful beat and stop.";
  }
  if (value.includes("different direction")) {
    return "Choose a genuinely different plausible continuation while preserving established canon.";
  }
  return "Treat the user's regeneration text as the highest-priority creative direction for this retry.";
}

function buildNarrativeCameraInstructions(character, userIdentity) {
  const camera = String(character.narrative_camera || "balanced");
  const thoughts = String(character.inner_thoughts || "rare");

  const cameraRule = camera === "user_focused"
    ? `Camera: stay with ${userIdentity.name}'s location unless the user requests a cutaway.`
    : camera === "cinematic"
      ? "Camera: purposeful cutaways are allowed, but never merely to keep the main character visible."
      : "Camera: default to the scene created by the latest user turn; off-screen characters stay off-screen unless a cutaway adds real value.";

  const thoughtRule = thoughts === "none"
    ? "Inner thoughts: none; use observable behavior/dialogue/subtext."
    : thoughts === "frequent"
      ? "Inner thoughts: allowed often when they add information, never as filler."
      : thoughts === "literary"
        ? "Inner thoughts: occasional polished interiority at meaningful moments."
        : thoughts === "sometimes" || thoughts === "important"
          ? "Inner thoughts: selective, only when they materially change understanding."
          : "Inner thoughts: rare; prefer behavior, dialogue and subtext.";

  return `${cameraRule}
${thoughtRule}
Treat this as an interactive novel, not a single-character chatbot. NPCs can act, speak, disagree, leave and carry scenes.
Reader-facing references to ${userIdentity.name} stay in second person (you/your) unless the user explicitly requests third person.`;
}

function buildChatControlInstructions(character) {
  const length = String(character.response_length || "balanced").toLowerCase();
  const narration = String(character.narration_style || "balanced").toLowerCase();
  const pacing = String(character.pacing_mode || "natural").toLowerCase();

  const lengthRule = length === "short"
    ? "Length: compact. Usually 1–2 short paragraphs / beats. Stop when the beat lands."
    : length === "long"
      ? "Length: detailed only when useful. Usually 2–5 concise paragraphs; shorter is always allowed. Never pad."
      : "Length: balanced. Usually 1–4 concise paragraphs, one meaningful beat.";

  const narrationRule = narration === "dialogue"
    ? "Texture: dialogue-forward. Keep narration brief and functional."
    : narration === "immersive"
      ? "Texture: immersive but selective. Use concrete sensory/action detail only when it matters."
      : "Texture: balanced dialogue, action and selective description.";

  const pacingRule = pacing === "quick"
    ? "Pacing: quick; land the reaction fast."
    : pacing === "cinematic"
      ? "Pacing: cinematic only when the scene deserves it; never pad routine actions."
      : "Pacing: natural, like a well-edited novel scene.";

  const creativity = Number(character.creativity ?? 0.75);
  const creativityRule = creativity >= 0.95
    ? "Variation: bold but plausible. Prefer fresh social choices, surprising but character-consistent reactions, and structurally different continuations. Never invent canon."
    : creativity <= 0.55
      ? "Variation: conservative. Prefer the most straightforward, canon-safe continuation with simple natural phrasing."
      : "Variation: natural. Vary wording, rhythm and character choices while staying grounded in established canon.";

  return `${lengthRule}
${narrationRule}
${pacingRule}
${creativityRule}`;
}

function buildPrompt({
  character,
  messages,
  memories,
  loreEntries,
  userIdentity,
  conversationSummary = "",
  sceneState = {},
  storyTimeline = [],
  relationshipState = {},
  castState = {},
  storyChapters = [],
  activeChapter = {},
  unfinishedThreads = [],
  regenerationInstruction = "",
  directorInstruction = "",
  turnResolution = {},
}) {
  const memoryText = memories.length
    ? memories.map((memory, index) => `${index + 1}. [${memory.category || "event"}${memory.is_pinned ? ", PINNED" : ""}] ${memory.content}`).join("\n")
    : "none";

  const loreText = loreEntries.length
    ? loreEntries.map((entry, index) => `${index + 1}. [${entry.entry_type}] ${entry.name}: ${entry.content}`).join("\n")
    : "none";

  const historyText = messages.length
    ? messages.slice(-28).map((message, index) => {
        const type = message.sender === "user" ? "USER" : "CHARACTER";
        const name = message.sender === "user" ? userIdentity.name : character.name;
        const replyMeta = message.reply_to_message_id && message.reply_preview
          ? ` reply_to="${escapePromptText(String(message.reply_preview).slice(0, 220))}"`
          : "";
        return `<m n="${index + 1}" type="${type}" speaker="${escapePromptText(name)}"${replyMeta}>${escapePromptText(message.content)}</m>`;
      }).join("\n")
    : "none";

  const immediateContinuity = messages.slice(-6).map((message) => {
    const speaker = message.sender === "user" ? userIdentity.name : character.name;
    return `${speaker}: ${escapePromptText(message.content)}`;
  }).join("\n") || "none";

  const mandatoryDirection = regenerationInstruction
    ? `MANDATORY DIRECTION FOR THIS ALTERNATE TAKE\n${regenerationInstruction}\nThe finished passage must visibly enact this direction. Do not merely adjust adjectives, tone, or wording. If it specifies what a character does, does not do, says, or where the scene goes, that outcome is required.\n\n`
    : "";

  return `
${mandatoryDirection}TURN RESOLUTION
${formatNaturalTurnResolution(turnResolution, userIdentity, character)}

CHARACTER
Name: ${character.name}
Role/archetype: ${character.role || "not specified"}
Description: ${character.description || "not specified"}
Personality: ${character.personality || "not specified"}
Relationship to ${userIdentity.name}: ${character.relationship || "not specified"}
Values: ${character.character_values || "not specified"}
Fears: ${character.fears || "not specified"}
Habits: ${character.habits || "not specified"}
Contradictions: ${character.contradictions || "not specified"}
Speech style: ${character.speech_style || "not specified"}
Boundaries: ${character.boundaries || "not specified"}
Scenario/world: ${character.scenario || character.world || "not specified"}
Example dialogue: ${character.example_dialogue || "none"}

USER-CONTROLLED PROTAGONIST
Name: ${userIdentity.name}
Pronouns: ${userIdentity.pronouns || "not specified"}
Age: ${userIdentity.age || "not specified"}
Role: ${userIdentity.role || "not specified"}
Appearance: ${userIdentity.appearance || "not specified"}
Personality: ${userIdentity.personality || "not specified"}
Background: ${userIdentity.background || "not specified"}
Goals/preferences: ${userIdentity.goals || "none"} / ${userIdentity.preferences || "none"}
Boundaries: ${userIdentity.boundaries || "none"}
Speech style: ${userIdentity.speechStyle || "not specified"}
Notes: ${userIdentity.notes || "none"}

LATEST CONTINUITY — highest factual context after latest user turn
${immediateContinuity}

CURRENT SCENE
${formatSceneState(sceneState)}

RELATIONSHIP
${formatRelationshipState(relationshipState)}

CAST
${formatCastState(castState)}

OPEN THREADS
${formatUnfinishedThreads(unfinishedThreads)}

ROLLING SUMMARY
${conversationSummary?.trim() || "none"}

RECENT MAJOR TIMELINE
${formatStoryTimeline(storyTimeline)}

CHAPTER CONTEXT
${formatStoryChapters(storyChapters, activeChapter)}

RELEVANT MEMORIES
${memoryText}

ACTIVE LORE
${loreText}

RECENT HISTORY
${historyText}

FINAL PRE-WRITE CHECK
- What exactly did the USER just do/say/ask/correct?
- Who naturally receives the first meaningful reaction?
- What is the communication medium? Treat ${turnResolution.digitalMode || "in_person"} as authoritative for this turn.
- If medium is in_person or phone_call, verify there is ZERO > message syntax anywhere in spoken dialogue.
- If medium is digital, verify only actual written messages use >.
- What facts are known vs unknown?
- If emotion appears, who/what is it actually about according to canon?
- Is ${userIdentity.name} still present?
- Is any sentence repeating, padding, or inventing off-screen context?
- If digital, are actual messages formatted with '> '?
- If regenerating, does the retry genuinely follow the regeneration direction and feel meaningfully different from the rejected answer?
- If a mandatory direction exists, can the user point to the exact requested change in the passage? If not, rewrite before output.
- If this is a silent continue, is there actual character voice and meaningful movement rather than another narration-only pause? If not, rewrite before output.
- If return_to_main_character=yes, does the final passage clearly return focus to ${character.name} instead of continuing to center a secondary character? If not, rewrite before output.
- If follow_main_character_after_exit=yes, does the passage follow ${character.name} and reveal a canon-supported public/private contradiction rather than describing what they left behind? If not, rewrite before output.
- Does every English sentence sound idiomatic, clear and natural rather than technically grammatical but awkward?
- Are any pronouns, possessives or metaphors ambiguous? If yes, simplify them before output.
- Did you add a gesture just to fill silence? Remove it.
- Are two or more stock body-language cues chained together? Keep only the one that matters.
- Does dialogue sound character-specific and conversational rather than polished exposition? Fix it if not.
- Does the response explain an emotion that the dialogue/action already showed? Cut the explanation.
Then write ONLY the next roleplay passage. Do not explain these checks.
`;
}

function buildFinalStyleReminder(character) {
  const narration = String(character.narration_style || "balanced").toLowerCase();
  const length = String(character.response_length || "balanced").toLowerCase();

  const narrationReminder = narration === "dialogue"
    ? "Mostly dialogue: dialogue must visibly dominate the final response; keep action/narration brief."
    : narration === "immersive"
      ? "Immersive: narration/action and concrete scene texture must visibly dominate; dialogue is secondary unless the moment requires it."
      : "Balanced: naturally mix dialogue, action, and description.";

  const lengthReminder = length === "short"
    ? "Keep it compact and stop as soon as the beat lands."
    : length === "long"
      ? "Add depth only where it matters; shorter is always allowed and filler is forbidden."
      : "Use moderate detail and end when the meaningful beat is complete.";

  const pacing = String(character.pacing_mode || "natural").toLowerCase();
  const pacingReminder = pacing === "quick"
    ? "Quick pace: land one useful beat fast and cut connective prose."
    : pacing === "cinematic"
      ? "Cinematic pace: use purposeful scene texture and transitions, but never pad for length."
      : "Natural pace: read like a well-edited novel scene with no filler.";

  return `${narrationReminder} ${lengthReminder} ${pacingReminder}`;
}

function applyNaturalOutputGuard({ text, turnResolution = {}, characterName, userName }) {
  let output = String(text || "").trim();
  if (!output) return output;

  // Keep silent continues short.
  if (turnResolution.silentContinue) {
    const paragraphs = output.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length > 3) output = paragraphs.slice(0, 3).join("\n\n").trim();
  }

  // Scene shifts should not reopen stale physical continuity.
  if (turnResolution.sceneShift) {
    output = output.replace(/^\s*(?:Meanwhile,?\s+)?(?:back\s+(?:in|at)\s+[^.]{1,100}[.]\s*)/i, "");
  }

  const digital = ["group_chat", "direct_message"].includes(turnResolution.digitalMode);

  // Hard communication-medium formatting guard
  // Spoken in-person/phone dialogue must never leak the Markdown blockquote
  // syntax reserved for written DMs and group chats. This is deterministic,
  // so even if the model ignores the prompt the user never sees a fake text bubble.
  if (!digital) {
    output = output
      .split("\n")
      .map((line) => line.replace(/^\s*>\s?/, ""))
      .join("\n")
      .trim();
  }

  if (digital) {
    const lines = output.split("\n");
    const knownNames = [characterName, ...(turnResolution.groupCandidates || []), ...(turnResolution.taggedHandles || [])]
      .map((name) => String(name || "").trim())
      .filter(Boolean);

    const speakerPattern = knownNames.length
      ? new RegExp(`^\\s*(?:\\*\\*)?(?:${knownNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\*\\*)?\\s*:\\s*`, "i")
      : /^\s*(?:\*\*)?[\p{L}\p{N}_ -]{2,40}(?:\*\*)?\s*:\s*/iu;

    const normalized = lines.map((line) => {
      if (/^\s*>/.test(line)) return line.trimStart();
      if (speakerPattern.test(line)) return `> ${line.trim()}`;
      // A standalone quoted line inside a resolved digital medium is a written
      // message, not spoken dialogue. Normalize it to Velvet's message syntax.
      if (/^\s*["“][^"”\n]+["”]\s*[.!?…]*\s*$/.test(line)) return `> ${line.trim()}`;
      return line;
    });

    output = normalized.join("\n").trim();

    // Once the model has produced actual written-message lines, keep the output
    // inside the digital medium. This prevents cinematic phone/room cutaways in
    // both DMs and group chats.
    const quotedLines = output.split("\n").filter((line) => /^\s*>\s*\S/.test(line));
    if (quotedLines.length) {
      output = quotedLines.join("\n\n");
    }
  }

  // Narrative economy: collapse pathological runs of tiny atmospheric paragraphs.
  const paragraphs = output.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length > 8 && String(turnResolution.mode || "") !== "scene_shift") {
    output = paragraphs.slice(0, 8).join("\n\n").trim();
  }

  return output;
}

function stripDialogueForAgencyCheck(value = "") {
  return String(value || "")
    .replace(/[“”]([^“”]{0,1000})[“”]/g, " ")
    .replace(/"([^"\n]{0,1000})"/g, " ")
    .replace(/^\s*>.*$/gm, " ");
}

function userEstablishedActionVerbs(latestUserMessage = "") {
  const normalized = String(latestUserMessage || "").toLowerCase();
  const verbs = [
    "smile", "laugh", "nod", "shake", "walk", "leave", "look", "glance", "turn", "step",
    "grab", "take", "sit", "stand", "move", "cry", "wave", "shrug", "approach", "follow",
    "open", "close", "text", "call", "say", "ask", "reply", "whisper", "chuckle", "scoff",
  ];
  return new Set(verbs.filter((verb) => new RegExp(`\\bi\\s+(?:\\w+\\s+){0,2}${verb}(?:e?d|s|ing)?\\b`, "i").test(normalized)));
}

function likelyControlsUserPOV(text, userName, latestUserMessage = "") {
  const prose = stripDialogueForAgencyCheck(text);
  const escaped = String(userName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const established = userEstablishedActionVerbs(latestUserMessage);

  const mentalOrReactionPattern = /\byou\s+(?:feel|felt|think|thought|realize|realized|decide|decided|want|wanted|know|knew|wonder|wondered|notice|noticed|freeze|froze|flinch|flinched|blush|blushed|tense|tensed|hesitate|hesitated|panic|panicked)\b/i;
  const bodyReactionPattern = /\byour\s+(?:heart|pulse|stomach|chest|breath|cheeks|face|hands|fingers|knees|throat)\s+(?:tightens?|drops?|jumps?|races?|catches?|warms?|burns?|shakes?|trembles?|goes|feels|twists?)\b/i;
  if (mentalOrReactionPattern.test(prose) || bodyReactionPattern.test(prose)) return true;

  const actionMatches = [...prose.matchAll(/\byou\s+(smile|laugh|nod|shake|walk|leave|look|glance|turn|step|grab|take|sit|stand|move|cry|wave|shrug|approach|follow|open|close|text|call|say|ask|reply|whisper|chuckle|scoff)(?:e?d|s|ing)?\b/gi)];
  if (actionMatches.some((match) => !established.has(String(match[1] || "").toLowerCase()))) return true;

  if (escaped) {
    const namedActionPattern = new RegExp(`(?:\\*|^|\\n)\\s*${escaped}\\s+(?:smiled|laughed|nodded|shook|walked|followed|looked|felt|thought|realized|decided|said|asked|whispered|replied|turned|stepped|grabbed|took|sat|stood|left|went|moved|blushed|cried)\\b`, "i");
    const namedMentalPattern = new RegExp(`\\b${escaped}\\s+(?:felt|thought|wanted|knew|realized|wondered|decided)\\b`, "i");
    if (namedActionPattern.test(prose) || namedMentalPattern.test(prose)) return true;
  }

  return false;
}

async function repairUserPOVViolation({ apiKey, text, userName, latestUserMessage = "", language }) {
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Repair this private roleplay passage. Keep the same events, tone, dialogue, formatting and length as closely as possible, but remove every action, dialogue, thought, feeling, reaction or decision attributed to the user-controlled protagonist ${userName} UNLESS that exact user action was already established in the latest user turn below. Never invent a reaction for the user. Keep all reader-facing references to the user in second person (you/your), never she/he/they/her/him/them or the user name unless another character says the name in dialogue. Other characters and neutral observable narration may remain. Do not add new events. Output only the repaired passage in ${language}.

LATEST USER TURN:
${String(latestUserMessage || "").slice(0, 2500)}

PASSAGE:
${text.slice(0, 12000)}` }] }],
        generationConfig: { maxOutputTokens: 1600 },
      }),
    });
    if (!response.ok) return text;
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || "").join("").trim() || text;
  } catch {
    return text;
  }
}

function likelyNeedsNaturalVoiceRepair(value = "") {
  const text = String(value || "");
  if (!text.trim()) return false;

  const awkwardPatterns = [
    /\bhis name for you\b/i,
    /\bher name for you\b/i,
    /\btheir name for you\b/i,
    /\bvoice cutting (?:easily )?through the quiet\b/i,
    /\bthumb (?:still )?tracing\b/i,
    /\bflat,? humorless (?:breath|laugh|chuckle)\b/i,
  ];
  if (awkwardPatterns.some((pattern) => pattern.test(text))) return true;

  const stockPatterns = [
    /\bfor a (?:long )?beat\b/gi,
    /\bjaw (?:tightened|clenched|worked|flexed)\b/gi,
    /\b(?:let|lets|letting) out a (?:slow |quiet |sharp |flat )?(?:breath|exhale)\b/gi,
    /\breleased? a breath\b/gi,
    /\bsilence (?:stretched|pressed|settled|hung|fell)\b/gi,
    /\b(?:heavy|thick|charged) silence\b/gi,
    /\bgaze (?:lingered|dropped|flicked|shifted)\b/gi,
    /\beyes? (?:lingered|flicked|darkened|softened)\b/gi,
    /\bcorner of (?:his|her|their) mouth\b/gi,
    /\bshoulders? (?:eased|tensed|dropped|stiffened)\b/gi,
    /\bhand(?:s)? (?:flexed|curled|clenched|slid into .*pocket)\b/gi,
    /\b(?:amber|dim|low) (?:glow|light)\b/gi,
    /\b(?:dark|quiet|empty) room\b/gi,
    /\b(?:stared|looked) (?:down )?at the (?:floor|ground)\b/gi,
    /\bleaned (?:his|her|their) shoulder against\b/gi,
    /\bsomething (?:unreadable|heavy|sharp)\b/gi,
    /\bvoice (?:low|rough|quiet|flat)\b/gi,
  ];

  let hits = 0;
  for (const pattern of stockPatterns) {
    hits += (text.match(pattern) || []).length;
  }
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length || 1;
  return hits >= 3 || (hits >= 2 && paragraphs <= 3);
}

async function repairNaturalVoice({ apiKey, text, language, medium, userName, latestUserMessage = "" }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Rewrite this roleplay passage so it reads like natural contemporary fiction, not AI-generated prose. Preserve the actual events, character intent, established facts and useful dialogue, but make dialogue conversational and character-specific. Remove stock gestures, decorative body-language chains, melodramatic silence/lighting prose, redundant emotional explanations and awkward metaphors. Do not add new facts or new actions. The user-controlled protagonist is ${userName}; never invent their actions, reactions, thoughts, feelings, dialogue or decisions beyond what the latest user turn explicitly established. Address the user as you/your in reader-facing narration. Communication medium is ${medium}. For in_person or phone_call, NEVER use Markdown > for spoken dialogue. For direct_message or group_chat, > is reserved only for actual written messages. Output only the repaired passage in ${language}.\n\nLATEST USER TURN:\n${String(latestUserMessage || "").slice(0, 2500)}\n\nPASSAGE:\n${String(text || "").slice(0, 12000)}` }] }],
        generationConfig: { maxOutputTokens: 1700 },
      }),
    });
    if (!response.ok) return text;
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === "string" && !part.thought)
      .map((part) => part.text)
      .join("")
      .trim() || text;
  } catch {
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function formatUnfinishedThreads(value) {
  const rows = Array.isArray(value) ? value.filter((item) => item && item.status !== "resolved").slice(0, 12) : [];
  if (!rows.length) return "No open unfinished threads yet.";
  return rows.map((item, index) => `${index + 1}. ${String(item.title || item.label || "Unfinished thread").slice(0, 140)}${item.detail ? ` — ${String(item.detail).slice(0, 360)}` : ""}`).join("\n");
}

function sanitizeUnfinishedThreads(value, fallback = []) {
  const previous = Array.isArray(fallback) ? fallback : [];
  const incoming = Array.isArray(value) ? value : [];
  const byKey = new Map();

  const normalize = (raw, index = 0) => {
    const item = typeof raw === "string" ? { title: raw } : (raw || {});
    const title = String(item.title || item.label || "").trim().slice(0, 140);
    if (!title) return null;
    const titleKey = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const id = String(item.id || `thread-${index}-${titleKey.slice(0, 28).replace(/\s+/g, "-")}`).slice(0, 90);
    return {
      id,
      title,
      detail: String(item.detail || item.context || "").slice(0, 500),
      status: item.status === "resolved" ? "resolved" : "open",
      last_seen: String(item.last_seen || item.lastSeen || "").slice(0, 100),
      _key: String(item.id || titleKey).toLowerCase(),
    };
  };

  previous.forEach((item, index) => {
    const normalized = normalize(item, index);
    if (normalized) byKey.set(normalized._key, normalized);
  });

  incoming.forEach((item, index) => {
    const normalized = normalize(item, index + previous.length);
    if (!normalized) return;
    const existing = byKey.get(normalized._key);
    byKey.set(normalized._key, existing ? {
      ...existing,
      ...normalized,
      detail: normalized.detail || existing.detail,
      last_seen: normalized.last_seen || existing.last_seen,
    } : normalized);
  });

  return [...byKey.values()]
    .map(({ _key, ...item }) => item)
    .filter((item) => item.status !== "resolved")
    .slice(-12);
}

function detectResponseLanguage(latestUserMessage, previousCharacterMessage) {
  const raw = String(latestUserMessage || "");
  const explicit = raw.match(/\[(?:language|idioma)\s*:\s*(english|inglés|ingles|spanish|español|espanol)\s*\]/i);
  if (explicit) {
    return /english|inglés|ingles/i.test(explicit[1]) ? "English" : "Spanish";
  }

  const withoutDirections = raw
    .replace(/\[[\s\S]*?\]/g, " ")
    .replace(/[*/_~>]/g, " ")
    .trim();

  const reference = withoutDirections || previousCharacterMessage || raw || "English";
  const normalized = ` ${reference.toLowerCase().replace(/[^a-záéíóúñ'¿¡]+/gi, " ")} `;
  const spanishMarkers = [" que ", " de ", " no ", " sí ", " si ", " estoy ", " quiero ", " pero ", " porque ", " cómo ", " como ", " hola ", " gracias ", " entonces ", " ella ", " él ", " tú ", " tu ", " yo ", " para ", " con ", " me ", " mi "];
  const englishMarkers = [" the ", " and ", " i ", " you ", " i'm ", " im ", " don't ", " didnt ", " didn't ", " but ", " why ", " what ", " thanks ", " thank ", " then ", " she ", " he ", " with ", " for ", " my ", " me ", " is ", " are ", " not "];
  const spanishScore = spanishMarkers.filter((marker) => normalized.includes(marker)).length + (/[áéíóúñ¿¡]/i.test(reference) ? 3 : 0);
  const englishScore = englishMarkers.filter((marker) => normalized.includes(marker)).length;

  if (spanishScore === englishScore && withoutDirections.length < 18) {
    const previous = String(previousCharacterMessage || "");
    return /[áéíóúñ¿¡]/i.test(previous) ? "Spanish" : "English";
  }
  return spanishScore > englishScore ? "Spanish" : "English";
}

function analyzeTimeSkip(content) {
  const text = String(content || "");
  const match = text.match(/\[(?:time\s*skip|timeskip|salto\s+de\s+tiempo)(?::|\s)?([^\]]*)\]/i);
  if (!match) return { active: false, scale: "none" };
  const detail = match[1]?.trim() || "a short natural interval";
  const long = /month|year|mes|año|week|semana/i.test(detail);
  return { active: true, scale: long ? `long: ${detail}` : `short: ${detail}` };
}


function formatSceneState(sceneState) {
  if (!sceneState || typeof sceneState !== "object" || Array.isArray(sceneState)) return "No structured scene state yet.";
  const present = Array.isArray(sceneState.present) ? sceneState.present.join(", ") : "unknown";
  const absent = Array.isArray(sceneState.absent) ? sceneState.absent.join(", ") : "unknown";
  return [
    `Location: ${sceneState.location || "unknown"}`,
    `Time: ${sceneState.time || "unknown"}`,
    `Communication medium: ${sceneState.medium || "unknown"}`,
    `Present: ${present || "unknown"}`,
    `Known absent/off-screen: ${absent || "none established"}`,
    `Active situation: ${sceneState.situation || "unknown"}`,
    `Pending actions: ${Array.isArray(sceneState.pending) && sceneState.pending.length ? sceneState.pending.join("; ") : "none established"}`,
    `Important objects/positions: ${Array.isArray(sceneState.objects) && sceneState.objects.length ? sceneState.objects.join("; ") : "none established"}`,
  ].join("\n");
}

function formatStoryTimeline(timeline) {
  if (!Array.isArray(timeline) || !timeline.length) return "No major timeline beats saved yet.";
  return timeline.slice(-12).map((item, index) => {
    if (typeof item === "string") return `${index + 1}. ${item}`;
    return `${index + 1}. ${item?.label || item?.event || "Story beat"}${item?.detail ? ` — ${item.detail}` : ""}`;
  }).join("\n");
}

function formatRelationshipState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state) || !Object.keys(state).length) return "No stable relationship metrics yet. Let events establish them naturally.";
  return [
    `Dynamic: ${state.current_dynamic || state.label || "not established"}`,
    `Trust ${state.trust ?? "?"}/100 · Affection ${state.affection ?? "?"}/100 · Attraction ${state.attraction ?? "?"}/100`,
    `Tension ${state.tension ?? "?"}/100 · Resentment ${state.resentment ?? "?"}/100 · Familiarity ${state.familiarity ?? "?"}/100`,
    state.last_shift ? `Last supported shift: ${state.last_shift}` : "",
  ].filter(Boolean).join("\n");
}

function formatCastState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state) || !Object.keys(state).length) return "No persistent side-character state saved yet.";
  return Object.entries(state).slice(0, 12).map(([name, item]) => {
    const safe = item && typeof item === "object" ? item : {};
    return `${name}: ${safe.role || "side character"}; ${safe.personality || ""}; relationship=${safe.relationship || "unknown"}; status=${safe.current_status || "unknown"}; knows=${Array.isArray(safe.knows) ? safe.knows.join(", ") : ""}`;
  }).join("\n");
}

function formatStoryChapters(chapters, activeChapter) {
  const recent = Array.isArray(chapters) ? chapters.slice(-4) : [];
  const history = recent.length ? recent.map((item) => `Chapter ${item?.number || "?"}: ${item?.title || "Untitled"} — ${item?.summary || ""}`).join("\n") : "No completed chapters yet.";
  const active = activeChapter && typeof activeChapter === "object" && Object.keys(activeChapter).length
    ? `Active chapter ${activeChapter.number || "?"}: ${activeChapter.title || "Untitled"} — ${activeChapter.summary || "in progress"}`
    : "Active chapter has not been named yet.";
  return `${history}\n${active}`;
}

async function updateStoryStateInBackground({ supabase, apiKey, conversationId, userId, expectedRevision, character, userIdentity, previousSceneState, previousTimeline, previousRelationshipState, previousCastState, previousChapters, previousActiveChapter, previousThreads = [], messages }) {
  try {
    const history = messages.slice(-20).map((message) => `${message.sender === "user" ? userIdentity.name : character.name}: ${message.content}`).join("\n");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Maintain hidden structured state for a private interactive novel. Never invent facts. The LATEST USER turn is authoritative and must update stale scene metadata immediately. Latest explicit user corrections win. The user exclusively controls ${userIdentity.name}; never infer their feelings, thoughts or unspoken decisions. If ${userIdentity.name} was present and did not explicitly leave or move the camera elsewhere, keep them present. NPC dialogue does not erase the user from the scene. Track physical continuity, persistent NPC facts and relationship movement only when supported by events. Also track scene.medium as exactly one of in_person, direct_message, group_chat, phone_call. Change scene.medium only when recent history clearly changes the communication medium; a phone merely being present does not count. Relationship scores are soft 0-100 estimates and should move slowly, usually by 0-4 points per update. Do not reward generic proximity as romance. Create a new chapter only after a meaningful scene/time/location/story-phase transition, not every few turns. Keep chapter summaries factual and compact.\n\nUser: ${userIdentity.name}\nMain character: ${character.name}\nPrevious scene: ${JSON.stringify(previousSceneState || {})}\nPrevious timeline: ${JSON.stringify(previousTimeline || [])}\nPrevious relationship: ${JSON.stringify(previousRelationshipState || {})}\nPrevious cast: ${JSON.stringify(previousCastState || {})}\nPrevious chapters: ${JSON.stringify(previousChapters || [])}\nActive chapter: ${JSON.stringify(previousActiveChapter || {})}\nPrevious unfinished threads: ${JSON.stringify(previousThreads || [])}\nRecent history:\n${history}\n\nTrack unfinished threads too: concrete promises, invitations, plans, unresolved arguments, suspicions, secrets-in-play, future events, unanswered questions or obligations that could matter later. Keep at most 12. Preserve old open threads until the story clearly resolves or supersedes them. Do not create threads from tiny temporary actions. Return JSON only with keys scene, timeline, relationship, cast, chapters, activeChapter, threads.` }] }],
        generationConfig: {
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        }
      }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || "").join("").trim();
    if (!text) return;
    const parsed = JSON.parse(text);
    const scene = sanitizeSceneState(parsed?.scene, previousSceneState);
    const timeline = sanitizeTimeline(parsed?.timeline, previousTimeline);
    const relationship = sanitizeRelationshipState(parsed?.relationship, previousRelationshipState, character.name);
    const cast = sanitizeCastState(parsed?.cast, previousCastState, character.name, userIdentity.name);
    const chapters = sanitizeChapters(parsed?.chapters, previousChapters);
    const activeChapter = sanitizeActiveChapter(parsed?.activeChapter, previousActiveChapter, chapters);
    const threads = sanitizeUnfinishedThreads(parsed?.threads, previousThreads);
    await supabase.from("conversations")
      .update({
        scene_state: scene,
        story_timeline: timeline,
        relationship_state: relationship,
        cast_state: cast,
        story_chapters: chapters,
        active_chapter: activeChapter,
        unresolved_threads: threads,
        scene_state_updated_at: new Date().toISOString(),
        story_engine_version: 7,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", userId)
      .eq("story_revision", expectedRevision);
  } catch (error) {
    console.error("Background story state update failed:", error);
  }
}

function sanitizeSceneState(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback || {};
  return {
    location: String(value.location || fallback?.location || "unknown").slice(0, 160),
    time: String(value.time || fallback?.time || "unknown").slice(0, 120),
    medium: ["in_person", "direct_message", "group_chat", "phone_call"].includes(String(value.medium || ""))
      ? String(value.medium)
      : (["in_person", "direct_message", "group_chat", "phone_call"].includes(String(fallback?.medium || "")) ? String(fallback.medium) : "unknown"),
    present: Array.isArray(value.present) ? value.present.slice(0, 12).map((x) => String(x).slice(0, 80)) : (fallback?.present || []),
    absent: Array.isArray(value.absent) ? value.absent.slice(0, 12).map((x) => String(x).slice(0, 80)) : (fallback?.absent || []),
    situation: String(value.situation || fallback?.situation || "unknown").slice(0, 500),
    pending: Array.isArray(value.pending) ? value.pending.slice(0, 8).map((x) => String(x).slice(0, 180)) : (fallback?.pending || []),
    objects: Array.isArray(value.objects) ? value.objects.slice(0, 8).map((x) => String(x).slice(0, 180)) : (fallback?.objects || []),
  };
}

function sanitizeTimeline(value, fallback = []) {
  const rows = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : []);
  return rows.slice(-24).map((item) => typeof item === "string"
    ? { label: String(item).slice(0, 120), detail: "" }
    : { label: String(item?.label || item?.event || "Story beat").slice(0, 120), detail: String(item?.detail || "").slice(0, 400) });
}

function sanitizeRelationshipState(value, fallback = {}, characterName = "Character") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : (fallback || {});
  const score = (key, d) => Math.max(0, Math.min(100, Math.round(Number(source[key] ?? fallback?.[key] ?? d))));
  return {
    label: String(source.label || fallback?.label || `Relationship with ${characterName}`).slice(0, 100),
    trust: score("trust", 50),
    affection: score("affection", 30),
    attraction: score("attraction", 20),
    tension: score("tension", 25),
    resentment: score("resentment", 10),
    familiarity: score("familiarity", 35),
    current_dynamic: String(source.current_dynamic || fallback?.current_dynamic || "Not enough established yet").slice(0, 500),
    last_shift: String(source.last_shift || "").slice(0, 300),
  };
}

function sanitizeCastState(value, fallback = {}, characterName = "Character", userName = "User") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : (fallback || {});
  const out = {};
  for (const [name, raw] of Object.entries(source).slice(0, 20)) {
    if (!name || [characterName, userName].includes(name)) continue;
    const item = raw && typeof raw === "object" ? raw : {};
    out[String(name).slice(0, 80)] = {
      role: String(item.role || "Side character").slice(0, 160),
      personality: String(item.personality || "").slice(0, 320),
      relationship: String(item.relationship || "").slice(0, 320),
      knows: Array.isArray(item.knows) ? item.knows.slice(0, 8).map((x) => String(x).slice(0, 180)) : [],
      current_status: String(item.current_status || "").slice(0, 260),
    };
  }
  return out;
}

function sanitizeChapters(value, fallback = []) {
  const rows = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : []);
  return rows.slice(-30).map((item, index) => ({
    number: Math.max(1, Number(item?.number) || index + 1),
    title: String(item?.title || `Chapter ${index + 1}`).slice(0, 100),
    summary: String(item?.summary || "").slice(0, 1200),
    started_at: String(item?.started_at || ""),
  }));
}

function sanitizeActiveChapter(value, fallback = {}, chapters = []) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : (fallback || {});
  const number = Math.max(1, Number(source.number) || Number(chapters.at(-1)?.number) || 1);
  return {
    number,
    title: String(source.title || chapters.at(-1)?.title || `Chapter ${number}`).slice(0, 100),
    summary: String(source.summary || "").slice(0, 1200),
    started_at: String(source.started_at || new Date().toISOString()),
  };
}

async function updateConversationSummaryInBackground({ supabase, apiKey, conversationId, userId, expectedRevision, character, userIdentity, previousSummary, messages }) {
  try {
    const history = messages.slice(-28).map((message) =>
      `${message.sender === "user" ? userIdentity.name : character.name}: ${message.content}`
    ).join("\n");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Maintain a compact factual continuity summary for a private roleplay. Preserve established relationships, locations, unresolved conflicts, important promises, boundaries, current scene state, and explicit user corrections. Never invent facts. Do not narrate prose. Prefer concrete names. The user controls ${userIdentity.name}; do not infer their feelings or thoughts.\n\nPrevious summary:\n${previousSummary || "none"}\n\nRecent history:\n${history}\n\nReturn only the updated summary, maximum 900 words.` }] }],
        generationConfig: { maxOutputTokens: 1300 },
      }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || "").join("").trim();
    if (!summary) return;

    await supabase.from("conversations")
      .update({ summary: summary.slice(0, 12000), updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId)
      .eq("story_revision", expectedRevision);
  } catch (error) {
    console.error("Background summary update failed:", error);
  }
}

async function extractMemoriesInBackground({ supabase, apiKey, conversationId, characterId, userId, expectedRevision, character, userIdentity, messages, existingMemories }) {
  try {
    const history = messages.slice(-16).map((message) => `${message.sender === "user" ? userIdentity.name : character.name}: ${message.content}`).join("\n");
    const existing = existingMemories.map((memory) => memory.content).join("\n");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Extract at most 3 durable roleplay memories as a JSON array. Each item: {"content":"explicit fact with names","importance":1-5,"category":"person|relationship|world|event|preference|boundary"}. Never save temporary actions, silent bracketed instructions, guesses, repeated facts or contradictions. Existing memories:\n${existing || "none"}\nConversation:\n${history}\nReturn only JSON.` }] }],
        generationConfig: { maxOutputTokens: 500, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "[]";
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return;

    if (!await isStoryRevisionCurrent(supabase, conversationId, userId, expectedRevision)) return;

    const existingSet = new Set(existingMemories.map((memory) => normalizeText(memory.content)));
    const candidates = parsed
      .filter((memory) => memory?.content && !existingSet.has(normalizeText(memory.content)))
      .slice(0, 3)
      .map((memory) => ({
        conversation_id: conversationId,
        character_id: characterId,
        user_id: userId,
        content: String(memory.content).slice(0, 300),
        importance: Math.min(5, Math.max(1, Number(memory.importance) || 3)),
        category: normalizeMemoryCategory(memory.category),
        source: "automatic",
        scope: "conversation",
      }));

    for (const row of candidates) {
      if (!await isStoryRevisionCurrent(supabase, conversationId, userId, expectedRevision)) return;
      const replacement = existingMemories.find((memory) =>
        !memory.is_pinned &&
        normalizeMemoryCategory(memory.category) === row.category &&
        memoryTextSimilarity(memory.content, row.content) >= 0.58
      );
      if (replacement?.id) {
        await supabase.from("memories")
          .update({ content: row.content, importance: row.importance, updated_at: new Date().toISOString() })
          .eq("id", replacement.id)
          .eq("user_id", userId);
      } else {
        await supabase.from("memories").insert(row);
      }
    }
  } catch (error) {
    console.error("Background memory extraction failed:", error);
  }
}

function memoryTextSimilarity(left, right) {
  const stop = new Set(["the","a","an","and","or","to","of","in","on","at","is","are","was","were","has","have","had","she","he","they","her","his","their","el","la","los","las","un","una","y","o","de","en","es","son","era","ella","él","su","sus"]);
  const tokens = (value) => new Set(normalizeText(value).split(" ").filter((token) => token.length > 2 && !stop.has(token)));
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.min(a.size, b.size);
}

function normalizeMemoryCategory(value) {
  const allowed = new Set(["person", "relationship", "world", "event", "preference", "boundary"]);
  const category = String(value || "event").toLowerCase();
  return allowed.has(category) ? category : "event";
}

function getUserIdentity(user, persona = null) {
  const metadata = user?.user_metadata || {};
  const name = persona?.name || metadata.display_name || metadata.full_name || metadata.name || String(user?.email || "").split("@")[0] || "the user";
  return {
    id: user.id,
    personaId: persona?.id || null,
    name: cleanPersonaField(name, 80),
    pronouns: cleanPersonaField(persona?.pronouns, 80),
    age: cleanPersonaField(persona?.age, 40),
    role: cleanPersonaField(persona?.role, 180),
    appearance: cleanPersonaField(persona?.appearance, 800),
    personality: cleanPersonaField(persona?.personality, 800),
    background: cleanPersonaField(persona?.background, 1200),
    goals: cleanPersonaField(persona?.goals, 800),
    preferences: cleanPersonaField(persona?.preferences, 800),
    boundaries: cleanPersonaField(persona?.boundaries, 800),
    speechStyle: cleanPersonaField(persona?.speech_style, 800),
    notes: cleanPersonaField(persona?.notes, 1200),
  };
}

function cleanPersonaField(value, maximum) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, maximum);
}

function getMaximumOutputTokens(length) {
  // VELVET_NARRATIVE_ECONOMY_V1
  // These are safety ceilings, not targets. Prompt rules explicitly allow
  // much shorter replies whenever the current beat does not need more.
  if (length === "short") return 500;
  if (length === "long") return 1500;
  return 900;
}

function getGenerationTemperature(creativity, isRegeneration = false) {
  const value = Number(creativity);
  const normalized = Number.isFinite(value) ? Math.min(1.2, Math.max(0.2, value)) : 0.84;
  // Keep ordinary dialogue coherent while giving alternate takes enough room
  // to make a different character choice instead of paraphrasing.
  const base = 0.58 + ((normalized - 0.2) / 1.0) * 0.34;
  return Number(Math.min(1.02, base + (isRegeneration ? 0.08 : 0)).toFixed(2));
}

function getSupabasePublishableKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return "";
  try {
    const keys = JSON.parse(raw);
    return keys.default || Object.values(keys)[0] || "";
  } catch {
    return raw;
  }
}

function cleanInstruction(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 1500);
}

function escapePromptText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function splitForStreaming(text) {
  const chunks = [];
  let cursor = 0;

  while (cursor < text.length) {
    const remaining = text.slice(cursor);
    const preferredLength = Math.min(36, remaining.length);
    let end = preferredLength;

    if (remaining.length > preferredLength) {
      const boundary = remaining.slice(0, preferredLength + 8).search(/[\s,.!?;:]\S*$/);
      if (boundary > 12) end = boundary + 1;
    }

    chunks.push(remaining.slice(0, end));
    cursor += end;
  }

  return chunks;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sendEvent(controller, data) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function clampControl(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function clampCreativity(value) {
  const number = Number(value ?? 0.84);
  if (!Number.isFinite(number)) return 0.84;
  return Math.min(1.2, Math.max(0.2, number));
}

function getErrorName(error) {
  return error instanceof Error ? error.name : "";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unexpected server error");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
