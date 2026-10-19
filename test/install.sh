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

answering() { # target answers home -> make target on a terminal, typing each comma-separated answer
  local target=$1 answer=$2 home=$3 # at a prompt in turn, the last at every prompt after it
  HOME=$home SHELL=/bin/bash python3 -I -c '
import errno, os, pty, subprocess, sys
answers, *cmd = sys.argv[1:]
answers = answers.split(",")
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
asked = 0
while chunk := read():
    out += chunk
    while out.count(b"[y/N]") > asked:
        os.write(master, answers[min(asked, len(answers) - 1)].encode() + b"\n")
        asked += 1
rc = proc.wait()
sys.stdout.write(out.decode())
sys.exit(rc)' "$answer" make -s -C "$ROOT" "$target" >"$TMP/out" 2>&1
}

install_answering() { answering install "$@"; }
uninstall_answering() { answering uninstall "$@"; }

allow_list() { # settings file -> one rule per line
  python3 -I -c 'import json, sys; print("\n".join(json.load(open(sys.argv[1]))["permissions"]["allow"]))' "$1"
}

ask_list() { # settings file -> one rule per line
  python3 -I -c 'import json, sys; print("\n".join(json.load(open(sys.argv[1]))["permissions"].get("ask", [])))' "$1"
}

deny_list() { # settings file -> one rule per line
  python3 -I -c 'import json, sys; print("\n".join(json.load(open(sys.argv[1]))["permissions"].get("deny", [])))' "$1"
}

links() { # folder... -> each entry, where it links to and its inode, so a link written again shows
  python3 -I -c '
import os, sys
for folder in sys.argv[1:]:
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        print(path, os.readlink(path) if os.path.islink(path) else "-", os.lstat(path).st_ino)' "$@"
}

relative() { # path from-folder -> path spelled relative to from-folder
  python3 -I -c 'import os, sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))' "$1" "$2"
}

tools=$(for dir in "$ROOT"/skills/mt-*/; do
  tool=$(basename "$dir")
  [ -f "$ROOT/guides/${tool#mt-}.md" ] && echo "$tool"
done)

# a fresh machine
H=$TMP/fresh
new_home "$H"
install_answering y "$H"; rc=$?
assert_eq "fresh install exits 0" 0 "$rc"
assert_eq "mt is linked to the clone" "$ROOT/cli/mt" "$(readlink "$H/.local/bin/mt")"
for tool in $tools; do
  [ "$(readlink "$H/.claude/skills/$tool")" = "$ROOT/skills/$tool" ] || fail "$tool is not linked to the clone in ~/.claude/skills"
done
check "with no ~/.agents, every stub that has a guide is linked straight into ~/.claude/skills"
[ -e "$H/.agents" ] && fail "install created ~/.agents"
check "with no ~/.agents, install does not create it"
assert_eq "mt-door-rule is linked to the clone" "$ROOT/skills/mt-door-rule" "$(readlink "$H/.claude/skills/mt-door-rule")"
out=$(HOME=$H "$H/.local/bin/mt" get door-rule); rc=$?
assert_eq "mt get door-rule exits 0" 0 "$rc"
assert_eq "mt get door-rule prints the door-rule guide" "$(cat "$ROOT/guides/door-rule.md")" "$out"
[ -L "$H/.claude/skills/mt-brief" ] && fail "brief is linked, but it has no stub"
check "guides without a stub are not linked"
case $(cat "$TMP/out") in *"removed stale"*) fail "a fresh install removed links it made" ;; esac
check "a fresh install removes nothing"
assert_eq "settings allow every mt command" "Bash(mt:*)" "$(allow_list "$H/.claude/settings.json")"
assert_eq "settings ask before mt update" "Bash(mt update:*)" "$(ask_list "$H/.claude/settings.json")"
assert_eq "settings deny agents nothing" "" "$(deny_list "$H/.claude/settings.json")"
usage=$(HOME=$H "$H/.local/bin/mt" --help)
assert_contains "the installed mt's usage lists mt config" "$usage" "mt config [<key>]"
assert_contains "the installed mt's usage names the config file" "$usage" "\${XDG_CONFIG_HOME:-\$HOME/.config}/mt/config.toml"

