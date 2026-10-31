#!/bin/sh
# Run every browser test against the app served from this repo.
#   tests/run.sh            all tests
#   tests/run.sh maps-key   only tests whose names contain "maps-key"
# Needs Node with Playwright and Chromium. Starts a local server on port 8766
# (or uses one already running there) and exits non-zero if any test fails.
cd "$(dirname "$0")/.." || exit 1
PORT=${PORT:-8766}
export WA_URL="http://localhost:$PORT/"
started=""
if ! curl -s -o /dev/null "$WA_URL"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  started=$!
  sleep 1
fi
failed=""
for t in tests/*.test.js; do
  case "$t" in *"$1"*) ;; *) continue ;; esac
  if ! node "$t"; then failed="$failed $(basename "$t")"; fi
done
[ -n "$started" ] && kill "$started"
if [ -n "$failed" ]; then echo; echo "FAILED:$failed"; exit 1; fi
echo; echo "All tests passed."
