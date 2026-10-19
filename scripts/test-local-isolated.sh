#!/bin/sh
# Keep default audit writes from legacy auth tests out of live private storage.
set -eu
PROJECT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
REAL_HOME=$HOME
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/aaaa-security-suite.XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT HUP INT TERM
export HOME="$SANDBOX"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$REAL_HOME/Library/Caches/ms-playwright}"
if [ -d /tmp/note-modal-browser/node_modules/playwright ]; then
  export PLAYWRIGHT_PATH="${PLAYWRIGHT_PATH:-/tmp/note-modal-browser/node_modules/playwright}"
fi
cd "$PROJECT"
if [ "$#" -eq 0 ]; then
  node --test tests/*.test.js
else
  node --test "$@"
fi
