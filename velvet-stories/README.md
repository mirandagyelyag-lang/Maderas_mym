# Velvet Stories

Private AI roleplay/story PWA built with React, Vite, Supabase and Gemini.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase values.
2. Install dependencies with `npm ci`.
3. Run `npm run dev`.

## Production update

For this V7 rebuild, apply database migrations before deploying the Edge Function because the story engine now uses `conversations.story_revision` to invalidate abandoned timelines.

```bash
npx supabase db push
npx supabase functions deploy character-chat
npm run build
```

Then commit and push to `main` for the Vercel deployment.

## Core behavior

- The user owns their POV. The model may not invent the user's actions, dialogue, thoughts, feelings, reactions or decisions.
- Reader-facing narration defaults to second person (`you/your`).
- Communication medium is sticky and explicit: in-person, direct message, group chat or phone call.
- Markdown `>` is reserved for written digital messages only.
- Rewind/delete/edit invalidate derived story state and automatic memories so deleted timelines cannot leak back into future generations.
- Character response variants are navigable and regeneration rejects near-paraphrases of earlier variants.
- Rewind is the primary destructive timeline tool; old response variants should be rewound to before changing canon.

## Important files

- `src/context/ChatsContext.jsx`: conversation state, generation, Stop, Rewind, variants, memory operations.
- `src/pages/Chat.jsx`: chat UI, response-version navigation, swipe interactions and message actions.
- `supabase/functions/character-chat/index.ts`: story engine, medium routing, prompt, output guards, regeneration diversity and background state updates.
- `supabase/migrations/202608100001_story_revision_guard.sql`: timeline revision guard.

## Verification

Run:

```bash
bash VERIFY_VELVET_V7.sh
npm run build
```

`VERIFY_VELVET_V7.sh` checks the structural V7 safeguards. A successful local `npm run build` is still the final frontend build check.