# a whole skill, one mt does not serve, is not linked
C=$TMP/clone
mkdir -p "$C/skills/whole" "$C/guides"
cp "$ROOT/Makefile" "$C/Makefile"
printf -- '---\nname: whole\n---\n\nThe whole skill.\n' >"$C/skills/whole/SKILL.md"
H=$TMP/whole
mkdir -p "$H"
HOME=$H make -s -C "$C" skills </dev/null >"$TMP/out" 2>&1; rc=$?
assert_eq "linking a clone with a whole skill exits 0" 0 "$rc"
[ -e "$H/.claude/skills/whole" ] && fail "a whole skill is linked, but mt does not serve it"
check "skills mt does not serve are not linked"

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
install "$H" ADD_MT_RULES=yes; rc=$?
assert_eq "ADD_MT_RULES=yes exits 0" 0 "$rc"
assert_eq "ADD_MT_RULES=yes allows every mt command" "Bash(mt:*)" "$(allow_list "$H/.claude/settings.json")"
assert_eq "ADD_MT_RULES=yes asks before mt update" "Bash(mt update:*)" "$(ask_list "$H/.claude/settings.json")"
assert_eq "ADD_MT_RULES=yes denies nothing" "" "$(deny_list "$H/.claude/settings.json")"
install_answering n "$H"
case $(cat "$TMP/out") in *"[y/N]"*) fail "asked although every rule is there" ;; esac
check "nothing is asked when every rule is there"

# running it again changes nothing
H=$TMP/fresh
cp "$H/.claude/settings.json" "$TMP/settings.before"
links "$H/.claude/skills" >"$TMP/links.before"
install "$H"; rc=$?
assert_eq "second install exits 0" 0 "$rc"
cmp -s "$TMP/settings.before" "$H/.claude/settings.json" || fail "second install rewrote the settings"
check "second install leaves the settings as they are"
links "$H/.claude/skills" >"$TMP/links.after"
cmp -s "$TMP/links.before" "$TMP/links.after" || fail "second install changed the links"
check "second install leaves the links as they are"
assert_eq "second install keeps mt linked to the clone" "$ROOT/cli/mt" "$(readlink "$H/.local/bin/mt")"

# with ~/.agents/skills, Claude Code's folder links to it
H=$TMP/agents
new_home "$H"
mkdir -p "$H/.agents/skills"
install "$H"; rc=$?
assert_eq "install with ~/.agents/skills exits 0" 0 "$rc"
for tool in $tools; do
  [ "$(readlink "$H/.agents/skills/$tool")" = "$ROOT/skills/$tool" ] || fail "$tool is not linked to the clone in ~/.agents/skills"
  [ "$(readlink "$H/.claude/skills/$tool")" = "$H/.agents/skills/$tool" ] || fail "$tool in ~/.claude/skills is not linked to ~/.agents/skills"
done
check "with ~/.agents/skills, each stub links there and ~/.claude/skills links to it"
links "$H/.agents/skills" "$H/.claude/skills" >"$TMP/links.before"
install "$H"; rc=$?
assert_eq "second install with ~/.agents/skills exits 0" 0 "$rc"
links "$H/.agents/skills" "$H/.claude/skills" >"$TMP/links.after"
cmp -s "$TMP/links.before" "$TMP/links.after" || fail "second install changed the links in either skills folder"
check "second install leaves both skills folders as they are"
rm "$H/.claude/skills/mt-door-rule" "$H/.claude/skills/mt-ask"
ln -s ../../.agents/skills/mt-door-rule "$H/.claude/skills/mt-door-rule"
ln -s "$ROOT/skills/mt-ask" "$H/.claude/skills/mt-ask"
install "$H"; rc=$?
assert_eq "install over a relative link and a link into the clone exits 0" 0 "$rc"
assert_eq "a relative link to ~/.agents/skills/mt-door-rule is left as it is" ../../.agents/skills/mt-door-rule \
  "$(readlink "$H/.claude/skills/mt-door-rule")"
