#!/bin/bash
# Tests for make install against a throwaway HOME. Exits non-zero on the first failure.

set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
BUN_DIR=$(dirname "$(command -v bun)")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TMP=$(cd "$TMP" && pwd -P)

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

new_home() { # dir: a HOME whose login shell puts its ~/.local/bin and bun on PATH
  mkdir -p "$1"
  printf 'export PATH="%s/.local/bin:%s:$PATH"\n' "$1" "$BUN_DIR" >"$1/.bash_profile"
}

run_make() { # target home [make args...] -> runs make with that HOME, output in $TMP/out
  local target=$1 home=$2
  shift 2
  HOME=$home SHELL=/bin/bash make -s -C "$ROOT" "$target" "$@" </dev/null >"$TMP/out" 2>&1
}

install() { run_make install "$@"; }
uninstall() { run_make uninstall "$@"; }

answering() { # target answer home -> make target on a terminal, typing answer at the prompt
  local target=$1 answer=$2 home=$3
  HOME=$home SHELL=/bin/bash python3 -I -c '
import errno, os, pty, subprocess, sys
answer, *cmd = sys.argv[1:]
master, slave = pty.openpty()
proc = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=slave)
os.close(slave)
out = b""
def read():
    try:
        return os.read(master, 1024)
    except OSError as error:
        if error.errno == errno.EIO:
            return b""
        raise
while b"[y/N]" not in out and (chunk := read()):
    out += chunk
if b"[y/N]" in out:
    os.write(master, answer.encode() + b"\n")
while chunk := read():
    out += chunk
rc = proc.wait()
sys.stdout.write(out.decode())
sys.exit(rc)' "$answer" make -s -C "$ROOT" "$target" >"$TMP/out" 2>&1
}

install_answering() { answering install "$@"; }
uninstall_answering() { answering uninstall "$@"; }

allow_list() { # settings file -> one rule per line
  python3 -I -c 'import json, sys; print("\n".join(json.load(open(sys.argv[1]))["permissions"]["allow"]))' "$1"
}

tools=$("$ROOT/cli/mt" list | awk '{print $1}')

# a fresh machine
H=$TMP/fresh
new_home "$H"
install_answering y "$H"; rc=$?
assert_eq "fresh install exits 0" 0 "$rc"
assert_eq "mt is linked to the clone" "$ROOT/cli/mt" "$(readlink "$H/.local/bin/mt")"
for tool in $tools; do
  [ "$(readlink "$H/.agents/skills/$tool")" = "$ROOT/skills/$tool" ] || fail "$tool is not linked to the clone"
done
check "every tool mt list shows is linked"
[ -e "$H/.agents/skills/commit" ] && fail "commit is linked, but mt does not serve it"
check "skills mt does not serve are not linked"
assert_eq "settings allow the mt rules" "$(printf 'Bash(mt get:*)\nBash(mt list)\nBash(mt shape:*)')" \
  "$(allow_list "$H/.claude/settings.json")"

# the rules are added only when the owner says so
H=$TMP/declined
new_home "$H"
install_answering n "$H"; rc=$?
assert_eq "declining the rules still installs" 0 "$rc"
[ -e "$H/.claude/settings.json" ] && fail "declining the rules wrote settings"
check "declining the rules writes no settings"
assert_contains "declining says agents will ask" "$(cat "$TMP/out")" "agents will ask before each mt command"
H=$TMP/no-terminal
new_home "$H"
install "$H"; rc=$?
assert_eq "install with no terminal to ask on exits 0" 0 "$rc"
[ -e "$H/.claude/settings.json" ] && fail "install with no terminal to ask on wrote settings"
check "install with no terminal to ask on writes no settings"
assert_contains "with no terminal it says how to answer" "$(cat "$TMP/out")" "ADD_MT_RULES=yes"
install "$H" ADD_MT_RULES=no; rc=$?
assert_eq "ADD_MT_RULES=no exits 0" 0 "$rc"
[ -e "$H/.claude/settings.json" ] && fail "ADD_MT_RULES=no wrote settings"
check "ADD_MT_RULES=no writes no settings"
H=$TMP/allowed-already
new_home "$H"
install "$H" ADD_MT_RULES=yes >/dev/null
install_answering n "$H"
case $(cat "$TMP/out") in *"[y/N]"*) fail "asked although every rule is there" ;; esac
check "nothing is asked when every rule is there"

