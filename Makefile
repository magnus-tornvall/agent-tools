# Install mt and its stub skills from this clone, or uninstall them. Every target is safe to run
# again: it changes only what is missing or stale. The stubs are linked into ~/.agents/skills, and
# Claude Code's folder links to them there; with no ~/.agents/skills they go straight into Claude
# Code's folder. Override the folders for another agent or a test, e.g.
#   make install SKILLS_DIR=~/.claude/skills
# A SKILLS_DIR override links the stubs into that folder alone and leaves Claude Code's folder as
# it is.
# Adding the mt rules to Claude Code's settings, or removing them, is asked first;
# ADD_MT_RULES=yes|no and REMOVE_MT_RULES=yes|no answer without asking. src/install/PART.md is
# install's contract.

BIN_DIR           ?= $(HOME)/.local/bin
CLAUDE_SKILLS_DIR ?= $(HOME)/.claude/skills
SETTINGS          ?= $(HOME)/.claude/settings.json
ADD_MT_RULES      ?=
REMOVE_MT_RULES   ?=
# CLAUDE_LINKS, the folder Claude Code's links go in, is set only when SKILLS_DIR is not given: an
# override, for another agent, touches that folder alone.
ifeq ($(origin SKILLS_DIR),undefined)
SKILLS_DIR := $(if $(shell [ -d "$(HOME)/.agents/skills" ] && echo y),$(HOME)/.agents/skills,$(CLAUDE_SKILLS_DIR))
CLAUDE_LINKS := $(CLAUDE_SKILLS_DIR)
endif

REPO := $(CURDIR)

