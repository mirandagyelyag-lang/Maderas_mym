# Velvet Stories — Story Engine Fix

This build fixes the narrative engine without changing the app design.

## What changed

- Regeneration notes are now the highest-priority instruction for that alternate take.
- A regeneration note no longer forces `scene_shift` unless it actually requests a time or scene change.
- The same direction is repeated at the top of both the system instruction and turn prompt so it cannot be buried by memories, controls, or story metadata.
- Diversity retries must preserve the outcome requested by the user instead of choosing a conflicting direction.
- The engine may advance the present story through character decisions and consequences while still protecting established canon and user agency.
- Creativity now controls Gemini's generation temperature; alternate takes receive a small variation boost.
- Regeneration directions may contain up to 1,500 characters.
- Sending an empty message or `.` now triggers a voice-led continuation instead of another narration-only pause.
- Repeated dots are counted: the engine must change the beat, make a decision, close the interaction, or move the scene forward instead of recycling atmosphere.
- Existing silent-continuation messages from older versions remain hidden in the chat UI.
- A second consecutive dot automatically returns the camera to the main created character after a secondary-character beat, matching Character.AI-style continuation.
- Silent continuations now pass a server-side voice check. Narration-only drafts are discarded and regenerated before they can be shown; a failed second-dot return is rejected instead of displaying more secondary-character filler.
- When the main character has already walked away and the user reacts from too far away to be heard, the engine follows the main character and enforces a private emotional beat instead of describing the empty setting left behind.

## Publish the update

From Git Bash inside the project folder:

```bash
npm install
npx supabase functions deploy character-chat
git add .
git commit -m "Fix Velvet story engine and regeneration"
git push origin main
```

The narrative changes live in the Supabase Edge Function, so deploying only to Vercel is not enough. The Git push publishes the web project through the existing Vercel connection; the Supabase command publishes the new roleplay engine.
