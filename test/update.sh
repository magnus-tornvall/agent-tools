#!/bin/bash
# Tests for install.sh and mt update against a local origin and throwaway home folders. Exits
# non-zero on the first failure. Nothing reaches the network: origin is a local repo, given to
# install.sh through AGENT_TOOLS_URL; make install's bun install reads Bun's package cache; HTTP
# goes to a proxy that refuses it, so a package missing from the cache fails the test instead of
# being fetched; and git is allowed local paths alone, so an origin spelled as GitHub's fails.

set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
BUN_DIR=$(dirname "$(command -v bun)")
BUN_CACHE=$(cd "$ROOT" && bun pm cache)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TMP=$(cd "$TMP" && pwd -P)

export BUN_INSTALL_CACHE_DIR=$BUN_CACHE
export HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9 http_proxy=http://127.0.0.1:9 https_proxy=http://127.0.0.1:9
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_ALLOW_PROTOCOL=file
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
unset NO_PROXY no_proxy XDG_DATA_HOME

CURL_LINE='curl -fsSL https://raw.githubusercontent.com/magnus-tornvall/agent-tools/main/install.sh | bash'

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

add_skill() { # repo name: commits a stub skill, mt-<name>, with a guide, which make install links
  mkdir -p "$1/skills/mt-$2"
  printf -- '---\nname: mt-%s\ndescription: A fixture.\n---\n\nRun `mt get %s`.\n' "$2" "$2" >"$1/skills/mt-$2/SKILL.md"
  printf '# %s\n\nDomain: Tools. A fixture.\n' "$2" >"$1/guides/$2.md"
  git -C "$1" add "skills/mt-$2" "guides/$2.md" && git -C "$1" commit -q -m "$2" || fail "committing $2 in $1"
}

# origin: this worktree's files at v0.1.0, with tags that are not releases beside it, and a stub
# skill added at v0.2.0, which main is at.
BASE=$TMP/base
mkdir -p "$BASE"
(cd "$ROOT" && git ls-files -z -co --exclude-standard | tar --null -T - -cf -) | tar -xf - -C "$BASE" ||
  fail "copying the worktree"
git -C "$BASE" init -q -b main && git -C "$BASE" add -A && git -C "$BASE" commit -q -m base || fail "committing the base"
git -C "$BASE" tag v0.1.0
git -C "$BASE" tag v9.9.9-rc1
git -C "$BASE" tag latest
add_skill "$BASE" release-two
git -C "$BASE" tag v0.2.0

origin() { # name -> the path of a fresh copy of the base origin
  cp -R "$BASE" "$TMP/$1.git"
  echo "$TMP/$1.git"
}

commit_of() { # repo rev -> the commit rev names
  git -C "$1" rev-parse "$2^{commit}"
}

clone_of() { # home -> where install.sh clones agent-tools
  echo "$1/.local/share/agent-tools"
}

run_install() { # home origin [VAR=value...] -> runs install.sh as the curl line does, output in $TMP/out
  local home=$1 url=$2
  shift 2
  env HOME="$home" SHELL=/bin/bash AGENT_TOOLS_URL="$url" ADD_MT_RULES=yes "$@" bash <"$ROOT/install.sh" >"$TMP/out" 2>&1
}

installed() { # home origin ref: a clone of origin with ref checked out where install.sh puts it, installed
  local dir
  dir=$(clone_of "$1")
  new_home "$1"
  mkdir -p "$(dirname "$dir")"
  git -c advice.detachedHead=false clone -q --branch "$3" "$2" "$dir" || fail "cloning $2 at $3"
  HOME=$1 SHELL=/bin/bash make -s -C "$dir" install ADD_MT_RULES=yes </dev/null >"$TMP/out" 2>&1 ||
    fail "make install at $3: $(cat "$TMP/out")"
}

update() { # home -> runs the installed mt update, output in $TMP/out
  HOME=$1 SHELL=/bin/bash "$1/.local/bin/mt" update </dev/null >"$TMP/out" 2>&1
}

cloned() { # home origin ref: a clone of origin with ref checked out where install.sh puts it, not installed
  new_home "$1"
  mkdir -p "$(dirname "$(clone_of "$1")")"
  git -c advice.detachedHead=false clone -q --branch "$3" "$2" "$(clone_of "$1")" || fail "cloning $2 at $3"
}

