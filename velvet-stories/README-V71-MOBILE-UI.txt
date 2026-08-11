Velvet Stories V7.1 - Mobile UI Refresh

This patch sits on top of the clean V7 core. It changes frontend styling only.

Highlights:
- Correct 3-item mobile bottom navigation
- Native-feeling full-width bottom bar with safe-area support
- Compact Story Shelf cards instead of giant desktop cards
- Two-column character Library on phones
- Cleaner fixed chat header
- Character messages read more like prose; user messages stay compact bubbles
- Smaller, cleaner version arrows + message options
- Floating composer redesigned for one-hand mobile use
- Message actions and editors behave as bottom sheets
- Mobile profile/settings/memory/persona pages normalized
- Character Studio becomes a usable bottom-sheet editor
- iPhone/Android safe areas and 100dvh handling improved

Install over Velvet V7:

bash VERIFY_V71_MOBILE_UI.sh
npm run build
git add .
git commit -m "Refresh Velvet mobile UI"
git push origin main

No db push.
No Edge Function deploy.