assert_eq "a link in ~/.claude/skills straight into the clone is relinked to ~/.agents/skills" "$H/.agents/skills/mt-ask" \
  "$(readlink "$H/.claude/skills/mt-ask")"

# a Claude Code folder that links to SKILLS_DIR gets no link to itself
H=$TMP/claude-linked
new_home "$H"
mkdir -p "$H/.agents/skills" "$H/.claude"
ln -s ../.agents/skills "$H/.claude/skills"
install "$H"; rc=$?
assert_eq "install with ~/.claude/skills linking to ~/.agents/skills exits 0" 0 "$rc"
for tool in $tools; do
  [ "$(readlink "$H/.agents/skills/$tool")" = "$ROOT/skills/$tool" ] || fail "$tool in ~/.agents/skills does not link to the clone"
done
check "with ~/.claude/skills linking to ~/.agents/skills, every stub still links to the clone"

# a SKILLS_DIR that is Claude Code's folder gets the stubs straight from the clone
H=$TMP/claude-only
new_home "$H"
install "$H" SKILLS_DIR="$H/.claude/skills"; rc=$?
assert_eq "install with SKILLS_DIR=~/.claude/skills exits 0" 0 "$rc"
for tool in $tools; do
  [ "$(readlink "$H/.claude/skills/$tool")" = "$ROOT/skills/$tool" ] || fail "$tool is not linked to the clone with SKILLS_DIR=~/.claude/skills"
done
check "with SKILLS_DIR=~/.claude/skills, every stub is linked straight to the clone"

# a SKILLS_DIR override, for another agent, leaves Claude Code's folder as it is
H=$TMP/other-agent
new_home "$H"
mkdir -p "$H/.agents/skills"
install "$H" || fail "install before installing for another agent"
links "$H/.agents/skills" "$H/.claude/skills" >"$TMP/links.before"
install "$H" SKILLS_DIR="$H/.codex/skills"; rc=$?
assert_eq "install with SKILLS_DIR for another agent exits 0" 0 "$rc"
for tool in $tools; do
  [ "$(readlink "$H/.codex/skills/$tool")" = "$ROOT/skills/$tool" ] || fail "$tool is not linked to the clone in the other agent's folder"
done
check "with a SKILLS_DIR override, every stub is linked into that folder"
links "$H/.agents/skills" "$H/.claude/skills" >"$TMP/links.after"
cmp -s "$TMP/links.before" "$TMP/links.after" || fail "install for another agent changed ~/.claude/skills or ~/.agents/skills"
check "install for another agent leaves ~/.claude/skills and ~/.agents/skills as they are"
uninstall "$H" SKILLS_DIR="$H/.codex/skills"; rc=$?
assert_eq "uninstall with SKILLS_DIR for another agent exits 0" 0 "$rc"
[ -z "$(ls "$H/.codex/skills")" ] || fail "uninstall for another agent left links in its folder: $(ls "$H/.codex/skills")"
check "uninstall for another agent removes the stubs from its folder"
links "$H/.agents/skills" "$H/.claude/skills" >"$TMP/links.after"
cmp -s "$TMP/links.before" "$TMP/links.after" || fail "uninstall for another agent changed ~/.claude/skills or ~/.agents/skills"
check "uninstall for another agent leaves ~/.claude/skills and ~/.agents/skills as they are"
H=$TMP/other-agent-only
new_home "$H"
install "$H" SKILLS_DIR="$H/.codex/skills"; rc=$?
assert_eq "install for another agent on a fresh machine exits 0" 0 "$rc"
[ -e "$H/.claude/skills" ] && fail "install for another agent created ~/.claude/skills"
check "install for another agent does not create ~/.claude/skills"

