# Install mt and its stub skills from this clone, or uninstall them. Every target is safe to run
# again: it changes only what is missing or stale. Override the folders for another agent or a
# test, e.g.
#   make install SKILLS_DIR=~/.claude/skills
# Adding the mt rules to Claude Code's settings, or removing them, is asked first;
# ADD_MT_RULES=yes|no and REMOVE_MT_RULES=yes|no answer without asking.

BIN_DIR         ?= $(HOME)/.local/bin
SKILLS_DIR      ?= $(HOME)/.agents/skills
SETTINGS        ?= $(HOME)/.claude/settings.json
ADD_MT_RULES    ?=
REMOVE_MT_RULES ?=

REPO := $(CURDIR)

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

# Links every tool mt list shows, and removes links into this clone whose stub is gone. A real
# folder in the way is left alone: ln -sfn would write a stray link inside it.
skills: bun
	@mkdir -p "$(SKILLS_DIR)"
	@status=0; \
	for tool in $$("$(REPO)/cli/mt" list | awk '{print $$1}'); do \
	  link="$(SKILLS_DIR)/$$tool"; \
	  if [ -d "$$link" ] && [ ! -L "$$link" ]; then \
	    echo "$$link is a real folder, not a link; move it out of $(SKILLS_DIR) and run make again" >&2; \
	    status=1; continue; \
	  fi; \
	  ln -sfn "$(REPO)/skills/$$tool" "$$link"; \
	done; \
	for link in "$(SKILLS_DIR)"/*; do \
	  [ -L "$$link" ] && [ ! -e "$$link" ] || continue; \
	  case $$(readlink "$$link") in "$(REPO)/skills/"*) rm "$$link"; echo "removed stale $$link";; esac; \
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

# Removes only links into this clone, so a skill or mt installed some other way stays. Leaves Bun,
# the clone and its node_modules, your shell profile and mt's usage log.
uninstall:
	@if [ "$$(readlink "$(BIN_DIR)/mt")" = "$(REPO)/cli/mt" ]; then rm "$(BIN_DIR)/mt"; echo "removed $(BIN_DIR)/mt"; fi
	@for link in "$(SKILLS_DIR)"/*; do \
	  [ -L "$$link" ] || continue; \
	  case $$(readlink "$$link") in "$(REPO)/skills/"*) rm "$$link"; echo "removed $$link";; esac; \
	done
	@bun "$(REPO)/src/install/mt-rules.ts" remove "$(SETTINGS)" "$(REMOVE_MT_RULES)"
