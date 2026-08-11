#!/usr/bin/env bash
set -euo pipefail

EDGE="supabase/functions/character-chat/index.ts"
CHATS="src/context/ChatsContext.jsx"
CHAT="src/pages/Chat.jsx"
MIG="supabase/migrations/202608100001_story_revision_guard.sql"

echo "=== Velvet Stories V7 structural verification ==="

test -f "$EDGE"
test -f "$CHATS"
test -f "$CHAT"
test -f "$MIG"

grep -q "story_revision" "$EDGE"
grep -q "story_revision" "$CHATS"
grep -q "isStoryRevisionCurrent" "$EDGE"
grep -q "SCENE MEDIUM LOCK" "$EDGE"
grep -q "NATURAL ENGLISH GUARD" "$EDGE"
grep -q "likelyControlsUserPOV" "$EDGE"
grep -q "isTooSimilarRegeneration" "$EDGE"
grep -q "rejectedVariants" "$EDGE"
grep -q "versionNavigationEnabled" "$CHAT"
grep -q "Rewind to here" "$CHAT"
grep -q 'action: "cancel"' "$CHATS"

if grep -Eq 'temperature:|topP:|top_p|topK:|top_k' "$EDGE"; then
  echo "ERROR: deprecated Gemini sampling parameters are still present"
  exit 1
fi

if find . -maxdepth 2 -type d \( -name 'VELVET_UPDATE_COMPLETE' -o -name 'velvet-redesign-folder' -o -name 'velvet-vite-config-fix' -o -name 'velvet_simple_state_fix' -o -name '.temp' \) | grep -q .; then
  echo "ERROR: obsolete patch/temp directories are still present"
  exit 1
fi

echo "OK: V7 timeline, regeneration, medium, POV and cleanup guards are present"
