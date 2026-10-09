#!/bin/bash
# guide-lint: runs src/guide-lint/ on this repo. It exits non-zero, one `file:line: `mention`:
# reason` line each, on a guide or stub skill that mentions in backticks an mt guide, reference or
# command, or an `orca` command or flag, that no longer exists. Without orca on PATH it checks the
# mt mentions only and says so in one line. `bun test` checks the matching itself.

set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# guide-lint logs its `mt get` runs to a throwaway file itself; these stand in for the owner's usage
# log, so a lint that stopped doing that fails below instead of writing there.
export MT_LOG=$TMP/usage.jsonl XDG_STATE_HOME=$TMP/state

bun "$ROOT/src/guide-lint/main.ts" "$ROOT"
status=$?

if [ -s "$MT_LOG" ] || [ -e "$XDG_STATE_HOME/mt" ]; then
  echo "FAIL: guide-lint wrote to the usage log" >&2
  exit 1
fi
exit "$status"