update_clone() { # home [VAR=value...] -> runs the clone's own mt update by its path, output in $TMP/out
  local home=$1
  shift
  env HOME="$home" SHELL=/bin/bash "$@" "$(clone_of "$home")/cli/mt" update </dev/null >"$TMP/out" 2>&1
}

links() { # home -> every link under it with its target
  find "$1" -type l | sort | while read -r link; do echo "$link -> $(readlink "$link")"; done
}

# make stubs: one that succeeds, so only mt update's own logic runs, and one that fails
mkdir -p "$TMP/make-ok" "$TMP/make-fails"
printf '#!/bin/sh\nexit 0\n' >"$TMP/make-ok/make"
printf '#!/bin/sh\necho make failed here >&2\nexit 1\n' >"$TMP/make-fails/make"
chmod +x "$TMP/make-ok/make" "$TMP/make-fails/make"
MAKE_OK=$TMP/make-ok:$PATH
MAKE_FAILS=$TMP/make-fails:$PATH

state() { # clone -> its HEAD, branch, status and the diff of its files
  git -C "$1" rev-parse HEAD
  git -C "$1" symbolic-ref -q HEAD
  git -C "$1" status --porcelain
  git -C "$1" diff | shasum
}

linked() { # home tool -> exit 0 when make install linked the tool's stub, mt-<tool>, from the clone
  [ "$(readlink "$1/.claude/skills/mt-$2")" = "$(clone_of "$1")/skills/mt-$2" ]
}

snapshot() { # folder -> every file in it with its sha1
  (cd "$1" && find . -type f -exec shasum {} + | sort)
}

# the README's curl line runs install.sh from main
grep -qxF "$CURL_LINE" "$ROOT/README.md" || fail "the README does not give the line: $CURL_LINE"
check "the README gives the curl line"

