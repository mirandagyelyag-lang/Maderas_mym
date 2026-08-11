# Velvet Stories V7 audit

This rebuild was made from the full project folder rather than another incremental patch.

## High-impact fixes

### 1. Rewind/delete timeline resurrection
The old architecture allowed asynchronous story-state, summary and memory tasks to finish after a Rewind or Delete. Those stale tasks could write facts from an abandoned scene back into the conversation.

V7 adds a `story_revision` UUID to each conversation. Every canonical user turn/regeneration gets a new revision, and background writers may commit only if their revision is still current. Rewind/delete/edit/version selection also rotate the revision and clear derived state.

The server additionally refuses to save an in-flight character response if the story revision changed while Gemini was generating it.

### 2. Regeneration that only paraphrased itself
Regeneration now loads the current rejected answer plus earlier alternatives as negative examples. It checks sentence/opening/bigram similarity and can perform stronger diversity retries with a contrasting response strategy.

Only the latest character response exposes version-generation controls. Changing an older canonical beat requires Rewind first, preventing silent contradictions with later messages.

### 3. Medium confusion
The medium resolver now keeps `in_person`, `direct_message`, `group_chat` and `phone_call` sticky until the user actually changes medium. In-person cues override stale digital state. A deterministic output guard removes accidental Markdown blockquotes from spoken scenes and keeps actual DM/group-chat outputs inside the digital medium.

### 4. User POV protection
Second-person narration previously made some POV violations harder to detect. V7 checks second-person mental states, bodily reactions and user actions, while allowing actions the user explicitly established in their latest turn.

### 5. AI-looking prose
The story engine now explicitly rejects stock gesture chains, decorative room/object choreography, generic silence/darkness filler, over-explained subtext and malformed literary phrasing. A targeted natural-voice repair pass runs only when local heuristics detect a cluster of those symptoms.

### 6. Stop/cancellation
The browser now sends cancellation through the authenticated Edge Function instead of directly mutating the cancellation table. Timeline-destructive operations cancel any active request before modifying canon.

### 7. Authentication cleanup
The redundant custom localStorage copy of Supabase access/refresh tokens was removed. Supabase's own persisted session remains the source of truth, and the old duplicate cache is deleted on startup.

### 8. Gemini API compatibility
Deprecated sampling controls were removed from Gemini 3.5 Flash-Lite requests. The app's creativity control now changes explicit prompt guidance instead of API temperature/top-p values.

## Project cleanup

Removed old patch folders, generated audit/fix directories, Supabase temp linkage files, obsolete ZIPs, unused starter assets, duplicate login assets and stacks of version-specific README/verifier files.

Historical Supabase migrations were intentionally retained because they are database history, not disposable patch debris.