# running it again changes nothing
H=$TMP/fresh
cp "$H/.claude/settings.json" "$TMP/settings.before"
ls -l "$H/.agents/skills" "$H/.local/bin" >"$TMP/links.before"
install "$H"; rc=$?
assert_eq "second install exits 0" 0 "$rc"
cmp -s "$TMP/settings.before" "$H/.claude/settings.json" || fail "second install rewrote the settings"
check "second install leaves the settings as they are"
ls -l "$H/.agents/skills" "$H/.local/bin" >"$TMP/links.after"
cmp -s "$TMP/links.before" "$TMP/links.after" || fail "second install changed the links"
check "second install leaves the links as they are"

# existing settings keep everything else, and no rule is added twice
H=$TMP/settings
new_home "$H"
mkdir -p "$H/.claude"
printf '{"model": "opus", "permissions": {"allow": ["Bash(git status)", "Bash(mt list)"], "deny": ["Bash(rm:*)"]}}\n' \
  >"$H/.claude/settings.json"
install "$H" ADD_MT_RULES=yes; rc=$?
assert_eq "install over existing settings exits 0" 0 "$rc"
assert_eq "existing rules stay first, missing ones follow once" \
  "$(printf 'Bash(git status)\nBash(mt list)\nBash(mt get:*)\nBash(mt shape:*)')" "$(allow_list "$H/.claude/settings.json")"
assert_eq "other settings are kept" "opus Bash(rm:*)" "$(python3 -I -c '
import json, sys
s = json.load(open(sys.argv[1]))
print(s["model"], s["permissions"]["deny"][0])' "$H/.claude/settings.json")"

# settings that are not JSON are left alone
H=$TMP/malformed
new_home "$H"
mkdir -p "$H/.claude"
printf '{"permissions": {\n' >"$H/.claude/settings.json"
cp "$H/.claude/settings.json" "$TMP/malformed.before"
install "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "install over malformed settings exits 0"
check "install over malformed settings fails"
assert_contains "the failure names the settings file" "$(cat "$TMP/out")" "$H/.claude/settings.json is not JSON"
cmp -s "$TMP/malformed.before" "$H/.claude/settings.json" || fail "malformed settings were rewritten"
check "malformed settings are left as they are"

# a removed stub's link is pruned; a broken link elsewhere is not
H=$TMP/stale
new_home "$H"
mkdir -p "$H/.agents/skills"
ln -s "$ROOT/skills/retired-stub" "$H/.agents/skills/retired-stub"
ln -s "$TMP/nowhere" "$H/.agents/skills/someone-elses"
install "$H"; rc=$?
assert_eq "install with stale links exits 0" 0 "$rc"
[ -L "$H/.agents/skills/retired-stub" ] && fail "a link to a stub the clone no longer has was kept"
check "a link to a stub the clone no longer has is removed"
[ -L "$H/.agents/skills/someone-elses" ] || fail "a broken link outside the clone was removed"
check "a broken link outside the clone is kept"

# a real folder where a stub goes is left alone, and the rest still install
H=$TMP/folder
new_home "$H"
mkdir -p "$H/.agents/skills/mvc"
printf 'old mvc\n' >"$H/.agents/skills/mvc/SKILL.md"
install "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "install over a real skill folder exits 0"
check "install over a real skill folder fails"
assert_contains "the failure names the folder" "$(cat "$TMP/out")" "$H/.agents/skills/mvc is a real folder"
assert_eq "the folder holds only what it held" "SKILL.md" "$(ls "$H/.agents/skills/mvc")"
assert_eq "the other stubs are linked" "$ROOT/skills/to-orca" "$(readlink "$H/.agents/skills/to-orca")"

