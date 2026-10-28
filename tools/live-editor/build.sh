#!/bin/sh
# Rebuild vendor/live-editor.js from live-editor.js (CodeMirror 6).
# Needs Node: installs the pinned packages into a temp folder, bundles, minifies.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
cp "$HERE/live-editor.js" "$HERE/package.json" "$TMP/"
cd "$TMP" && npm install --silent && npx esbuild live-editor.js --bundle --format=esm --minify --legal-comments=eof --outfile="$HERE/../../vendor/live-editor.js"
rm -rf "$TMP"
