#!/bin/bash
# Tests for cli/mt against a throwaway fixture repo. Exits non-zero on the first failure.

set -u

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
MT_SRC=$HERE/../cli/mt

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TMP=$(cd "$TMP" && pwd -P)

REPO=$TMP/repo

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

mkdir -p "$REPO/cli" "$REPO/guides/relay" "$REPO/skills/door-rule" "$REPO/skills/relay" \
  "$REPO/skills/solo" "$REPO/skills/orphan-stub"
cp "$MT_SRC" "$REPO/cli/mt"
chmod +x "$REPO/cli/mt"

printf '# Door rule\nbody line\n' >"$REPO/guides/door-rule.md"
printf '# Relay\n' >"$REPO/guides/relay.md"
printf '# Overlay\noverlay body\n' >"$REPO/guides/relay/overlay.md"
printf '# Solo, no stub\n\nDomain: Tools. A guide only a spec loads,\n  over two lines.\n\n## Later\nnot read\n' >"$REPO/guides/no-stub.md"
printf '# Solo\n' >"$REPO/guides/solo.md"

cat >"$REPO/skills/door-rule/SKILL.md" <<'SK'
---
name: door-rule
description: Use when deciding whether to ask or to carry on.
---

# Door rule stub
description: this body line must not be read
SK
cat >"$REPO/skills/relay/SKILL.md" <<'SK'
---
name: relay
description: >-
  Use when a shape should run as one
  driven Run, with review rounds.
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

MT=$REPO/cli/mt
OTHER=$TMP/elsewhere
mkdir -p "$OTHER"

# R1: found
out=$(cd "$OTHER" && "$MT" get door-rule 2>"$TMP/err"); rc=$?
assert_eq "R1 get prints the guide" "$(printf '# Door rule\nbody line')" "$out"
assert_eq "R1 get exits 0" 0 "$rc"
assert_eq "R1 get writes nothing to stderr" "" "$(cat "$TMP/err")"

# R2: not found
out=$("$MT" get nope 2>"$TMP/err"); rc=$?
assert_eq "R2 exits non-zero" 1 "$rc"
assert_eq "R2 stdout empty" "" "$out"
assert_contains "R2 stderr names the tool" "$(cat "$TMP/err")" "nope"
assert_contains "R2 stderr points at mt list" "$(cat "$TMP/err")" "mt list"

# R2: a name that tries to leave guides/ is not found
out=$("$MT" get '../README' 2>/dev/null); rc=$?
assert_eq "path-like tool exits non-zero" 1 "$rc"
assert_eq "path-like tool prints nothing" "" "$out"

# R4: ref
out=$("$MT" get relay --ref overlay 2>/dev/null); rc=$?
assert_eq "R4 prints the reference" "$(printf '# Overlay\noverlay body')" "$out"
assert_eq "R4 exits 0" 0 "$rc"

# unknown ref
out=$("$MT" get relay --ref missing 2>"$TMP/err"); rc=$?
assert_eq "unknown ref exits non-zero" 1 "$rc"
assert_eq "unknown ref stdout empty" "" "$out"
assert_contains "unknown ref stderr names the ref" "$(cat "$TMP/err")" "missing"
assert_contains "unknown ref stderr names the tool" "$(cat "$TMP/err")" "relay"
assert_contains "unknown ref stderr points at mt list" "$(cat "$TMP/err")" "mt list"

# usage errors
"$MT" get --ref overlay >/dev/null 2>&1; rc=$?
assert_eq "get without a tool exits 2" 2 "$rc"
"$MT" get relay --ref >/dev/null 2>&1; rc=$?
assert_eq "--ref without a value exits 2" 2 "$rc"

# R3: list
out=$("$MT" list); rc=$?
assert_eq "R3 list exits 0" 0 "$rc"
assert_eq "R3 list has one line per guide" 4 "$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
assert_contains "R3 single-line description" "$out" "Use when deciding whether to ask or to carry on."
assert_contains "R3 folded description joined" "$out" "Use when a shape should run as one driven Run, with review rounds."
assert_contains "R3 quoted description unquoted" "$out" "Quoted description, single line"
case $out in *"allowed-tools"*|*"must not be read"*) fail "R3 list read past the description" ;; esac
check "R3 list stops at the description"
assert_contains "R3 guide without a stub shows its first paragraph" "$out" "A guide only a spec loads, over two lines."
case $out in *"Domain:"*) fail "R3 list shows a guide's domain line" ;; esac
check "R3 list leaves out a guide's domain"
case $out in *"not read"*) fail "R3 list read past a guide's first paragraph" ;; esac
check "R3 list stops at a guide's first paragraph"
case $out in *orphan-stub*) fail "R3 list shows a stub that has no guide" ;; esac
check "R3 list shows only guides"

