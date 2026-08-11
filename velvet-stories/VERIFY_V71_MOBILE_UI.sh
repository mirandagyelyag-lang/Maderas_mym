#!/usr/bin/env bash
set -e

echo "=== VELVET V7.1 MOBILE UI CHECK ==="

test -f src/styles/mobile-v71.css
grep -q 'mobile-v71.css' src/main.jsx
grep -q 'grid-template-columns: repeat(3' src/styles/mobile-v71.css
grep -q 'Story Shelf' src/styles/mobile-v71.css
grep -q 'Chat shell' src/styles/mobile-v71.css
grep -q 'Message actions: true mobile sheet' src/styles/mobile-v71.css
grep -q 'Create character studio' src/styles/mobile-v71.css

echo "OK: Velvet V7.1 mobile UI refresh is installed"