# a login shell that cannot find mt fails the install
H=$TMP/nopath
mkdir -p "$H"
install "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "install without mt on the login PATH exits 0"
check "install without mt on the login PATH fails"
assert_contains "the failure says what to add" "$(cat "$TMP/out")" "add $H/.local/bin"

# uninstall removes what install linked, after asking about the rules
H=$TMP/uninstall
new_home "$H"
mkdir -p "$H/.claude" "$H/.agents/skills/caveman"
printf '{"model": "opus", "permissions": {"allow": ["Bash(git status)"]}}\n' >"$H/.claude/settings.json"
ln -s "$TMP/elsewhere/skill" "$H/.agents/skills/someone-elses"
install "$H" ADD_MT_RULES=yes >/dev/null || fail "install before uninstall"
uninstall_answering y "$H"; rc=$?
assert_eq "uninstall exits 0" 0 "$rc"
[ -e "$H/.local/bin/mt" ] && fail "uninstall left the mt link"
check "uninstall removes the mt link"
for tool in $tools; do
  [ -L "$H/.agents/skills/$tool" ] && fail "uninstall left the $tool link"
done
check "uninstall removes every stub link"
[ -L "$H/.agents/skills/someone-elses" ] && [ -d "$H/.agents/skills/caveman" ] || fail "uninstall removed a skill it did not install"
check "uninstall keeps skills it did not install"
assert_eq "uninstall removes only the mt rules" "Bash(git status)" "$(allow_list "$H/.claude/settings.json")"
assert_eq "uninstall keeps other settings" opus "$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["model"])' "$H/.claude/settings.json")"

# running it again changes nothing, and asks nothing
cp "$H/.claude/settings.json" "$TMP/settings.before"
uninstall_answering y "$H"; rc=$?
assert_eq "second uninstall exits 0" 0 "$rc"
case $(cat "$TMP/out") in *"[y/N]"*) fail "second uninstall asked about rules that are gone" ;; esac
check "second uninstall asks nothing"
cmp -s "$TMP/settings.before" "$H/.claude/settings.json" || fail "second uninstall rewrote the settings"
check "second uninstall leaves the settings as they are"

# the rules stay unless the owner says so
H=$TMP/uninstall-keep
new_home "$H"
install "$H" ADD_MT_RULES=yes >/dev/null || fail "install before uninstall"
uninstall_answering n "$H"; rc=$?
assert_eq "declining rule removal still uninstalls" 0 "$rc"
[ -e "$H/.local/bin/mt" ] && fail "declining rule removal left the mt link"
assert_eq "declined rules stay" "$(printf 'Bash(mt get:*)\nBash(mt list)\nBash(mt shape:*)')" "$(allow_list "$H/.claude/settings.json")"
uninstall "$H"; rc=$?
assert_eq "uninstall with no terminal to ask on exits 0" 0 "$rc"
assert_contains "with no terminal it says how to answer" "$(cat "$TMP/out")" "REMOVE_MT_RULES=yes"
assert_eq "with no terminal the rules stay" 3 "$(allow_list "$H/.claude/settings.json" | wc -l | tr -d ' ')"
uninstall "$H" REMOVE_MT_RULES=yes; rc=$?
assert_eq "REMOVE_MT_RULES=yes exits 0" 0 "$rc"
assert_eq "REMOVE_MT_RULES=yes removes the rules" "" "$(allow_list "$H/.claude/settings.json")"

# an mt that is not this clone's link stays
H=$TMP/uninstall-foreign
mkdir -p "$H/.local/bin"
printf '#!/bin/sh\n' >"$H/.local/bin/mt"
uninstall "$H"; rc=$?
assert_eq "uninstall on a machine without the install exits 0" 0 "$rc"
[ -f "$H/.local/bin/mt" ] || fail "uninstall removed an mt it did not install"
check "uninstall keeps an mt it did not install"
[ -e "$H/.claude/settings.json" ] && fail "uninstall created settings"
check "uninstall creates no settings"