# R5: symlink on PATH, run from another directory
mkdir -p "$TMP/bin" "$TMP/bin2"
ln -s "$REPO/cli/mt" "$TMP/bin/mt"
ln -s "$TMP/bin/mt" "$TMP/bin2/mt-chain"
out=$(cd "$OTHER" && PATH="$TMP/bin:$PATH" mt get door-rule)
assert_eq "R5 symlink on PATH reads the repo's guide" "$(printf '# Door rule\nbody line')" "$out"
out=$(cd "$OTHER" && "$TMP/bin2/mt-chain" get door-rule)
assert_eq "R5 chained symlink reads the repo's guide" "$(printf '# Door rule\nbody line')" "$out"
(cd "$TMP/bin" && ln -s ../repo/cli/mt rel-mt) || fail "relative symlink setup"
out=$(cd "$OTHER" && "$TMP/bin/rel-mt" list | head -n 1)
assert_contains "R5 relative symlink resolves" "$out" "door-rule"

# dogfood is gone: an agent that runs it gets the usage, and gh never runs
FAKEBIN=$TMP/fakebin
GH_SEEN=$TMP/gh-seen
mkdir -p "$FAKEBIN" "$GH_SEEN"
ln -s "$(command -v bun)" "$FAKEBIN/bun"
printf '#!/bin/bash\necho "$*" >>"%s/calls"\n' "$GH_SEEN" >"$FAKEBIN/gh"
chmod +x "$FAKEBIN/gh"
out=$(cd "$OTHER" && PATH=$FAKEBIN "$MT" dogfood 'a finding' 2>"$TMP/err"); rc=$?
assert_eq "dogfood exits 2" 2 "$rc"
assert_eq "dogfood prints nothing on stdout" "" "$out"
assert_eq "dogfood is an unknown command" "mt: unknown command 'dogfood'" "$(head -n 1 "$TMP/err")"
assert_contains "dogfood prints the usage" "$(cat "$TMP/err")" "usage: mt get"
[ -e "$GH_SEEN/calls" ] && fail "dogfood ran gh"
check "dogfood never runs gh"

# R10: mt oracle is gone, so each of its commands is an unknown command
for sub in run hash; do
  out=$(cd "$OTHER" && "$MT" oracle "$sub" 2>"$TMP/err"); rc=$?
  assert_eq "mt oracle $sub exits 2" 2 "$rc"
  assert_eq "mt oracle $sub prints nothing on stdout" "" "$out"
  assert_eq "mt oracle $sub is an unknown command" "mt: unknown command 'oracle'" "$(head -n 1 "$TMP/err")"
done

# usage
for args in "" "--help"; do
  out=$("$MT" ${args:+"$args"}); rc=$?
  assert_eq "usage ($args) exits 0" 0 "$rc"
  assert_contains "usage ($args) shows get" "$out" "mt get"
  assert_contains "usage ($args) names the config file" "$out" "mt/config.toml"
  for word in dogfood triage TYPESAFE_API_KEY; do
    case $out in *"$word"*) fail "usage ($args) names $word" ;; esac
    check "usage ($args) names no $word"
  done
done
"$MT" frobnicate >/dev/null 2>&1; rc=$?
assert_eq "unknown command exits 2" 2 "$rc"

# get, list and --help, run in a cleared environment, write nothing under an empty HOME and
# print nothing on stderr but the not-found line
EMPTY_HOME=$TMP/empty-home
mkdir -p "$EMPTY_HOME"
NOT_FOUND_NOPE="mt: no guide for tool 'nope'. Run 'mt list' to see the tools."
NOT_FOUND_REF="mt: no reference 'missing' for tool 'relay'. Run 'mt list' to see the tools."
while IFS='|' read -r args want; do
  (cd "$OTHER" && env -i PATH="$PATH" HOME="$EMPTY_HOME" "$MT" $args >/dev/null 2>"$TMP/err")
  assert_eq "mt $args leaves HOME empty" "" "$(find "$EMPTY_HOME" -mindepth 1)"
  assert_eq "mt $args stderr" "$want" "$(cat "$TMP/err")"
done <<EOF
get door-rule|
get nope|$NOT_FOUND_NOPE
get relay --ref overlay|
get relay --ref missing|$NOT_FOUND_REF
list|
--help|
EOF

echo "all checks passed"
