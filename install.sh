#!/bin/bash
# Installs agent-tools from its newest release: clones it into
# ${XDG_DATA_HOME:-$HOME/.local/share}/agent-tools with the highest vMAJOR.MINOR.PATCH tag checked
# out, and runs make install there. Run again over that clone, it runs the clone's mt update. It
# needs git, make and Bun on PATH, and installs none of them. While ~/.local/bin/mt links into
# another clone, it refuses and touches nothing. The README's Install section runs it:
#   curl -fsSL https://raw.githubusercontent.com/magnus-tornvall/agent-tools/main/install.sh | bash
# AGENT_TOOLS_URL clones another repo, such as a local one in a test.

set -u

fail() {
  echo "install.sh: $*" >&2
  exit 1
}

# The repo a URL names, without a trailing slash or .git and with GitHub's ssh forms spelled as its
# https one, so two spellings of one URL compare equal.
repo() {
  local url=${1%/}
  url=${url%.git}
  case $url in
    git@github.com:*) url=https://github.com/${url#git@github.com:} ;;
    ssh://git@github.com/*) url=https://github.com/${url#ssh://git@github.com/} ;;
  esac
  echo "$url"
}

# The folder of the clone that $HOME/.local/bin/mt links into, when that is not the clone at $1.
other_clone() {
  local link=$HOME/.local/bin/mt target folder
  [ -L "$link" ] && [ -e "$link" ] || return 0
  target=$(readlink "$link")
  case $target in */cli/mt) ;; *) return 0 ;; esac
  folder=$(cd -P "$(dirname "$link")" && cd -P "$(dirname "$target")/.." && pwd)
  [ "$folder" = "$(cd -P "$1" 2>/dev/null && pwd)" ] || echo "$folder"
}

main() {
  local url=${AGENT_TOOLS_URL:-https://github.com/magnus-tornvall/agent-tools.git}
  local dir=${XDG_DATA_HOME:-$HOME/.local/share}/agent-tools
  local missing="" tool input=/dev/null tag other
  for tool in git make bun; do
    command -v "$tool" >/dev/null || missing="$missing $tool"
  done
  [ -z "$missing" ] || fail "not on PATH:$missing; install it and run this again"

  # Under curl | bash, stdin is this script, so make install asks its question on the terminal.
  if (: </dev/tty) 2>/dev/null; then input=/dev/tty; fi

  other=$(other_clone "$dir")
  [ -z "$other" ] || fail "$HOME/.local/bin/mt links into $other; run make uninstall there first and run this again"

  if [ -e "$dir" ] || [ -L "$dir" ]; then
    [ -d "$dir" ] && [ "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)" = "$(cd -P "$dir" && pwd)" ] &&
      [ "$(repo "$(git -C "$dir" remote get-url origin 2>/dev/null)")" = "$(repo "$url")" ] ||
      fail "$dir is there but is not a clone of $url; move it away and run this again"
    "$dir/cli/mt" update <"$input"
    return
  fi

  tag=$(git ls-remote --tags --refs "$url") || fail "listing the tags of $url failed"
  tag=$(echo "$tag" | sed -n 's|^.*refs/tags/\(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$|\1|p' |
    sort -t . -k 1.2,1n -k 2,2n -k 3,3n | tail -n 1)
  [ -n "$tag" ] || fail "$url has no release tag vMAJOR.MINOR.PATCH"
  mkdir -p "$(dirname "$dir")" || fail "cannot create $(dirname "$dir")"
  git -c advice.detachedHead=false clone --quiet --branch "$tag" "$url" "$dir" || fail "cloning $url at $tag failed"
  echo "cloned $url at $tag into $dir"
  make -C "$dir" install <"$input"
}

main "$@"