# settings with no permissions get the allow rule and the ask rule
H=$TMP/no-permissions
new_home "$H"
mkdir -p "$H/.claude"
printf '{"model": "opus"}\n' >"$H/.claude/settings.json"
install "$H" ADD_MT_RULES=yes; rc=$?
assert_eq "install over settings with no permissions exits 0" 0 "$rc"
assert_eq "settings with no permissions allow every mt command" "Bash(mt:*)" "$(allow_list "$H/.claude/settings.json")"
assert_eq "settings with no permissions ask before mt update" "Bash(mt update:*)" "$(ask_list "$H/.claude/settings.json")"

# existing settings keep everything else, and no rule is added twice
H=$TMP/settings
new_home "$H"
mkdir -p "$H/.claude"
printf '{"model": "opus", "permissions": {"allow": ["Bash(git status)"], "deny": ["Bash(rm:*)"]}}\n' \
  >"$H/.claude/settings.json"
install "$H" ADD_MT_RULES=yes; rc=$?
assert_eq "install over existing settings exits 0" 0 "$rc"
assert_eq "existing rules stay first, the allow rule after them" \
  "$(printf 'Bash(git status)\nBash(mt:*)')" "$(allow_list "$H/.claude/settings.json")"
assert_eq "other settings are kept" "opus Bash(rm:*)" "$(python3 -I -c '
import json, sys
s = json.load(open(sys.argv[1]))
print(s["model"], s["permissions"]["deny"][0])' "$H/.claude/settings.json")"
assert_eq "the denies that are there stay as they are" "Bash(rm:*)" "$(deny_list "$H/.claude/settings.json")"

# settings from an install before the ask rule get it alone, and declining it says what that leaves
H=$TMP/before-ask
new_home "$H"
mkdir -p "$H/.claude"
printf '{"permissions": {"allow": ["Bash(mt:*)"]}}\n' >"$H/.claude/settings.json"
cp "$H/.claude/settings.json" "$TMP/settings.before"
install_answering n "$H"
assert_contains "the missing ask rule alone is asked about" "$(cat "$TMP/out")" "add Bash(mt update:*) to permissions.ask?"
cmp -s "$TMP/settings.before" "$H/.claude/settings.json" || fail "declining wrote the ask rule"
check "declining leaves the settings without the ask rule"
assert_contains "declining the ask rule says agents run mt update unasked" "$(cat "$TMP/out")" \
  "agents run mt update without being asked"

# an ask list that is not a list of strings is left alone
list=ask
for bad in '"Bash(x)"' '[1]' '{}'; do
  H=$TMP/bad-$list
  rm -rf "$H"
  new_home "$H"
  mkdir -p "$H/.claude"
  printf '{"permissions": {"%s": %s}}\n' "$list" "$bad" >"$H/.claude/settings.json"
  cp "$H/.claude/settings.json" "$TMP/bad.before"
  install "$H" ADD_MT_RULES=yes; rc=$?
  [ "$rc" -ne 0 ] || fail "install over permissions.$list $bad exits 0"
  assert_contains "the failure names permissions.$list" "$(cat "$TMP/out")" "permissions.$list is not a list of strings"
  cmp -s "$TMP/bad.before" "$H/.claude/settings.json" || fail "settings with permissions.$list $bad were rewritten"
  uninstall "$H" REMOVE_MT_RULES=yes; rc=$?
  [ "$rc" -ne 0 ] || fail "uninstall over permissions.$list $bad exits 0"
  cmp -s "$TMP/bad.before" "$H/.claude/settings.json" || fail "uninstall rewrote settings with permissions.$list $bad"
