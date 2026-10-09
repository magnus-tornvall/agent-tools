#!/bin/bash
# Tests for cli/mt against a throwaway fixture repo. Exits non-zero on the first failure.

set -u

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
MT_SRC=$HERE/../cli/mt

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TMP=$(cd "$TMP" && pwd -P)

REPO=$TMP/repo
export MT_LOG=$TMP/usage.jsonl
unset CLAUDE_CODE_SESSION_ID ORCA_TERMINAL_HANDLE ORCA_WORKTREE_ID

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

check() {
  echo "ok   $*"
}

assert_eq() { # name expected actual
  [ "$2" = "$3" ] || fail "$1: expected [$2], got [$3]"
  check "$1"
}

assert_contains() { # name haystack needle
  case $2 in *"$3"*) check "$1" ;; *) fail "$1: [$2] does not contain [$3]" ;; esac
}

json_get() { # line key -> value, or the word null; fails if the line is not JSON
  python3 -I -c '
import json, sys
v = json.loads(sys.argv[1])[sys.argv[2]]
print("<null>" if v is None else v)' "$1" "$2"
}

log_lines() { wc -l <"$MT_LOG" | tr -d ' '; }
last_line() { tail -n 1 "$MT_LOG"; }

mkdir -p "$REPO/cli" "$REPO/guides/to-orca" "$REPO/skills/door-rule" "$REPO/skills/to-orca" \
  "$REPO/skills/solo" "$REPO/skills/orphan-stub"
cp "$MT_SRC" "$REPO/cli/mt"
chmod +x "$REPO/cli/mt"

printf '# Door rule\nbody line\n' >"$REPO/guides/door-rule.md"
printf '# To orca\n' >"$REPO/guides/to-orca.md"
printf '# Overlay\noverlay body\n' >"$REPO/guides/to-orca/overlay.md"
printf '# Solo, no stub\n' >"$REPO/guides/no-stub.md"
printf '# Solo\n' >"$REPO/guides/solo.md"

cat >"$REPO/skills/door-rule/SKILL.md" <<'SK'
---
name: door-rule
description: Use when deciding whether to ask or to carry on.
---

# Door rule stub
description: this body line must not be read
SK
cat >"$REPO/skills/to-orca/SKILL.md" <<'SK'
---
name: to-orca
description: >-
  Use when a shape should run as one
  driven Orca Run, with review rounds.
allowed-tools: Bash
---
SK
cat >"$REPO/skills/solo/SKILL.md" <<'SK'
---
description: "Quoted description, single line"
---
SK
cat >"$REPO/skills/orphan-stub/SKILL.md" <<'SK'
---
description: A stub whose guide does not exist.
---
SK

(cd "$REPO" && git init -q && git add -A &&
  git -c user.name=t -c user.email=t@example.com commit -q -m fixture) || fail "fixture git setup"
COMMIT=$(git -C "$REPO" rev-parse HEAD)

MT=$REPO/cli/mt
OTHER=$TMP/elsewhere
mkdir -p "$OTHER"

# R1: found
out=$(cd "$OTHER" && "$MT" get door-rule 2>"$TMP/err"); rc=$?
assert_eq "R1 get prints the guide" "$(printf '# Door rule\nbody line')" "$out"
assert_eq "R1 get exits 0" 0 "$rc"
assert_eq "R1 get writes nothing to stderr" "" "$(cat "$TMP/err")"
assert_eq "R1 one log line" 1 "$(log_lines)"
line=$(last_line)
assert_eq "R1 log tool" door-rule "$(json_get "$line" tool)"
assert_eq "R1 log ref is null" "<null>" "$(json_get "$line" ref)"
assert_eq "R1 log found" True "$(json_get "$line" found)"
assert_eq "R1 log commit" "$COMMIT" "$(json_get "$line" commit)"
assert_eq "R1 log session null when unset" "<null>" "$(json_get "$line" session)"
assert_eq "R1 log terminal null when unset" "<null>" "$(json_get "$line" terminal)"
assert_eq "R1 log worktree null when unset" "<null>" "$(json_get "$line" worktree)"
case $(json_get "$line" time) in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z) check "R1 log time format" ;;
  *) fail "R1 log time format: $(json_get "$line" time)" ;;
esac

# R1: caller variables set
CLAUDE_CODE_SESSION_ID=sess-1 ORCA_TERMINAL_HANDLE=term_abc ORCA_WORKTREE_ID=wt-9 \
  "$MT" get door-rule >/dev/null
line=$(last_line)
assert_eq "R1 log session" sess-1 "$(json_get "$line" session)"
assert_eq "R1 log terminal" term_abc "$(json_get "$line" terminal)"
assert_eq "R1 log worktree" wt-9 "$(json_get "$line" worktree)"

# R1: values that need JSON escaping
nasty=$'q"uote \\ back\ttab\nnewline \001 ctl é'
CLAUDE_CODE_SESSION_ID=$nasty ORCA_WORKTREE_ID='a"b' "$MT" get door-rule >/dev/null
assert_eq "escaping keeps one line per get" 3 "$(log_lines)"
line=$(last_line)
assert_eq "escaped session round-trips" "$nasty" "$(json_get "$line" session)"
assert_eq "escaped worktree round-trips" 'a"b' "$(json_get "$line" worktree)"

# R2: not found
before=$(log_lines)
out=$("$MT" get nope 2>"$TMP/err"); rc=$?
assert_eq "R2 exits non-zero" 1 "$rc"
assert_eq "R2 stdout empty" "" "$out"
assert_contains "R2 stderr names the tool" "$(cat "$TMP/err")" "nope"
assert_contains "R2 stderr points at mt list" "$(cat "$TMP/err")" "mt list"
assert_eq "R2 log gains a line" $((before + 1)) "$(log_lines)"
line=$(last_line)
assert_eq "R2 log tool" nope "$(json_get "$line" tool)"
assert_eq "R2 log found" False "$(json_get "$line" found)"