# Defines linked_dir LINK, the physical path of the folder LINK points into, however LINK spells
# it: a hand-made link may be relative; into_clone LINK, true when that folder is in this clone's
# skills; and stub_link LINK, true when LINK points into the clone or to a link in SKILLS_DIR that
# does. Needs $skills, SKILLS_DIR's physical path.
STUB_LINK = linked_dir() { \
  target=$$(readlink "$$1") || return 1; \
  case $$target in /*) ;; *) target=$$(dirname "$$1")/$$target;; esac; \
  target=$${target%/}; \
  cd -P "$$(dirname "$$target")" 2>/dev/null && pwd; \
}; \
into_clone() { \
  case $$(linked_dir "$$1")/ in "$$(cd -P "$(REPO)/skills" && pwd)"/*) return 0;; esac; \
  return 1; \
}; \
stub_link() { \
  into_clone "$$1" && return 0; \
  [ -n "$$skills" ] && [ "$$(linked_dir "$$1")" = "$$skills" ] && \
    into_clone "$(SKILLS_DIR)/$$(basename "$$(readlink "$$1")")"; \
}

.PHONY: install uninstall bun deps mt skills permissions path

install: deps mt skills permissions path

bun:
	@command -v bun >/dev/null || { echo "bun is not on PATH; install it from https://bun.sh" >&2; exit 1; }
	@bun -e 'if (!Bun.semver.satisfies(Bun.version, ">=1.2.23")) { console.error(`bun ${Bun.version} is too old; mt needs 1.2.23 or later`); process.exit(1); }'

deps: bun
	@bun install --frozen-lockfile

mt:
	@mkdir -p "$(BIN_DIR)"
	@if [ -d "$(BIN_DIR)/mt" ] && [ ! -L "$(BIN_DIR)/mt" ]; then \
	  echo "$(BIN_DIR)/mt is a folder; move it away and run make again" >&2; exit 1; \
	fi
	@ln -sfn "$(REPO)/cli/mt" "$(BIN_DIR)/mt"

# Links every stub that has a guide into SKILLS_DIR, and each into CLAUDE_LINKS when that is
# another folder, and removes links to a stub that is gone. A real folder or file in the way is
# left alone: ln -sfn would write a stray link inside the folder, or replace the file. A link that
# already leads to its target's place, however it spells the path, is left as it is. The folders
# are compared by physical path, so a Claude Code folder that links to SKILLS_DIR gets no link to
# itself.
skills:
	@mkdir -p "$(SKILLS_DIR)" $(if $(CLAUDE_LINKS),"$(CLAUDE_LINKS)")
	@$(STUB_LINK); \
	place() { \
	  if [ -e "$$2" ] && [ ! -L "$$2" ]; then \
	    [ -d "$$2" ] && what=folder || what=file; \
	    echo "$$2 is a real $$what, not a link; move it out of $$(dirname "$$2") and run make again" >&2; \
	    status=1; return 1; \
	  fi; \
	  to=$$(readlink "$$2") && \
	    [ "$$(cd -P "$$(dirname "$$2")" && cd -P "$$(dirname "$$to")" 2>/dev/null && pwd)/$$(basename "$$to")" = \
	      "$$(cd -P "$$(dirname "$$1")" && pwd)/$$(basename "$$1")" ] && return 0; \
	  ln -sfn "$$1" "$$2"; \
	}; \
	skills=$$(cd -P "$(SKILLS_DIR)" && pwd); \
	claude=$(if $(CLAUDE_LINKS),$$(cd -P "$(CLAUDE_LINKS)" && pwd),$$skills); \
	status=0; \
	for dir in "$(REPO)"/skills/*/; do \
	  tool=$$(basename "$$dir"); \
	  [ -f "$(REPO)/guides/$$tool.md" ] || continue; \
	  place "$(REPO)/skills/$$tool" "$(SKILLS_DIR)/$$tool" || continue; \
	  [ "$$claude" != "$$skills" ] || continue; \
	  place "$(SKILLS_DIR)/$$tool" "$(CLAUDE_LINKS)/$$tool"; \
	done; \
	if [ "$$claude" != "$$skills" ]; then \
	  for link in "$(CLAUDE_LINKS)"/*; do \
	    [ -L "$$link" ] && [ ! -e "$$link" ] && stub_link "$$link" || continue; \
	    rm "$$link"; echo "removed stale $$link"; \
	  done; \
	fi; \
	for link in "$(SKILLS_DIR)"/*; do \
	  [ -L "$$link" ] && [ ! -e "$$link" ] && into_clone "$$link" || continue; \
	  rm "$$link"; echo "removed stale $$link"; \
	done; \
	exit $$status

permissions: bun
	@bun "$(REPO)/src/install/mt-rules.ts" add "$(SETTINGS)" "$(ADD_MT_RULES)"

# Orca starts a worker in a terminal running your shell, so a login shell must find both from your
# profile alone, not from the PATH make was started with.
path:
	@env -i HOME="$$HOME" PATH=/usr/bin:/bin "$$SHELL" -lic 'command -v mt && command -v bun' </dev/null >/dev/null 2>&1 || { \
	  echo "a new $$SHELL login shell cannot find mt and bun; add $(BIN_DIR) and bun's folder to PATH in your shell profile" >&2; \
	  exit 1; \
	}
	@echo "mt is installed; agents and Orca workers can run it"

# Removes only links into this clone, and links in Claude Code's folder to a stub in SKILLS_DIR, so
# a skill or mt installed some other way stays. With ~/.agents/skills gone, a link in Claude Code's
# folder to a skill there is removed too, since it no longer leads anywhere. Leaves Bun, the clone
# and its node_modules, your shell profile and mt's usage log.
uninstall:
	@if [ "$$(readlink "$(BIN_DIR)/mt")" = "$(REPO)/cli/mt" ]; then rm "$(BIN_DIR)/mt"; echo "removed $(BIN_DIR)/mt"; fi
	@$(STUB_LINK); \
	skills=$$(cd -P "$(SKILLS_DIR)" 2>/dev/null && pwd); \
	claude=$(if $(CLAUDE_LINKS),$$(cd -P "$(CLAUDE_LINKS)" 2>/dev/null && pwd),$$skills); \
	if [ -n "$$claude" ] && [ "$$claude" != "$$skills" ]; then \
	  for link in "$(CLAUDE_LINKS)"/*; do \
	    [ -L "$$link" ] && stub_link "$$link" || continue; \
	    rm "$$link"; echo "removed $$link"; \
	  done; \
	fi; \
	if [ -n "$(CLAUDE_LINKS)" ] && [ ! -e "$(HOME)/.agents/skills" ]; then \
	  home=$$(cd -P "$(HOME)" && pwd); \
	  for link in "$(CLAUDE_LINKS)"/*; do \
	    [ -L "$$link" ] && [ ! -e "$$link" ] || continue; \
	    target=$$(readlink "$$link"); \
	    case $$target in /*) ;; *) target=$$(dirname "$$link")/$$target;; esac; \
	    target=$${target%/}; \
	    case $$target in */.agents/skills/*/*) continue;; */.agents/skills/*) ;; *) continue;; esac; \
	    [ "$$(cd -P "$${target%/.agents/skills/*}" 2>/dev/null && pwd)" = "$$home" ] || continue; \
	    rm "$$link"; echo "removed $$link"; \
	  done; \
	fi; \
	for link in "$(SKILLS_DIR)"/*; do \
	  [ -L "$$link" ] && into_clone "$$link" || continue; \
	  rm "$$link"; echo "removed $$link"; \
	done
	@bun "$(REPO)/src/install/mt-rules.ts" remove "$(SETTINGS)" "$(REMOVE_MT_RULES)"