done
check "a permissions.$list that is not a list of strings is left as it is"

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
assert_contains "the failure names the rules to add by hand" "$(cat "$TMP/out")" \
  "add Bash(mt:*) in permissions.allow and Bash(mt update:*) in permissions.ask by hand"
cmp -s "$TMP/malformed.before" "$H/.claude/settings.json" || fail "malformed settings were rewritten"
check "malformed settings are left as they are"

# a removed stub's link is pruned; a broken link elsewhere is not
H=$TMP/stale
new_home "$H"
mkdir -p "$H/.agents/skills"
ln -s "$ROOT/skills/retired-stub" "$H/.agents/skills/retired-stub"
ln -s "$TMP/nowhere" "$H/.agents/skills/someone-elses"
mkdir -p "$H/.claude/skills"
ln -s "$H/.agents/skills/retired-stub" "$H/.claude/skills/retired-stub"
ln -s "$TMP/nowhere" "$H/.claude/skills/someone-elses"
install "$H"; rc=$?
assert_eq "install with stale links exits 0" 0 "$rc"
[ -L "$H/.agents/skills/retired-stub" ] && fail "a link to a stub the clone no longer has was kept"
check "a link to a stub the clone no longer has is removed"
[ -L "$H/.claude/skills/retired-stub" ] && fail "a link in ~/.claude/skills to a removed stub link was kept"
check "a link in ~/.claude/skills to a removed stub link is removed"
[ -L "$H/.claude/skills/someone-elses" ] || fail "a broken link in ~/.claude/skills outside the clone was removed"
check "a broken link in ~/.claude/skills outside the clone is kept"
[ -L "$H/.agents/skills/someone-elses" ] || fail "a broken link outside the clone was removed"
check "a broken link outside the clone is kept"

# a link into the clone to a stub that is gone is removed
H=$TMP/gone-link
new_home "$H"
mkdir -p "$H/.agents/skills"
ln -s "$ROOT/skills/mt-gone" "$H/.agents/skills/mt-gone"
install "$H"; rc=$?
assert_eq "install over a link to a gone stub exits 0" 0 "$rc"
[ -L "$H/.agents/skills/mt-gone" ] && fail "install kept the link to the gone stub"
check "install leaves no link to a gone stub"

# a real folder where a stub goes is left alone, and the rest still install
H=$TMP/folder
new_home "$H"
mkdir -p "$H/.agents/skills/mt-ask"
printf 'old stub\n' >"$H/.agents/skills/mt-ask/SKILL.md"
install "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "install over a real skill folder exits 0"
check "install over a real skill folder fails"
assert_contains "the failure names the folder" "$(cat "$TMP/out")" "$H/.agents/skills/mt-ask is a real folder"
assert_eq "the folder holds only what it held" "SKILL.md" "$(ls "$H/.agents/skills/mt-ask")"
assert_eq "the other stubs are linked" "$ROOT/skills/mt-coordinate" "$(readlink "$H/.agents/skills/mt-coordinate")"

# a real folder where a stub goes in Claude Code's folder is left alone too
H=$TMP/claude-folder
new_home "$H"
mkdir -p "$H/.agents/skills" "$H/.claude/skills/mt-ask"
printf 'old stub\n' >"$H/.claude/skills/mt-ask/SKILL.md"
install "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "install over a real skill folder in ~/.claude/skills exits 0"
check "install over a real skill folder in ~/.claude/skills fails"
assert_contains "the failure names the folder in ~/.claude/skills" "$(cat "$TMP/out")" "$H/.claude/skills/mt-ask is a real folder"
assert_eq "the folder in ~/.claude/skills holds only what it held" "SKILL.md" "$(ls "$H/.claude/skills/mt-ask")"
for tool in $tools; do
  [ "$tool" = mt-ask ] && continue
  [ "$(readlink "$H/.claude/skills/$tool")" = "$H/.agents/skills/$tool" ] || fail "$tool in ~/.claude/skills is not linked to ~/.agents/skills"