# R1: a fresh machine gets the newest release, other tags ignored, installed
H=$TMP/fresh
O=$(origin fresh)
D=$(clone_of "$H")
new_home "$H"
run_install "$H" "$O"; rc=$?
assert_eq "install.sh on a fresh machine exits 0" 0 "$rc"
assert_eq "the clone has v0.2.0 checked out" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"
git -C "$D" symbolic-ref -q HEAD >/dev/null && fail "the clone is on a branch, not the release tag"
check "the clone is on the release tag, on no branch"
assert_eq "mt links into the clone" "$D/cli/mt" "$(readlink "$H/.local/bin/mt")"
for dir in "$D"/skills/mt-*/; do
  tool=$(basename "$dir")
  tool=${tool#mt-}
  [ -f "$D/guides/$tool.md" ] || continue
  linked "$H" "$tool" || fail "$tool is not linked from the clone"
done
check "every stub skill with a guide is linked from the clone, as make install links them"
linked "$H" release-two || fail "the stub only v0.2.0 has is not linked"
check "the stub only v0.2.0 has is linked"

# C1: the clone goes under XDG_DATA_HOME when it is set
H=$TMP/xdg
new_home "$H"
run_install "$H" "$(origin xdg)" XDG_DATA_HOME="$TMP/xdg-data"; rc=$?
assert_eq "install.sh with XDG_DATA_HOME exits 0" 0 "$rc"
assert_eq "with XDG_DATA_HOME, mt links into the clone there" "$TMP/xdg-data/agent-tools/cli/mt" "$(readlink "$H/.local/bin/mt")"
[ -e "$(clone_of "$H")" ] && fail "with XDG_DATA_HOME, install.sh cloned into ~/.local/share"
check "with XDG_DATA_HOME, nothing is cloned into ~/.local/share"

# R2: a machine without git, make or Bun is refused before anything is cloned
for missing in git make bun; do
  H=$TMP/no-$missing
  new_home "$H"
  bin=$TMP/bin-without-$missing
  mkdir -p "$bin"
  for tool in /bin/* /usr/bin/* "$BUN_DIR/bun"; do
    [ "$(basename "$tool")" = "$missing" ] || [ -e "$bin/$(basename "$tool")" ] || ln -s "$tool" "$bin/"
  done
  run_install "$H" "$(origin "no-$missing")" PATH="$bin"; rc=$?
  [ "$rc" -ne 0 ] || fail "install.sh without $missing exits 0"
  assert_contains "install.sh without $missing names it" "$(cat "$TMP/out")" "not on PATH: $missing"
  [ -e "$(clone_of "$H")" ] && fail "install.sh without $missing created $(clone_of "$H")"
  check "install.sh without $missing creates no clone"
done

# R3: a folder in the clone's place that is not a clone of agent-tools is left as it is
H=$TMP/foreign
O=$(origin foreign)
D=$(clone_of "$H")
new_home "$H"
mkdir -p "$D"
printf 'mine\n' >"$D/notes.txt"
for kind in folder "folder in a clone of agent-tools" "clone of another repo"; do
  case $kind in
    "folder in a clone of agent-tools")
      git -C "$H" init -q && git -C "$H" remote add origin "$O" ;;
    "clone of another repo")
      rm -rf "$H/.git"
      git -C "$D" init -q && git -C "$D" remote add origin "$TMP/another.git" ;;
  esac
  snapshot "$D" >"$TMP/before"
  run_install "$H" "$O"; rc=$?
  [ "$rc" -ne 0 ] || fail "install.sh over a $kind exits 0"
  assert_contains "install.sh over a $kind names it" "$(cat "$TMP/out")" "$D is there but is not a clone of $O"
  snapshot "$D" >"$TMP/after"
  cmp -s "$TMP/before" "$TMP/after" || fail "install.sh changed the $kind"
  check "install.sh leaves the $kind as it is"
done

# R4: install.sh again over a clean clone at an older release moves it forward and installs from it
H=$TMP/again
O=$(origin again)
D=$(clone_of "$H")
new_home "$H"
git -C "$O" tag -d v0.2.0 >/dev/null
run_install "$H" "$O" || fail "install.sh with only v0.1.0: $(cat "$TMP/out")"
assert_eq "with only v0.1.0, install.sh checks it out" "$(commit_of "$O" v0.1.0)" "$(git -C "$D" rev-parse HEAD)"
linked "$H" release-two && fail "v0.2.0's stub is linked at v0.1.0"
git -C "$O" tag v0.2.0 main
run_install "$H" "$O"; rc=$?
assert_eq "install.sh over a clone at v0.1.0 exits 0" 0 "$rc"
assert_eq "install.sh again moves the clone to v0.2.0" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"
linked "$H" release-two || fail "install.sh again did not run make install from v0.2.0"
check "install.sh again runs make install from v0.2.0"

# R5: on a terminal, under curl | bash, the rules question is asked and a yes writes them
H=$TMP/terminal
new_home "$H"
HOME=$H SHELL=/bin/bash AGENT_TOOLS_URL=$(origin terminal) python3 -I -c '
import errno, os, sys
answer, *cmd = sys.argv[1:]
pid, master = os.forkpty()
if pid == 0:
    os.execvp(cmd[0], cmd)
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
_, status = os.waitpid(pid, 0)
sys.stdout.write(out.decode(errors="replace"))
sys.exit(os.waitstatus_to_exitcode(status))' y bash -c 'cat "$1" | bash' install "$ROOT/install.sh" >"$TMP/out" 2>&1
rc=$?
assert_eq "install.sh under curl | bash on a terminal exits 0" 0 "$rc"
assert_contains "the rules question is asked on the terminal" "$(cat "$TMP/out")" "[y/N]"
rules=$(python3 -I -c '
import json, sys
permissions = json.load(open(sys.argv[1]))["permissions"]
print("Bash(mt:*)" in permissions["allow"], "Bash(mt update:*)" in permissions["ask"])' "$H/.claude/settings.json")
assert_eq "a yes allows mt and asks before mt update" "True True" "$rules"

# R6: mt update moves a clone at an older release to the newest and installs from it
H=$TMP/older
O=$(origin older)
D=$(clone_of "$H")
installed "$H" "$O" v0.1.0
update "$H"; rc=$?
assert_eq "mt update from v0.1.0 exits 0" 0 "$rc"
assert_contains "mt update names the release it leaves" "$(cat "$TMP/out")" v0.1.0
assert_contains "mt update names the release it moves to" "$(cat "$TMP/out")" v0.2.0
assert_eq "mt update checks out v0.2.0" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"
linked "$H" release-two || fail "mt update did not run make install from v0.2.0"
check "mt update runs make install from v0.2.0"

# C2: releases compare by number, so v0.10.0 is newer than v0.9.0
add_skill "$O" release-nine && git -C "$O" tag v0.9.0
add_skill "$O" release-ten && git -C "$O" tag v0.10.0
update "$H" || fail "mt update to v0.10.0: $(cat "$TMP/out")"
assert_eq "mt update picks v0.10.0 over v0.9.0" "$(commit_of "$O" v0.10.0)" "$(git -C "$D" rev-parse HEAD)"
H=$TMP/numbers
new_home "$H"
run_install "$H" "$O" || fail "install.sh with v0.10.0: $(cat "$TMP/out")"
assert_eq "install.sh picks v0.10.0 over v0.9.0" "$(commit_of "$O" v0.10.0)" "$(git -C "$(clone_of "$H")" rev-parse HEAD)"

# R7: mt update at the newest release says so and stays
H=$TMP/newest
O=$(origin newest)
D=$(clone_of "$H")
installed "$H" "$O" v0.2.0
update "$H"; rc=$?
assert_eq "mt update at the newest release exits 0" 0 "$rc"
assert_contains "mt update says the clone is at the newest release" "$(cat "$TMP/out")" "already at v0.2.0"
assert_eq "mt update at the newest release keeps v0.2.0" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"

# R8: mt update on main fast-forwards to origin's main and installs from it
H=$TMP/main
O=$(origin main)
D=$(clone_of "$H")
installed "$H" "$O" main
add_skill "$O" release-three
update "$H"; rc=$?
assert_eq "mt update on main exits 0" 0 "$rc"
assert_eq "mt update moves main to origin's main" "$(commit_of "$O" main)" "$(git -C "$D" rev-parse main)"
assert_eq "mt update keeps main checked out" refs/heads/main "$(git -C "$D" symbolic-ref -q HEAD)"
linked "$H" release-three || fail "mt update did not run make install from origin's main"
check "mt update runs make install from origin's main"

# R9: local changes to a tracked file refuse the update and stay
H=$TMP/changed
D=$(clone_of "$H")
installed "$H" "$(origin changed)" v0.1.0
printf 'a local change\n' >>"$D/README.md"
state "$D" >"$TMP/before"
update "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "mt update with local changes exits 0"
assert_contains "mt update names the local changes" "$(cat "$TMP/out")" "local changes"
assert_contains "mt update names the changed file" "$(cat "$TMP/out")" README.md
state "$D" >"$TMP/after"
cmp -s "$TMP/before" "$TMP/after" || fail "mt update with local changes changed the clone"
check "mt update with local changes leaves HEAD and the files as they were"

# R10: a branch other than main refuses the update and stays
H=$TMP/branch
D=$(clone_of "$H")
installed "$H" "$(origin branch)" v0.1.0
git -C "$D" checkout -q -b mine
state "$D" >"$TMP/before"
update "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "mt update on another branch exits 0"
assert_contains "mt update names the branch" "$(cat "$TMP/out")" "on branch mine"
state "$D" >"$TMP/after"
cmp -s "$TMP/before" "$TMP/after" || fail "mt update on another branch changed the clone"
check "mt update on another branch leaves HEAD as it was"

# R11: a clone at a release newer than origin's newest cannot move forward
H=$TMP/ahead
D=$(clone_of "$H")
installed "$H" "$(origin ahead)" v0.2.0
git -C "$D" commit -q --allow-empty -m three && git -C "$D" tag v0.3.0
state "$D" >"$TMP/before"
update "$H"; rc=$?
[ "$rc" -ne 0 ] || fail "mt update ahead of origin exits 0"
assert_contains "mt update says it cannot move forward" "$(cat "$TMP/out")" "cannot move forward to v0.2.0"
state "$D" >"$TMP/after"
cmp -s "$TMP/before" "$TMP/after" || fail "mt update ahead of origin changed the clone"
check "mt update ahead of origin leaves HEAD as it was"

# R12: an unreachable origin fails the update, on a release or on main, and the clone stays
for ref in v0.1.0 main; do
  H=$TMP/unreachable-$ref
  D=$(clone_of "$H")
  installed "$H" "$(origin "unreachable-$ref")" "$ref"
  git -C "$D" remote set-url origin "$TMP/gone.git"
  state "$D" >"$TMP/before"
  update "$H"; rc=$?
  [ "$rc" -ne 0 ] || fail "mt update at $ref with origin unreachable exits 0"
  assert_contains "mt update at $ref names the failed fetch" "$(cat "$TMP/out")" "from origin failed"
  state "$D" >"$TMP/after"
  cmp -s "$TMP/before" "$TMP/after" || fail "mt update at $ref with origin unreachable changed the clone"
  check "mt update at $ref with origin unreachable leaves HEAD as it was"
done

# R11 on main: a main ahead of or diverged from origin's main cannot move forward and stays
for how in "is ahead of" "has diverged from"; do
  H=$TMP/main-${how// /-}
  O=$(origin "main-${how// /-}")
  D=$(clone_of "$H")
  cloned "$H" "$O" main
  git -C "$D" commit -q --allow-empty -m local
  [ "$how" = "is ahead of" ] || git -C "$O" commit -q --allow-empty -m upstream
  state "$D" >"$TMP/before"
  update_clone "$H" PATH="$MAKE_OK"; rc=$?
  assert_eq "mt update when main $how origin's exits 1" 1 "$rc"
  assert_contains "mt update says main $how origin's main" "$(cat "$TMP/out")" "main $how origin's main, so it cannot move forward"
  state "$D" >"$TMP/after"
  cmp -s "$TMP/before" "$TMP/after" || fail "mt update when main $how origin's changed the clone"
  check "mt update when main $how origin's leaves HEAD as it was"
done

# a failed make install after the move exits 1, says to run it again, and keeps the move
H=$TMP/make-fails
O=$(origin make-fails)
D=$(clone_of "$H")
cloned "$H" "$O" v0.1.0
update_clone "$H" PATH="$MAKE_FAILS"; rc=$?
assert_eq "mt update with make install failing exits 1" 1 "$rc"
assert_contains "mt update says make install failed" "$(cat "$TMP/out")" "make install failed in $D"
assert_contains "mt update says to run make install again" "$(cat "$TMP/out")" "run make install there again"
assert_eq "mt update with make install failing keeps the move to v0.2.0" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"

# a local release tag origin lacks is not a release to move to
H=$TMP/local-tag
O=$(origin local-tag)
D=$(clone_of "$H")
cloned "$H" "$O" v0.1.0
git -C "$D" tag v0.5.0 "$(git -C "$D" commit-tree "HEAD^{tree}" -p HEAD -m local)"
update_clone "$H" PATH="$MAKE_OK"; rc=$?
assert_eq "mt update with a local v0.5.0 exits 0" 0 "$rc"
assert_eq "mt update moves to origin's v0.2.0, not the local v0.5.0" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"

# refusals that leave the clone as it was: no release on origin, detached at a commit that is no
# release, git or make missing
H=$TMP/norelease
O=$(origin norelease)
D=$(clone_of "$H")
cloned "$H" "$O" v0.1.0
git -C "$O" tag -d v0.1.0 v0.2.0 >/dev/null
for kind in "no release on origin" "detached at no release" "no git" "no make"; do
  env=(PATH="$MAKE_OK")
  case $kind in
    "no release on origin") want="origin has no release tag" ;;
    "detached at no release")
      git -C "$D" remote set-url origin "$(origin detached)"
      git -C "$D" -c advice.detachedHead=false checkout -q --detach "$(git -C "$D" commit-tree "HEAD^{tree}" -p HEAD -m local)"
      want="neither main nor a release tag" ;;
    "no git") env=(PATH="$TMP/bin-without-git"); want="git is not on PATH" ;;
    "no make") env=(PATH="$TMP/bin-without-make"); want="make is not on PATH" ;;
  esac
  state "$D" >"$TMP/before"
  update_clone "$H" "${env[@]}"; rc=$?
  assert_eq "mt update with $kind exits 1" 1 "$rc"
  assert_contains "mt update with $kind says so" "$(cat "$TMP/out")" "$want"
  state "$D" >"$TMP/after"
  cmp -s "$TMP/before" "$TMP/after" || fail "mt update with $kind changed the clone"
  check "mt update with $kind leaves the clone as it was"
done

# an argument is a usage error
state "$D" >"$TMP/before"
env HOME="$H" "$D/cli/mt" update now </dev/null >"$TMP/out" 2>&1; rc=$?
assert_eq "mt update with an argument exits 2" 2 "$rc"
assert_contains "mt update names the argument" "$(cat "$TMP/out")" "unexpected argument 'now'"
state "$D" >"$TMP/after"
cmp -s "$TMP/before" "$TMP/after" || fail "mt update with an argument changed the clone"

# install.sh with no release on origin, or origin unreachable, fails and clones nothing
for kind in "no release" unreachable; do
  H=$TMP/install-${kind// /-}
  new_home "$H"
  case $kind in
    "no release")
      O=$(origin install-norelease)
      git -C "$O" tag -d v0.1.0 v0.2.0 >/dev/null
      want="$O has no release tag" ;;
    unreachable) O=$TMP/gone.git; want="listing the tags of $O failed" ;;
  esac
  run_install "$H" "$O"; rc=$?
  assert_eq "install.sh with $kind exits 1" 1 "$rc"
  assert_contains "install.sh with $kind says so" "$(cat "$TMP/out")" "$want"
  [ -e "$(clone_of "$H")" ] && fail "install.sh with $kind created $(clone_of "$H")"
  check "install.sh with $kind creates no clone"
done

# install.sh takes another spelling of origin's URL as the same repo and runs the clone's mt update
H=$TMP/spelled
O=$(origin spelled)
D=$(clone_of "$H")
cloned "$H" "$O" v0.1.0
for spelling in "$O/" "${O%.git}"; do
  git -C "$D" -c advice.detachedHead=false checkout -q --detach v0.1.0
  git -C "$D" remote set-url origin "$spelling"
  run_install "$H" "$O" PATH="$MAKE_OK"; rc=$?
  assert_eq "install.sh over a clone whose origin is $spelling exits 0" 0 "$rc"
  assert_eq "install.sh over a clone whose origin is $spelling moves it to v0.2.0" "$(commit_of "$O" v0.2.0)" "$(git -C "$D" rev-parse HEAD)"
done

# install.sh takes GitHub's https and ssh spellings of this repo as the same and refuses another;
# taken, the clone's mt update runs and fails at the fetch, which may reach local paths alone
GITHUB=github.com/magnus-tornvall/agent-tools
for pair in "git@github.com:magnus-tornvall/agent-tools.git|" "https://$GITHUB|ssh://git@$GITHUB.git" \
  "ssh://git@$GITHUB|https://$GITHUB.git" "git@github.com:someone-else/agent-tools.git|"; do
  spelling=${pair%%|*}
  url=${pair#*|}
  git -C "$D" remote set-url origin "$spelling"
  state "$D" >"$TMP/before"
  run_install "$H" "$url" PATH="$MAKE_OK"; rc=$?
  assert_eq "install.sh over a clone whose origin is $spelling exits 1" 1 "$rc"
  case $spelling in
    *someone-else*)
      assert_contains "install.sh refuses a clone of another GitHub repo" "$(cat "$TMP/out")" "is there but is not a clone" ;;
    *)
      case $(cat "$TMP/out") in *"not a clone"*) fail "install.sh refused a clone whose origin is $spelling" ;; esac
      assert_contains "install.sh hands a clone whose origin is $spelling to its mt update" "$(cat "$TMP/out")" "mt: update: fetching the tags from origin failed" ;;
  esac
  state "$D" >"$TMP/after"
  cmp -s "$TMP/before" "$TMP/after" || fail "install.sh over a clone whose origin is $spelling changed it"
done

# install.sh refuses while ~/.local/bin/mt links into another clone, and clones and links nothing
H=$TMP/linked-elsewhere
O=$(origin linked-elsewhere)
OTHER=$H/dev/agent-tools
new_home "$H"
git clone -q "$O" "$OTHER" || fail "cloning $O into $OTHER"
HOME=$H SHELL=/bin/bash make -s -C "$OTHER" install ADD_MT_RULES=no </dev/null >"$TMP/out" 2>&1 ||
  fail "make install in $OTHER: $(cat "$TMP/out")"
links "$H" >"$TMP/before"
run_install "$H" "$O"; rc=$?
assert_eq "install.sh with mt linked into another clone exits 1" 1 "$rc"
assert_contains "install.sh names the other clone and says to uninstall it" "$(cat "$TMP/out")" "links into $OTHER; run make uninstall there first"
[ -e "$(clone_of "$H")" ] && fail "install.sh with mt linked into another clone created $(clone_of "$H")"
links "$H" >"$TMP/after"
cmp -s "$TMP/before" "$TMP/after" || fail "install.sh with mt linked into another clone changed a link"
check "install.sh with mt linked into another clone clones and links nothing"
