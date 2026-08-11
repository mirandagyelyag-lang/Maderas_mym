import {
  createContext,
  useContext,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

const ChatsContext = createContext();
const MESSAGE_PAGE_SIZE = 40;

export function ChatsProvider({
  children,
}) {
  const { user } = useAuth();

  const [chats, setChats] =
    useState({});

  // VELVET_GENERATION_MANAGER_V1
  // Generation state is independent from temporary streaming bubbles.
  // A lost/aborted stream can never leave the composer permanently locked.
  const [generationStates, setGenerationStates] =
    useState({});

  const openingConversations =
    useRef({});

  const activeRequests = useRef({});

  function getCharacterMessages(
    characterId
  ) {
    return (
      chats[characterId]
        ?.messages || []
    );
  }

  function getConversation(
    characterId
  ) {
    return (
      chats[characterId] ||
      null
    );
  }

  function isConversationLoading(
    characterId
  ) {
    return (
      chats[characterId]
        ?.loading || false
    );
  }

  function isCharacterStreaming(
    characterId
  ) {
    return (
      chats[characterId]
        ?.messages || []
    ).some(
      (chatMessage) =>
        chatMessage.isStreaming
    );
  }

  function getGenerationState(characterId) {
    return generationStates[characterId] || "idle";
  }

  function isCharacterGenerating(characterId) {
    return getGenerationState(characterId) !== "idle";
  }

  async function startConversation(
    character,
    options = {}
  ) {
    if (!user) {
      throw new Error(
        "You need to sign in before starting a conversation."
      );
    }

    const requestedConversationId = options.conversationId || null;
    const forceNew = Boolean(options.forceNew);

    if (
      !forceNew &&
      chats[character.id]?.conversationId &&
      (!requestedConversationId || chats[character.id].conversationId === requestedConversationId)
    ) {
      return chats[
        character.id
      ];
    }

    const openingKey = forceNew
      ? `${character.id}-new-${crypto.randomUUID()}`
      : `${character.id}-${requestedConversationId || "latest"}`;

    if (
      openingConversations
        .current[openingKey]
    ) {
      return openingConversations
        .current[openingKey];
    }

    const openingPromise =
      openOrCreateConversation(
        character,
        { requestedConversationId, forceNew }
      );

    openingConversations
      .current[openingKey] = openingPromise;

    try {
      return await openingPromise;
    } finally {
      delete openingConversations
        .current[openingKey];
    }
  }

  async function openOrCreateConversation(
    character,
    options = {}
  ) {
    setChats(
      (currentChats) => ({
        ...currentChats,

        [character.id]: {
          ...currentChats[
            character.id
          ],

          messages:
            currentChats[
              character.id
            ]?.messages || [],

          loading: true,
          error: "",
        },
      })
    );

    try {
      let conversation = null;

      if (options.requestedConversationId) {
        conversation = await findConversationById(
          options.requestedConversationId,
          character.id
        );
      } else if (!options.forceNew) {
        conversation = await findLatestConversation(character.id);
      }

      if (!conversation) {
        conversation =
          await createConversation(
            character,
            options.forceNew
          );
      }

      const messagePage = await loadConversationMessages(conversation.id);
      let messages = messagePage.messages;
      let hasMoreMessages = messagePage.hasMore;

      if (
        messages.length === 0
      ) {
        const firstMessage =
          await createFirstMessage(
            conversation.id,
            character
          );

        messages = [
          firstMessage,
        ];
        hasMoreMessages = false;
      }

      const chatData = {
        conversationId:
          conversation.id,

        characterId:
          character.id,

        title:
          conversation.title ||
          character.name,

        summary: conversation.summary || "",

        responseLengthOverride:
          conversation.response_length_override || "",

        narrationStyleOverride:
          conversation.narration_style_override || "",

        creativity:
          Number(conversation.creativity ?? 0.84),

        romanceIntensity: Number(conversation.romance_intensity ?? 35),
        initiative: Number(conversation.initiative ?? 65),
        drama: Number(conversation.drama ?? 45),
        flirting: Number(conversation.flirting ?? 30),
        humor: Number(conversation.humor ?? 45),
        descriptionLevel: Number(conversation.description_level ?? 55),
        characterIndependence: Number(conversation.character_independence ?? 80),
        dialogueFrequency: Number(conversation.dialogue_frequency ?? 55),
        narrativeCamera: conversation.narrative_camera || "balanced",
        innerThoughts: conversation.inner_thoughts || "rare",
        storyPreset: conversation.story_preset || "natural",
        pacingMode: conversation.pacing_mode || "natural",
        sceneState: conversation.scene_state || {},
        storyTimeline: Array.isArray(conversation.story_timeline) ? conversation.story_timeline : [],
        relationshipState: conversation.relationship_state || {},
        castState: conversation.cast_state || {},
        storyChapters: Array.isArray(conversation.story_chapters) ? conversation.story_chapters : [],
        activeChapter: conversation.active_chapter || {},
        unfinishedThreads: Array.isArray(conversation.unresolved_threads) ? conversation.unresolved_threads : [],
        storyEngineVersion: Number(conversation.story_engine_version || 7),
        storyRevision: conversation.story_revision || "",
        branchParentId: conversation.branch_parent_id || "",
        branchFromMessageId: conversation.branch_from_message_id || "",
        branchLabel: conversation.branch_label || "",

        personaId:
          conversation.persona_id || "",

        lorebookId:
          conversation.lorebook_id || "",

        memoryUsage: null,

        loreUsage: null,

        messages,
        hasMoreMessages,
        loadingEarlierMessages: false,
        loading: false,
        error: "",
      };

      setChats(
        (currentChats) => ({
          ...currentChats,

          [character.id]:
            chatData,
        })
      );

      return chatData;
    } catch (error) {
      console.error(
        "Error opening conversation:",
        error
      );

      setChats(
        (currentChats) => ({
          ...currentChats,

          [character.id]: {
            ...currentChats[
              character.id
            ],

            loading: false,

            error:
              error.message ||
              "We couldn't open this conversation.",
          },
        })
      );

      throw error;
    }
  }

  async function findLatestConversation(
    characterId
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("conversations")
      .select("*")
      .eq(
        "character_id",
        characterId
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async function createConversation(
    character,
    isAdditional = false
  ) {
    const { data: defaultPersona } = await supabase
      .from("personas")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    const {
      data,
      error,
    } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,

        character_id:
          character.id,

        title:
          isAdditional
            ? createConversationTitle()
            : character.name,

        persona_id:
          defaultPersona?.id || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function loadConversationMessages(conversationId, options = {}) {
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1);

    if (options.before) {
      query = query.lt("created_at", options.before);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = data || [];
    return {
      messages: rows
        .slice(0, MESSAGE_PAGE_SIZE)
        .reverse()
        .map(convertDatabaseMessage),
      hasMore: rows.length > MESSAGE_PAGE_SIZE,
    };
  }

  async function createFirstMessage(
    conversationId,
    character
  ) {
    const content =
      character.firstMessage ||
      `*${character.name} looks at you quietly.* “So, where should our story begin?”`;

    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .insert({
        conversation_id:
          conversationId,

        user_id: user.id,

        sender:
          "character",

        content,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return convertDatabaseMessage(
      data
    );
  }

  async function bumpStoryRevision(characterId) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId) return "";

    const storyRevision = crypto.randomUUID();
    const { error } = await supabase
      .from("conversations")
      .update({ story_revision: storyRevision, updated_at: new Date().toISOString() })
      .eq("id", conversation.conversationId)
      .eq("user_id", user.id);
    if (error) throw error;

    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        storyRevision,
      },
    }));
    return storyRevision;
  }

  async function addMessage(
    characterId,
    sender,
    content,
    options = {}
  ) {
    const conversation =
      chats[characterId];

    if (
      !conversation
        ?.conversationId
    ) {
      throw new Error(
        "The conversation is not ready yet."
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .insert({
        conversation_id:
          conversation
            .conversationId,

        user_id:
          user.id,

        sender,

        content:
          content.trim(),

        reply_to_message_id: options.replyToMessageId || null,
        reply_preview: options.replyPreview ? String(options.replyPreview).slice(0, 280) : null,
        reply_sender: options.replySender || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const newMessage =
      convertDatabaseMessage(
        data
      );

    appendMessageToState(
      characterId,
      newMessage
    );

    if (sender === "user") {
      // Every new canonical user turn gets a fresh revision token. Background
      // state writers from an older turn are then unable to overwrite it.
      await bumpStoryRevision(characterId);
    } else {
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversation.conversationId)
        .eq("user_id", user.id);
    }

    return newMessage;
  }

  async function generateCharacterReply(
    characterId,
    options = {}
  ) {
    const conversation = chats[characterId];

    if (!conversation?.conversationId) {
      throw new Error("The conversation is not ready yet.");
    }

    if (options.regenerateMessageId) {
      // A regeneration changes the canonical visible response. Bump the story
      // revision first so older background tasks cannot resurrect the rejected take.
      await bumpStoryRevision(characterId);
    }

    const requestController = new AbortController();
    const requestId = crypto.randomUUID();
    const generationId = crypto.randomUUID();
    const streamMessageId = `stream-${crypto.randomUUID()}`;
    const requestStartedAt = Date.now();
    let streamStarted = false;
    let completeContent = "";
    let finalMessage = null;
    let streamError = "";
    let reader = null;

    // A stale UI-only stream from an interrupted request must never block
    // future sends. The database contains only completed messages.
    setChats((currentChats) => {
      const currentChat = currentChats[characterId];
      if (!currentChat) return currentChats;
      return {
        ...currentChats,
        [characterId]: {
          ...currentChat,
          messages: (currentChat.messages || []).filter((item) => !item.isStreaming),
        },
      };
    });

    const previousRequest = activeRequests.current[characterId];
    if (previousRequest) {
      previousRequest.cancelled = true;
      void sendServerCancellation(previousRequest.generationId, characterId);
      try {
        previousRequest.controller.abort();
      } catch {
        // Already closed.
      }
    }

    activeRequests.current[characterId] = {
      controller: requestController,
      requestId,
      generationId,
      cancelled: false,
    };

    setGenerationStates((current) => ({
      ...current,
      [characterId]: "generating",
    }));

    function requestWasCancelled() {
      const active = activeRequests.current[characterId];
      return (
        requestController.signal.aborted ||
        active?.requestId !== requestId ||
        active?.cancelled === true
      );
    }

    function cleanupStreamingBubble() {
      if (!streamStarted) return;
      removeMessageFromState(characterId, streamMessageId);
      streamStarted = false;
    }

    function clearRequestTracking() {
      if (activeRequests.current[characterId]?.requestId !== requestId) {
        return;
      }

      delete activeRequests.current[characterId];

      setGenerationStates((current) => ({
        ...current,
        [characterId]: "idle",
      }));
    }

    function cancellationError() {
      return new DOMException("Generation cancelled", "AbortError");
    }

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionData?.session?.access_token
      ) {
        throw new Error("Your session expired. Sign in again.");
      }

      if (requestWasCancelled()) {
        throw cancellationError();
      }

      const functionUrl = getCharacterChatUrl();
      const publishableKey = getBrowserPublishableKey();

      let response;

      try {
        response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
            ...(publishableKey ? { apikey: publishableKey } : {}),
          },
          body: JSON.stringify({
            conversationId: conversation.conversationId,
            regenerateMessageId: options.regenerateMessageId || null,
            regenerationInstruction: options.instruction?.trim() || "",
            directorInstruction: options.directorInstruction?.trim() || "",
            generationId,
          }),
          signal: requestController.signal,
        });
      } catch (error) {
        if (requestWasCancelled() || error?.name === "AbortError") {
          throw cancellationError();
        }
        throw error;
      }

      if (response.status === 499) {
        throw cancellationError();
      }

      if (!response.ok) {
        const message = await readStreamingError(response);
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("The AI returned an empty response.");
      }

      if (options.regenerateMessageId) {
        removeMessageFromState(characterId, options.regenerateMessageId);
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processRawEvent = (rawEvent) => {
        const dataLines = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());

        for (const dataLine of dataLines) {
          if (!dataLine) continue;

          let eventData;
          try {
            eventData = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (eventData.type === "start") {
            setChats((currentChats) => ({
              ...currentChats,
              [characterId]: {
                ...currentChats[characterId],
                memoryUsage: {
                  count: Number(eventData.memoryCount || 0),
                  pinned: Number(eventData.pinnedMemoryCount || 0),
                  items: Array.isArray(eventData.memoryItems) ? eventData.memoryItems : [],
                },
                loreUsage: {
                  count: Number(eventData.loreCount || 0),
                  items: Array.isArray(eventData.loreItems) ? eventData.loreItems : [],
                },
              },
            }));
            continue;
          }

          if (eventData.type === "chunk") {
            if (requestWasCancelled()) continue;

            const chunk = String(eventData.content || "");
            if (!chunk) continue;

            completeContent += chunk;

            if (!streamStarted) {
              streamStarted = true;
              appendMessageToState(characterId, {
                id: streamMessageId,
                conversationId: conversation.conversationId,
                userId: user.id,
                sender: "character",
                content: completeContent,
                createdAt: new Date().toISOString(),
                isStreaming: true,
              });
            } else {
              updateStreamingMessage(characterId, streamMessageId, completeContent);
            }

            continue;
          }

          if (eventData.type === "done") {
            if (requestWasCancelled()) continue;

            finalMessage = convertDatabaseMessage(eventData.message);

            if (streamStarted) {
              replaceStreamingMessage(characterId, streamMessageId, finalMessage);
              streamStarted = false;
            } else {
              appendMessageToState(characterId, finalMessage);
            }

            continue;
          }

          if (eventData.type === "error") {
            streamError = eventData.error || "The character couldn't respond.";
          }
        }
      };

      while (true) {
        if (requestWasCancelled()) {
          throw cancellationError();
        }

        let result;
        try {
          // A broken mobile connection must not leave the composer busy forever.
          // The server normally emits the complete reply stream within seconds
          // once headers arrive, so prolonged silence means the stream stalled.
          result = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
              () => reject(new Error("The response stream stalled. Please try again.")),
              30000
            );

            reader.read().then(
              (value) => {
                clearTimeout(timeoutId);
                resolve(value);
              },
              (error) => {
                clearTimeout(timeoutId);
                reject(error);
              }
            );
          });
        } catch (error) {
          if (requestWasCancelled() || error?.name === "AbortError") {
            throw cancellationError();
          }
          try {
            await reader.cancel();
          } catch {
            // Reader may already be closed.
          }
          throw error;
        }

        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          processRawEvent(rawEvent);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        processRawEvent(buffer);
      }

      if (requestWasCancelled()) {
        throw cancellationError();
      }

      if (streamError) {
        throw new Error(streamError);
      }

      if (!finalMessage) {
        // Mobile networks can occasionally close the SSE connection after the
        // Edge Function has already saved the reply but before the final
        // `done` event reaches the browser. Recover from the database instead
        // of leaving the UI in a broken/busy state.
        cleanupStreamingBubble();

        const refreshedMessages = await reloadConversationMessages(characterId);
        const recoveredMessage = [...refreshedMessages]
          .reverse()
          .find(
            (item) =>
              item.sender === "character" &&
              new Date(item.createdAt || 0).getTime() >= requestStartedAt - 1500
          );

        if (recoveredMessage) {
          finalMessage = recoveredMessage;
        } else {
          throw new Error("The response ended before it could be saved.");
        }
      }

      return {
        message: finalMessage,
        memories: [],
      };
    } catch (error) {
      cleanupStreamingBubble();

      if (requestWasCancelled() || error?.name === "AbortError") {
        throw cancellationError();
      }

      throw error;
    } finally {
      if (reader && requestWasCancelled()) {
        try {
          await reader.cancel();
        } catch {
          // Reader can already be closed.
        }
      }

      // This always runs, including network errors and malformed streams.
      // It is the key guarantee that a failed reply cannot lock the composer.
      clearRequestTracking();
    }
  }

  async function findConversationById(conversationId, characterId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("character_id", characterId)
      .single();

    if (error) throw error;
    return data;
  }

  async function createNewConversation(character) {
    return startConversation(character, { forceNew: true });
  }

  async function sendServerCancellation(generationId, characterId) {
    if (!generationId) return;

    const delays = [0, 140, 420];
    const functionUrl = getCharacterChatUrl();
    const publishableKey = getBrowserPublishableKey();

    for (const delayMs of delays) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return;

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(publishableKey ? { apikey: publishableKey } : {}),
          },
          body: JSON.stringify({
            action: "cancel",
            generationId,
            conversationId: chats[characterId]?.conversationId || null,
          }),
        });

        if (response.ok) return;
      } catch (error) {
        console.warn("Could not send generation cancellation:", error);
      }
    }
  }

  function stopGeneration(characterId) {
    const activeRequest = activeRequests.current[characterId];

    if (activeRequest) {
      activeRequest.cancelled = true;

      setGenerationStates((current) => ({
        ...current,
        [characterId]: "stopping",
      }));

      // Persist explicit Stop for the Edge Function, independently from the
      // browser's network connection.
      void sendServerCancellation(activeRequest.generationId, characterId);

      try {
        activeRequest.controller.abort();
      } catch {
        // Already closed.
      }

      // The active request owns final cleanup. We can unlock the composer now;
      // its late finally cannot affect a newer request because requestId is checked.
      if (activeRequests.current[characterId]?.requestId === activeRequest.requestId) {
        delete activeRequests.current[characterId];
      }
    }

    setGenerationStates((current) => ({
      ...current,
      [characterId]: "idle",
    }));

    setChats((currentChats) => {
      const currentChat = currentChats[characterId];
      if (!currentChat) return currentChats;

      return {
        ...currentChats,
        [characterId]: {
          ...currentChat,
          messages: (currentChat.messages || []).filter(
            (item) => !item.isStreaming
          ),
        },
      };
    });
  }

  async function updateConversationSettings(characterId, changes) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId) throw new Error("The conversation is not ready yet.");

    const databaseChanges = {};
    if (Object.hasOwn(changes, "title")) databaseChanges.title = changes.title.trim();
    if (Object.hasOwn(changes, "responseLengthOverride")) databaseChanges.response_length_override = changes.responseLengthOverride || null;
    if (Object.hasOwn(changes, "narrationStyleOverride")) databaseChanges.narration_style_override = changes.narrationStyleOverride || null;
    if (Object.hasOwn(changes, "creativity")) databaseChanges.creativity = Number(changes.creativity);
    if (Object.hasOwn(changes, "romanceIntensity")) databaseChanges.romance_intensity = clampControl(changes.romanceIntensity);
    if (Object.hasOwn(changes, "initiative")) databaseChanges.initiative = clampControl(changes.initiative);
    if (Object.hasOwn(changes, "drama")) databaseChanges.drama = clampControl(changes.drama);
    if (Object.hasOwn(changes, "flirting")) databaseChanges.flirting = clampControl(changes.flirting);
    if (Object.hasOwn(changes, "humor")) databaseChanges.humor = clampControl(changes.humor);
    if (Object.hasOwn(changes, "descriptionLevel")) databaseChanges.description_level = clampControl(changes.descriptionLevel);
    if (Object.hasOwn(changes, "characterIndependence")) databaseChanges.character_independence = clampControl(changes.characterIndependence);
    if (Object.hasOwn(changes, "dialogueFrequency")) databaseChanges.dialogue_frequency = clampControl(changes.dialogueFrequency);
    if (Object.hasOwn(changes, "narrativeCamera")) databaseChanges.narrative_camera = ["user_focused", "balanced", "cinematic"].includes(changes.narrativeCamera) ? changes.narrativeCamera : "balanced";
    if (Object.hasOwn(changes, "innerThoughts")) databaseChanges.inner_thoughts = ["none", "rare", "important", "sometimes", "literary", "frequent"].includes(changes.innerThoughts) ? changes.innerThoughts : "rare";
    if (Object.hasOwn(changes, "storyPreset")) databaseChanges.story_preset = ["natural", "romantic", "dramatic", "slow_burn"].includes(changes.storyPreset) ? changes.storyPreset : "natural";
    if (Object.hasOwn(changes, "pacingMode")) databaseChanges.pacing_mode = ["quick", "natural", "cinematic"].includes(changes.pacingMode) ? changes.pacingMode : "natural";
    if (Object.hasOwn(changes, "personaId")) databaseChanges.persona_id = changes.personaId || null;
    if (Object.hasOwn(changes, "lorebookId")) databaseChanges.lorebook_id = changes.lorebookId || null;

    const { data, error } = await supabase.from("conversations")
      .update(databaseChanges).eq("id", conversation.conversationId).select().single();
    if (error) throw error;

    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        title: data.title,
        responseLengthOverride: data.response_length_override || "",
        narrationStyleOverride: data.narration_style_override || "",
        creativity: Number(data.creativity ?? 0.84),
        romanceIntensity: Number(data.romance_intensity ?? 35),
        initiative: Number(data.initiative ?? 65),
        drama: Number(data.drama ?? 45),
        flirting: Number(data.flirting ?? 30),
        humor: Number(data.humor ?? 45),
        descriptionLevel: Number(data.description_level ?? 55),
        characterIndependence: Number(data.character_independence ?? 80),
        dialogueFrequency: Number(data.dialogue_frequency ?? 55),
        narrativeCamera: data.narrative_camera || "balanced",
        innerThoughts: data.inner_thoughts || "rare",
        storyPreset: data.story_preset || "natural",
        pacingMode: data.pacing_mode || "natural",
        sceneState: data.scene_state || currentChats[characterId]?.sceneState || {},
        relationshipState: data.relationship_state || currentChats[characterId]?.relationshipState || {},
        castState: data.cast_state || currentChats[characterId]?.castState || {},
        storyChapters: Array.isArray(data.story_chapters) ? data.story_chapters : (currentChats[characterId]?.storyChapters || []),
        activeChapter: data.active_chapter || currentChats[characterId]?.activeChapter || {},
        storyTimeline: Array.isArray(data.story_timeline) ? data.story_timeline : (currentChats[characterId]?.storyTimeline || []),
        personaId: data.persona_id || "",
        lorebookId: data.lorebook_id || "",
      },
    }));
    return data;
  }

  async function deleteMessage(characterId, messageId) {
    stopGeneration(characterId);
    const currentMessages = chats[characterId]?.messages || [];
    const targetMessage = currentMessages.find((message) => message.id === messageId) || null;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("user_id", user.id);

    if (error) throw error;
    removeMessageFromState(characterId, messageId);

    // Deleting a visible event invalidates hidden summaries/state too. Without
    // this, the model can keep talking about a message that no longer exists.
    if (targetMessage) await pruneConversationAfterMessage(characterId, targetMessage, { clearAllAutomaticMemories: true });
  }

  async function updateMessage(characterId, messageId, content) {
    const cleanContent = content.trim();
    if (!cleanContent) throw new Error("A message cannot be empty.");

    const { data, error } = await supabase
      .from("messages")
      .update({ content: cleanContent, edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .select()
      .single();

    if (error) throw error;
    const updatedMessage = convertDatabaseMessage(data);

    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        messages: (currentChats[characterId]?.messages || []).map((message) =>
          message.id === messageId ? updatedMessage : message
        ),
      },
    }));

    return updatedMessage;
  }

  async function pruneConversationAfterMessage(characterId, message, options = {}) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId || !message?.createdAt) return;

    // Memories extracted after a rewind/edit can describe events that no longer
    // exist. Remove those future memories and clear the stale summary.
    let memoryQuery = supabase
      .from("memories")
      .delete()
      .eq("conversation_id", conversation.conversationId)
      .eq("source", "automatic");

    if (!options.clearAllAutomaticMemories) {
      memoryQuery = memoryQuery.gt("created_at", message.createdAt);
    }
    const { error: memoryError } = await memoryQuery;

    if (memoryError) {
      console.warn("Could not prune future memories:", memoryError);
    }

    // Rewind must invalidate every derived story cache that may contain facts
    // from messages that no longer exist. Keeping these fields was causing the
    // model to resurrect deleted scenes, conflicts and unfinished topics.
    const storyRevision = crypto.randomUUID();
    const clearedDerivedState = {
      story_revision: storyRevision,
      summary: null,
      scene_state: {},
      story_timeline: [],
      relationship_state: {},
      cast_state: {},
      story_chapters: [],
      active_chapter: {},
      unresolved_threads: [],
      scene_state_updated_at: null,
      updated_at: new Date().toISOString(),
    };

    const { error: conversationError } = await supabase
      .from("conversations")
      .update(clearedDerivedState)
      .eq("id", conversation.conversationId)
      .eq("user_id", user.id);

    if (conversationError) {
      console.warn("Could not clear derived story state after rewind:", conversationError);
      throw conversationError;
    }

    // Keep the in-memory conversation consistent with Supabase immediately.
    // The next generation will rebuild fresh state only from surviving
    // messages + surviving memories instead of stale deleted-story metadata.
    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        summary: "",
        sceneState: {},
        storyTimeline: [],
        relationshipState: {},
        castState: {},
        storyChapters: [],
        activeChapter: {},
        unfinishedThreads: [],
        storyRevision,
      },
    }));
  }

  async function editMessageAndRemoveFollowing(characterId, messageId, content) {
    stopGeneration(characterId);
    const currentMessages = chats[characterId]?.messages || [];
    const messageIndex = currentMessages.findIndex((message) => message.id === messageId);
    if (messageIndex === -1) throw new Error("Message not found.");

    const followingIds = currentMessages
      .slice(messageIndex + 1)
      .filter((message) => !message.isStreaming)
      .map((message) => message.id);

    const updatedMessage = await updateMessage(characterId, messageId, content);

    if (followingIds.length) {
      const { error } = await supabase.from("messages").delete().in("id", followingIds);
      if (error) throw error;
    }

    await pruneConversationAfterMessage(characterId, updatedMessage);

    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        messages: [
          ...(currentChats[characterId]?.messages || []).slice(0, messageIndex),
          updatedMessage,
        ],
      },
    }));

    return updatedMessage;
  }

  async function rewindToMessage(characterId, messageId) {
    stopGeneration(characterId);
    const currentMessages = chats[characterId]?.messages || [];
    const messageIndex = currentMessages.findIndex((message) => message.id === messageId);
    if (messageIndex === -1) throw new Error("Message not found.");

    const targetMessage = currentMessages[messageIndex];
    const followingIds = currentMessages
      .slice(messageIndex + 1)
      .filter((message) => !message.isStreaming)
      .map((message) => message.id);

    if (followingIds.length) {
      const { error } = await supabase.from("messages").delete().in("id", followingIds);
      if (error) throw error;
    }

    await pruneConversationAfterMessage(characterId, targetMessage);

    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        messages: (currentChats[characterId]?.messages || []).slice(0, messageIndex + 1),
      },
    }));
  }

  async function branchConversationFromMessage(characterId, messageId, label = "") {
    const conversation = chats[characterId];
    const currentMessages = conversation?.messages || [];
    const messageIndex = currentMessages.findIndex((message) => message.id === messageId);
    if (!conversation?.conversationId || messageIndex === -1) throw new Error("Message not found.");

    const sourceMessage = currentMessages[messageIndex];
    const branchTitle = label.trim() || `${conversation.title || "Story"} · branch`;

    const { data: sourceRows, error: sourceRowsError } = await supabase
      .from("messages")
      .select("sender, content, created_at, edited_at, reply_to_message_id, reply_preview, reply_sender")
      .eq("conversation_id", conversation.conversationId)
      .lte("created_at", sourceMessage.createdAt)
      .order("created_at", { ascending: true });
    if (sourceRowsError) throw sourceRowsError;
    const branchMessages = sourceRows || [];

    const { data: branchConversation, error: branchError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        character_id: characterId,
        title: branchTitle.slice(0, 80),
        persona_id: conversation.personaId || null,
        lorebook_id: conversation.lorebookId || null,
        response_length_override: conversation.responseLengthOverride || null,
        narration_style_override: conversation.narrationStyleOverride || null,
        creativity: Number(conversation.creativity ?? 0.84),
        romance_intensity: Number(conversation.romanceIntensity ?? 35),
        initiative: Number(conversation.initiative ?? 65),
        drama: Number(conversation.drama ?? 45),
        flirting: Number(conversation.flirting ?? 30),
        humor: Number(conversation.humor ?? 45),
        description_level: Number(conversation.descriptionLevel ?? 55),
        character_independence: Number(conversation.characterIndependence ?? 80),
        dialogue_frequency: Number(conversation.dialogueFrequency ?? 55),
        narrative_camera: conversation.narrativeCamera || "balanced",
        inner_thoughts: conversation.innerThoughts || "rare",
        story_preset: conversation.storyPreset || "natural",
        pacing_mode: conversation.pacingMode || "natural",
        // Derived story state can describe events after the branch point. Start
        // the branch clean and let the story engine rebuild it from the copied
        // messages/memories instead of leaking the source timeline's future.
        summary: null,
        scene_state: {},
        story_timeline: [],
        relationship_state: {},
        cast_state: {},
        story_chapters: [],
        active_chapter: {},
        unresolved_threads: [],
        story_engine_version: 7,
        branch_parent_id: conversation.conversationId,
        branch_from_message_id: sourceMessage.id,
        branch_label: branchTitle.slice(0, 80),
      })
      .select()
      .single();

    if (branchError || !branchConversation) throw branchError || new Error("Could not create branch.");

    const branchBaseTime = Date.now();
    const rows = branchMessages.map((message, index) => ({
      conversation_id: branchConversation.id,
      user_id: user.id,
      sender: message.sender,
      content: message.content,
      created_at: new Date(branchBaseTime + index).toISOString(),
      edited_at: message.edited_at || null,
      // Message ids change in the new conversation, so do not carry an old
      // cross-conversation reply pointer. The preview still preserves context.
      reply_to_message_id: null,
      reply_preview: message.reply_preview || null,
      reply_sender: message.reply_sender || null,
    }));

    if (rows.length) {
      const { error: messageError } = await supabase.from("messages").insert(rows);
      if (messageError) {
        await supabase.from("conversations").delete().eq("id", branchConversation.id);
        throw messageError;
      }
    }

    // Carry only memories that already existed at the branch point. Later
    // timeline memories must never leak into the new branch. Character-scoped
    // memories are shared automatically and are not duplicated here.
    const { data: sourceMemories, error: sourceMemoryError } = await supabase
      .from("memories")
      .select("content, importance, category, is_pinned, source, created_at")
      .eq("conversation_id", conversation.conversationId)
      .eq("scope", "conversation")
      .lte("created_at", sourceMessage.createdAt);

    if (!sourceMemoryError && sourceMemories?.length) {
      const memoryRows = sourceMemories.map((memory) => ({
        conversation_id: branchConversation.id,
        character_id: characterId,
        user_id: user.id,
        content: memory.content,
        importance: memory.importance,
        category: memory.category,
        is_pinned: memory.is_pinned,
        source: memory.source,
        scope: "conversation",
      }));
      const { error: copyMemoryError } = await supabase.from("memories").insert(memoryRows);
      if (copyMemoryError) console.warn("Could not copy branch memories:", copyMemoryError);
    }

    return branchConversation;
  }

  async function regenerateCharacterReply(characterId, messageId, instruction = "") {
    return generateCharacterReply(characterId, {
      regenerateMessageId: messageId,
      instruction,
    });
  }

  async function saveMessageAsMemory(characterId, content) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId) throw new Error("The conversation is not ready yet.");

    const { data, error } = await supabase
      .from("memories")
      .insert({
        conversation_id: conversation.conversationId,
        character_id: characterId,
        user_id: user.id,
        content: content.trim(),
        importance: 5,
        category: "event",
        is_pinned: true,
        source: "manual",
        scope: "conversation",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function getMessageAlternatives(messageId) {
    const { data, error } = await supabase
      .from("message_alternatives")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function selectMessageAlternative(characterId, messageId, content) {
    stopGeneration(characterId);
    const updated = await updateMessage(characterId, messageId, content);
    await pruneConversationAfterMessage(characterId, updated);
    return updated;
  }

  function appendMessageToState(
    characterId,
    newMessage
  ) {
    setChats(
      (currentChats) => {
        const currentMessages =
          currentChats[
            characterId
          ]?.messages || [];

        const alreadyExists =
          currentMessages.some(
            (chatMessage) =>
              chatMessage.id ===
              newMessage.id
          );

        if (alreadyExists) {
          return currentChats;
        }

        return {
          ...currentChats,

          [characterId]: {
            ...currentChats[
              characterId
            ],

            messages: [
              ...currentMessages,
              newMessage,
            ],
          },
        };
      }
    );
  }

  function updateStreamingMessage(
    characterId,
    streamMessageId,
    content
  ) {
    setChats(
      (currentChats) => ({
        ...currentChats,

        [characterId]: {
          ...currentChats[
            characterId
          ],

          messages: (
            currentChats[
              characterId
            ]?.messages || []
          ).map(
            (chatMessage) =>
              chatMessage.id ===
              streamMessageId
                ? {
                    ...chatMessage,
                    content,
                  }
                : chatMessage
          ),
        },
      })
    );
  }

  function replaceStreamingMessage(
    characterId,
    streamMessageId,
    finalMessage
  ) {
    setChats(
      (currentChats) => {
        const currentMessages =
          currentChats[
            characterId
          ]?.messages || [];

        const finalAlreadyExists =
          currentMessages.some(
            (chatMessage) =>
              chatMessage.id ===
              finalMessage.id
          );

        return {
          ...currentChats,

          [characterId]: {
            ...currentChats[
              characterId
            ],

            messages:
              finalAlreadyExists
                ? currentMessages
                    .filter(
                      (chatMessage) =>
                        chatMessage.id !==
                        streamMessageId
                    )
                : currentMessages
                    .map(
                      (chatMessage) =>
                        chatMessage.id ===
                        streamMessageId
                          ? finalMessage
                          : chatMessage
                    ),
          },
        };
      }
    );
  }

  function removeMessageFromState(
    characterId,
    messageId
  ) {
    setChats(
      (currentChats) => ({
        ...currentChats,

        [characterId]: {
          ...currentChats[
            characterId
          ],

          messages: (
            currentChats[
              characterId
            ]?.messages || []
          ).filter(
            (chatMessage) =>
              chatMessage.id !==
              messageId
          ),
        },
      })
    );
  }

  async function reloadConversationMessages(
    characterId
  ) {
    const conversation =
      chats[characterId];

    if (
      !conversation
        ?.conversationId
    ) {
      return [];
    }

    const page = await loadConversationMessages(conversation.conversationId);

    setChats(
      (currentChats) => ({
        ...currentChats,

        [characterId]: {
          ...currentChats[
            characterId
          ],

          messages: page.messages,
          hasMoreMessages: page.hasMore,
          loadingEarlierMessages: false,
        },
      })
    );

    return page.messages;
  }

  async function loadEarlierMessages(characterId) {
    const conversation = chats[characterId];
    const currentMessages = conversation?.messages || [];
    const oldestMessage = currentMessages.find((message) => !message.isStreaming);

    if (
      !conversation?.conversationId ||
      !conversation.hasMoreMessages ||
      conversation.loadingEarlierMessages ||
      !oldestMessage?.createdAt
    ) {
      return [];
    }

    setChats((currentChats) => ({
      ...currentChats,
      [characterId]: {
        ...currentChats[characterId],
        loadingEarlierMessages: true,
      },
    }));

    try {
      const page = await loadConversationMessages(conversation.conversationId, {
        before: oldestMessage.createdAt,
      });

      setChats((currentChats) => {
        const existingMessages = currentChats[characterId]?.messages || [];
        const existingIds = new Set(existingMessages.map((message) => message.id));
        const earlierMessages = page.messages.filter((message) => !existingIds.has(message.id));

        return {
          ...currentChats,
          [characterId]: {
            ...currentChats[characterId],
            messages: [...earlierMessages, ...existingMessages],
            hasMoreMessages: page.hasMore,
            loadingEarlierMessages: false,
          },
        };
      });

      return page.messages;
    } catch (error) {
      setChats((currentChats) => ({
        ...currentChats,
        [characterId]: {
          ...currentChats[characterId],
          loadingEarlierMessages: false,
        },
      }));
      throw error;
    }
  }

  async function refreshStoryMetadata(characterId) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId) return null;
    const { data, error } = await supabase
      .from("conversations")
      .select("scene_state, story_timeline, summary, story_preset, pacing_mode, relationship_state, cast_state, story_chapters, active_chapter, unresolved_threads, story_engine_version, story_revision, updated_at")
      .eq("id", conversation.conversationId)
      .single();
    if (error) throw error;
    setChats((current) => ({
      ...current,
      [characterId]: {
        ...current[characterId],
        sceneState: data.scene_state || {},
        storyTimeline: Array.isArray(data.story_timeline) ? data.story_timeline : [],
        summary: data.summary || current[characterId]?.summary || "",
        storyPreset: data.story_preset || current[characterId]?.storyPreset || "natural",
        pacingMode: data.pacing_mode || current[characterId]?.pacingMode || "natural",
        relationshipState: data.relationship_state || current[characterId]?.relationshipState || {},
        castState: data.cast_state || current[characterId]?.castState || {},
        storyChapters: Array.isArray(data.story_chapters) ? data.story_chapters : (current[characterId]?.storyChapters || []),
        activeChapter: data.active_chapter || current[characterId]?.activeChapter || {},
        unfinishedThreads: Array.isArray(data.unresolved_threads) ? data.unresolved_threads : (current[characterId]?.unfinishedThreads || []),
        storyEngineVersion: Number(data.story_engine_version || 7),
      },
    }));
    return data;
  }

  async function toggleMessageBookmark(characterId, messageId, label = "") {
    const currentMessages = chats[characterId]?.messages || [];
    const target = currentMessages.find((item) => item.id === messageId);
    if (!target) throw new Error("Message not found.");
    const nextValue = !target.isBookmarked;
    const { data, error } = await supabase.from("messages")
      .update({ is_bookmarked: nextValue, bookmark_label: nextValue ? (label.trim().slice(0, 120) || null) : null })
      .eq("id", messageId)
      .select()
      .single();
    if (error) throw error;
    const updated = convertDatabaseMessage(data);
    setChats((current) => ({
      ...current,
      [characterId]: {
        ...current[characterId],
        messages: (current[characterId]?.messages || []).map((item) => item.id === messageId ? updated : item),
      },
    }));
    return updated;
  }

  async function searchConversationMessages(characterId, query) {
    const conversationId = chats[characterId]?.conversationId;
    const clean = String(query || "").trim();
    if (!conversationId || clean.length < 2) return [];
    const escaped = clean.replace(/[%_]/g, "\$&");
    const { data, error } = await supabase.from("messages")
      .select("id, sender, content, created_at, edited_at, is_bookmarked, bookmark_label, chapter_number, reply_to_message_id, reply_preview, reply_sender")
      .eq("conversation_id", conversationId)
      .ilike("content", `%${escaped}%`)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return (data || []).map(convertDatabaseMessage);
  }

  async function loadMessageIntoView(characterId, messageId) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId || !messageId) return null;
    const { data: target, error: targetError } = await supabase.from("messages")
      .select("id, sender, content, created_at, edited_at, is_bookmarked, bookmark_label, chapter_number, reply_to_message_id, reply_preview, reply_sender")
      .eq("id", messageId)
      .eq("conversation_id", conversation.conversationId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return null;
    const { data: around, error } = await supabase.from("messages")
      .select("id, sender, content, created_at, edited_at, is_bookmarked, bookmark_label, chapter_number, reply_to_message_id, reply_preview, reply_sender")
      .eq("conversation_id", conversation.conversationId)
      .gte("created_at", target.created_at)
      .order("created_at", { ascending: true })
      .limit(80);
    if (error) throw error;
    const incoming = (around || []).map(convertDatabaseMessage);
    setChats((current) => {
      const existing = current[characterId]?.messages || [];
      const map = new Map(existing.filter((item) => !item.isStreaming).map((item) => [item.id, item]));
      incoming.forEach((item) => map.set(item.id, item));
      const merged = [...map.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return { ...current, [characterId]: { ...current[characterId], messages: merged } };
    });
    return convertDatabaseMessage(target);
  }

  async function getStoryHubData(characterId) {
    const conversation = chats[characterId];
    if (!conversation?.conversationId) return { bookmarks: [], branches: [], chapters: [], cast: {}, relationship: {}, unfinishedThreads: [] };
    const [bookmarksResult, branchesResult, currentResult] = await Promise.all([
      supabase.from("messages")
        .select("id, sender, content, created_at, is_bookmarked, bookmark_label, chapter_number")
        .eq("conversation_id", conversation.conversationId)
        .eq("is_bookmarked", true)
        .order("created_at", { ascending: false }),
      supabase.from("conversations")
        .select("id, title, branch_parent_id, branch_from_message_id, branch_label, updated_at")
        .eq("character_id", characterId)
        .or(`id.eq.${conversation.conversationId},branch_parent_id.eq.${conversation.conversationId},id.eq.${conversation.branchParentId || conversation.conversationId}`)
        .order("updated_at", { ascending: false }),
      supabase.from("conversations")
        .select("relationship_state, cast_state, story_chapters, active_chapter, unresolved_threads, pacing_mode, story_engine_version, story_revision")
        .eq("id", conversation.conversationId)
        .single(),
    ]);
    if (bookmarksResult.error) throw bookmarksResult.error;
    if (branchesResult.error) console.warn("Could not load branches:", branchesResult.error);
    if (currentResult.error) throw currentResult.error;
    return {
      bookmarks: (bookmarksResult.data || []).map(convertDatabaseMessage),
      branches: branchesResult.data || [],
      chapters: Array.isArray(currentResult.data?.story_chapters) ? currentResult.data.story_chapters : [],
      activeChapter: currentResult.data?.active_chapter || {},
      cast: currentResult.data?.cast_state || {},
      relationship: currentResult.data?.relationship_state || {},
      unfinishedThreads: Array.isArray(currentResult.data?.unresolved_threads) ? currentResult.data.unresolved_threads : [],
      pacingMode: currentResult.data?.pacing_mode || "natural",
      storyEngineVersion: Number(currentResult.data?.story_engine_version || 7),
      storyRevision: currentResult.data?.story_revision || "",
    };
  }

  async function deleteConversation(
    characterId
  ) {
    const conversationId =
      chats[characterId]
        ?.conversationId;

    if (!conversationId) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("conversations")
      .delete()
      .eq(
        "id",
        conversationId
      );

    if (error) {
      throw error;
    }

    setChats(
      (currentChats) => {
        const updatedChats = {
          ...currentChats,
        };

        delete updatedChats[
          characterId
        ];

        return updatedChats;
      }
    );
  }

  return (
    <ChatsContext.Provider
      value={{
        chats,
        getCharacterMessages,
        getConversation,
        isConversationLoading,
        isCharacterStreaming,
        getGenerationState,
        isCharacterGenerating,
        startConversation,
        createNewConversation,
        addMessage,
        generateCharacterReply,
        stopGeneration,
        updateConversationSettings,
        deleteMessage,
        updateMessage,
        editMessageAndRemoveFollowing,
        rewindToMessage,
        branchConversationFromMessage,
        regenerateCharacterReply,
        saveMessageAsMemory,
        getMessageAlternatives,
        selectMessageAlternative,
        loadEarlierMessages,
        reloadConversationMessages,
        refreshStoryMetadata,
        toggleMessageBookmark,
        searchConversationMessages,
        loadMessageIntoView,
        getStoryHubData,
        deleteConversation,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}

function createConversationTitle() {
  const now = new Date();
  const date = now.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `New story · ${date}, ${time}`;
}

function convertDatabaseMessage(
  message
) {
  return {
    id: message.id,

    conversationId:
      message
        .conversation_id,

    userId:
      message.user_id,

    sender:
      message.sender,

    content:
      message.content,

    createdAt:
      message.created_at,

    editedAt:
      message.edited_at || null,

    isBookmarked: Boolean(message.is_bookmarked),
    bookmarkLabel: message.bookmark_label || "",
    chapterNumber: message.chapter_number || null,
    replyToMessageId: message.reply_to_message_id || null,
    replyPreview: message.reply_preview || "",
    replySender: message.reply_sender || "",

    isStreaming: false,
  };
}

function clampControl(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function getCharacterChatUrl() {
  const supabaseUrl =
    import.meta.env
      .VITE_SUPABASE_URL ||
    supabase.supabaseUrl;

  if (!supabaseUrl) {
    throw new Error(
      "VITE_SUPABASE_URL is missing."
    );
  }

  return (
    `${supabaseUrl}` +
    "/functions/v1/character-chat"
  );
}

function getBrowserPublishableKey() {
  return (
    import.meta.env
      .VITE_SUPABASE_ANON_KEY ||

    import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY ||

    supabase.supabaseKey ||

    ""
  );
}

async function readStreamingError(
  response
) {
  try {
    const text =
      await response.text();

    if (!text) {
      return (
        `The AI request failed ` +
        `with status ${response.status}.`
      );
    }

    try {
      const parsed =
        JSON.parse(text);

      return (
        parsed?.error ||
        parsed
          ?.message ||
        text
      );
    } catch {
      return text;
    }
  } catch {
    return (
      `The AI request failed ` +
      `with status ${response.status}.`
    );
  }
}

export function useChats() {
  const context =
    useContext(
      ChatsContext
    );

  if (!context) {
    throw new Error(
      "useChats debe utilizarse dentro de ChatsProvider"
    );
  }

  return context;
}