done
check "the other stubs are linked in ~/.claude/skills"

# a file where a stub goes is left alone, in either folder
H=$TMP/file
new_home "$H"
mkdir -p "$H/.agents/skills" "$H/.claude/skills"
printf 'a file\n' >"$H/.agents/skills/mt-ask"
printf 'a file\n' >"$H/.claude/skills/mt-door-rule"
install "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "install over a file where a stub goes exits 0"
check "install over a file where a stub goes fails"
assert_contains "the failure names the file in ~/.agents/skills" "$(cat "$TMP/out")" "$H/.agents/skills/mt-ask is a real file"
assert_contains "the failure names the file in ~/.claude/skills" "$(cat "$TMP/out")" "$H/.claude/skills/mt-door-rule is a real file"
[ ! -L "$H/.agents/skills/mt-ask" ] && [ "$(cat "$H/.agents/skills/mt-ask")" = "a file" ] || fail "the file in ~/.agents/skills was changed"
[ ! -L "$H/.claude/skills/mt-door-rule" ] && [ "$(cat "$H/.claude/skills/mt-door-rule")" = "a file" ] || fail "the file in ~/.claude/skills was changed"
check "a file where a stub goes is left as it is"

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
mkdir -p "$H/.claude/skills/caveman" "$H/.agents/skills/caveman"
printf '{"model": "opus", "permissions": {"allow": ["Bash(git status)"]}}\n' >"$H/.claude/settings.json"
ln -s "$TMP/elsewhere/skill" "$H/.agents/skills/someone-elses"
ln -s "$TMP/elsewhere/skill" "$H/.claude/skills/someone-elses"
install "$H" ADD_MT_RULES=yes >/dev/null || fail "install before uninstall"
rm "$H/.claude/skills/mt-door-rule"
ln -s ../../.agents/skills/mt-door-rule "$H/.claude/skills/mt-door-rule"
ln -s "$ROOT/skills/coordinate" "$H/.claude/skills/coordinate-by-hand"
ln -s "$(relative "$ROOT/skills/coordinate" "$H/.claude/skills")" "$H/.claude/skills/coordinate-relative"
uninstall_answering y "$H"; rc=$?
assert_eq "uninstall exits 0" 0 "$rc"
[ -e "$H/.local/bin/mt" ] && fail "uninstall left the mt link"
check "uninstall removes the mt link"
for tool in $tools; do
  [ -L "$H/.agents/skills/$tool" ] && fail "uninstall left the $tool link"