# R2: a name that tries to leave guides/ is not found, and the log stays valid JSON
out=$("$MT" get '../README' 2>/dev/null); rc=$?
assert_eq "path-like tool exits non-zero" 1 "$rc"
assert_eq "path-like tool prints nothing" "" "$out"
assert_eq "path-like tool is logged as asked" "../README" "$(json_get "$(last_line)" tool)"

# R4: ref
out=$("$MT" get to-orca --ref overlay 2>/dev/null); rc=$?
assert_eq "R4 prints the reference" "$(printf '# Overlay\noverlay body')" "$out"
assert_eq "R4 exits 0" 0 "$rc"
line=$(last_line)
assert_eq "R4 log tool" to-orca "$(json_get "$line" tool)"
assert_eq "R4 log names the ref" overlay "$(json_get "$line" ref)"
assert_eq "R4 log found" True "$(json_get "$line" found)"

# unknown ref
before=$(log_lines)
out=$("$MT" get to-orca --ref missing 2>"$TMP/err"); rc=$?
assert_eq "unknown ref exits non-zero" 1 "$rc"
assert_eq "unknown ref stdout empty" "" "$out"
assert_contains "unknown ref stderr names the ref" "$(cat "$TMP/err")" "missing"
assert_contains "unknown ref stderr names the tool" "$(cat "$TMP/err")" "to-orca"
assert_contains "unknown ref stderr points at mt list" "$(cat "$TMP/err")" "mt list"
assert_eq "unknown ref is logged" $((before + 1)) "$(log_lines)"
line=$(last_line)
assert_eq "unknown ref log ref" missing "$(json_get "$line" ref)"
assert_eq "unknown ref log found" False "$(json_get "$line" found)"

# usage errors are not logged
before=$(log_lines)
"$MT" get --ref overlay >/dev/null 2>&1; rc=$?
assert_eq "get without a tool exits 2" 2 "$rc"
"$MT" get to-orca --ref >/dev/null 2>&1; rc=$?
assert_eq "--ref without a value exits 2" 2 "$rc"
assert_eq "usage errors are not logged" "$before" "$(log_lines)"

# R3: list
out=$("$MT" list); rc=$?
assert_eq "R3 list exits 0" 0 "$rc"
assert_eq "R3 list has one line per tool" 3 "$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
assert_contains "R3 single-line description" "$out" "Use when deciding whether to ask or to carry on."
assert_contains "R3 folded description joined" "$out" "Use when a shape should run as one driven Orca Run, with review rounds."
assert_contains "R3 quoted description unquoted" "$out" "Quoted description, single line"
case $out in *"allowed-tools"*|*"must not be read"*) fail "R3 list read past the description" ;; esac
check "R3 list stops at the description"
case $out in *no-stub*|*orphan-stub*) fail "R3 list shows something that is not guide + stub" ;; esac
check "R3 list shows only guides that have a stub"
before=$(log_lines)
"$MT" list >/dev/null
assert_eq "list is not logged" "$before" "$(log_lines)"

# R5: symlink on PATH, run from another directory
mkdir -p "$TMP/bin" "$TMP/bin2"
ln -s "$REPO/cli/mt" "$TMP/bin/mt"
ln -s "$TMP/bin/mt" "$TMP/bin2/mt-chain"
out=$(cd "$OTHER" && PATH="$TMP/bin:$PATH" mt get door-rule)
assert_eq "R5 symlink on PATH reads the repo's guide" "$(printf '# Door rule\nbody line')" "$out"
assert_eq "R5 commit is the repo's" "$COMMIT" "$(json_get "$(last_line)" commit)"
out=$(cd "$OTHER" && "$TMP/bin2/mt-chain" get door-rule)
assert_eq "R5 chained symlink reads the repo's guide" "$(printf '# Door rule\nbody line')" "$out"
(cd "$TMP/bin" && ln -s ../repo/cli/mt rel-mt) || fail "relative symlink setup"
out=$(cd "$OTHER" && "$TMP/bin/rel-mt" list | head -n 1)
assert_contains "R5 relative symlink resolves" "$out" "door-rule"

# usage
for args in "" "--help"; do
  # shellcheck disable=SC2086
  out=$("$MT" $args); rc=$?
  assert_eq "usage ($args) exits 0" 0 "$rc"
  assert_contains "usage ($args) shows get" "$out" "mt get"
done
"$MT" frobnicate >/dev/null 2>&1; rc=$?
assert_eq "unknown command exits 2" 2 "$rc"

# outside git the commit is null
NOGIT=$TMP/nogit
mkdir -p "$NOGIT/cli" "$NOGIT/guides"
cp "$MT_SRC" "$NOGIT/cli/mt"
printf 'x\n' >"$NOGIT/guides/t.md"
"$NOGIT/cli/mt" get t >/dev/null
assert_eq "commit is null outside git" "<null>" "$(json_get "$(last_line)" commit)"

# the log default follows XDG_STATE_HOME
(unset MT_LOG; XDG_STATE_HOME=$TMP/state "$MT" get door-rule >/dev/null)
[ -f "$TMP/state/mt/usage.jsonl" ] || fail "default log path under XDG_STATE_HOME"
check "default log path under XDG_STATE_HOME"

# every log line is valid JSON
n=0
while IFS= read -r line; do
  json_get "$line" tool >/dev/null || fail "log line is not JSON: $line"
  n=$((n + 1))
done <"$MT_LOG"
assert_eq "every log line parses as JSON" "$(log_lines)" "$n"

echo "all checks passed"
