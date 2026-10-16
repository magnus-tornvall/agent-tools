#!/bin/bash
# guide-lint: runs src/guide-lint/ on this repo. It exits non-zero, one `file:line: `mention`:
# reason` line each, on a guide, stub skill or AGENTS.md that mentions in backticks an mt guide,
# reference or command, or an `orca` command or flag, that no longer exists, or a platform's command
# outside its reference under guides/coordinate/; on a guide naming a spec section the spec guide
# does not declare; and on a fixed rule outside the home AGENTS.md names, or a home without one.
# Without orca on PATH it skips the Orca flag check and says so in one line. `bun test` checks the
# matching itself.

set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)

bun "$ROOT/src/guide-lint/main.ts" "$ROOT"