done
check "uninstall removes every stub link"
for link in "$H/.claude/skills"/* "$H/.agents/skills"/*; do
  [ -L "$link" ] || continue
  case $(readlink "$link") in
    "$ROOT/skills/"* | "$H/.agents/skills/"* | ../../.agents/skills/*) fail "uninstall left $link, linking to $(readlink "$link")" ;;
  esac
done
check "uninstall leaves no link in either skills folder to the clone or to a stub"
[ -L "$H/.claude/skills/coordinate-relative" ] && fail "uninstall left a relative link into the clone in ~/.claude/skills"
check "uninstall removes a relative link into the clone in ~/.claude/skills"
[ -L "$H/.agents/skills/someone-elses" ] && [ -d "$H/.agents/skills/caveman" ] || fail "uninstall removed a skill it did not install"
[ -L "$H/.claude/skills/someone-elses" ] && [ -d "$H/.claude/skills/caveman" ] || fail "uninstall removed a skill in ~/.claude/skills it did not install"
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

# a relative link into the clone in ~/.agents/skills, and Claude Code's link to it, are uninstalled
H=$TMP/uninstall-relative
new_home "$H"
mkdir -p "$H/.agents/skills"
ln -s "$(relative "$ROOT/skills/mt-door-rule" "$H/.agents/skills")" "$H/.agents/skills/mt-door-rule"
install "$H" || fail "install over a relative link into the clone"
uninstall "$H"; rc=$?
assert_eq "uninstall after a relative link into the clone exits 0" 0 "$rc"
[ -L "$H/.agents/skills/mt-door-rule" ] && fail "uninstall left a relative link into the clone in ~/.agents/skills"
check "uninstall removes a relative link into the clone in ~/.agents/skills"
[ -L "$H/.claude/skills/mt-door-rule" ] && fail "uninstall left the ~/.claude/skills link to a relative stub link"
check "uninstall removes the ~/.claude/skills link to a relative stub link"

# with ~/.agents/skills gone, uninstall removes Claude Code's links to it
H=$TMP/uninstall-agents-gone
new_home "$H"
mkdir -p "$H/.agents/skills" "$H/.claude/skills"
ln -s "$TMP/nowhere" "$H/.claude/skills/someone-elses"
install "$H" || fail "install before removing ~/.agents"
rm "$H/.claude/skills/mt-door-rule"
ln -s ../../.agents/skills/mt-door-rule "$H/.claude/skills/mt-door-rule"
rm -rf "$H/.agents"
uninstall "$H"; rc=$?
assert_eq "uninstall with ~/.agents gone exits 0" 0 "$rc"
for link in "$H/.claude/skills"/*; do
  [ -L "$link" ] || continue
  case $(readlink "$link") in
    "$H/.agents/skills/"* | ../../.agents/skills/*) fail "uninstall left $link, linking to $(readlink "$link")" ;;
  esac
done
check "with ~/.agents gone, uninstall leaves no link in ~/.claude/skills to it"
[ -L "$H/.claude/skills/someone-elses" ] || fail "uninstall with ~/.agents gone removed a broken link elsewhere"
check "with ~/.agents gone, uninstall keeps a broken link elsewhere"

# the rules stay unless the owner says so
H=$TMP/uninstall-keep
new_home "$H"
install "$H" ADD_MT_RULES=yes >/dev/null || fail "install before uninstall"
uninstall_answering n "$H"; rc=$?
assert_eq "declining rule removal still uninstalls" 0 "$rc"
[ -e "$H/.local/bin/mt" ] && fail "declining rule removal left the mt link"
assert_eq "declined rules stay" "Bash(mt:*)" "$(allow_list "$H/.claude/settings.json")"
assert_contains "declining rule removal names the rules kept" "$(cat "$TMP/out")" \
  "kept in permissions.allow: Bash(mt:*); kept in permissions.ask: Bash(mt update:*)"
uninstall "$H"; rc=$?
assert_eq "uninstall with no terminal to ask on exits 0" 0 "$rc"
assert_contains "with no terminal it says how to answer" "$(cat "$TMP/out")" "REMOVE_MT_RULES=yes"
assert_eq "with no terminal the rules stay" "Bash(mt:*)" "$(allow_list "$H/.claude/settings.json")"
uninstall "$H" REMOVE_MT_RULES=yes; rc=$?
assert_eq "REMOVE_MT_RULES=yes exits 0" 0 "$rc"
assert_eq "REMOVE_MT_RULES=yes removes the allow rule" "" "$(allow_list "$H/.claude/settings.json")"

# R13: uninstall removes the ask rule, and the owner's asks stay
H=$TMP/uninstall-ask
new_home "$H"
mkdir -p "$H/.claude"
printf '{"permissions": {"allow": ["Bash(mt:*)"], "ask": ["Bash(git push:*)", "Bash(mt update:*)", "Bash(rm:*)"]}}\n' >"$H/.claude/settings.json"
uninstall "$H" REMOVE_MT_RULES=yes; rc=$?
assert_eq "uninstall over the ask rule exits 0" 0 "$rc"
assert_eq "uninstall removes the ask rule and keeps the owner's" "$(printf 'Bash(git push:*)\nBash(rm:*)')" \
  "$(ask_list "$H/.claude/settings.json")"

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
