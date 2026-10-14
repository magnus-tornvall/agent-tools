#!/bin/bash
# guide-lint: runs src/guide-lint/ on this repo. It exits non-zero, one `file:line: `mention`:
# reason` line each, on a guide, stub skill or AGENTS.md that mentions in backticks an mt guide,
# reference or command, or an `orca` command or flag, that no longer exists. Without orca on PATH it
# checks the mt mentions only and says so in one line. `bun test` checks the matching itself.

set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)

bun "$ROOT/src/guide-lint/main.ts" "$ROOT"
