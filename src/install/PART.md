# install

Domain: Tools. Install puts `mt` and its stub skills where agents find them, and offers the owner
the Claude Code permission rules that let agents run `mt`; uninstall takes back out what install
put there. Its code is the Makefile's `install` and `uninstall` targets and the targets they run,
`src/install/mt-rules.ts`, which edits the settings, and `src/install/side-effects.ts`, which
declares each `mt` command's side-effect class. The README keeps the steps a human follows.

## Purpose

An agent, or an Orca worker started in the owner's login shell, can run every `mt` command the
owner does not keep and load every stub, and is asked before an `mt` command whose own effect
reaches a service off the machine. Oracles are the owner's to write and run, so an agent in Claude
Code is refused `mt oracle` and `mt get oracle`. A class covers what `mt` itself does.
`mt oracle run` runs the commands of a shape, which may reach further, and nothing checks who wrote
or approved the shape it runs.

## Principles

- **Idempotence.** Every target converges on the desired state: it changes only what is missing or
  stale, so it is safe to run again after a pull or on a half-set-up machine.
- **Least privilege**, as far as `mt`'s own effects go. A command's permission follows from its
  side-effect class, declared once in code: read-only and local-write commands are allowed, and
  each external command is asked before it runs. What only the owner runs is denied to agents,
  whatever its class. The commands `mt oracle run` runs for a shape are not `mt`'s own and are not
  classed.
- **Mechanism, not policy.** Install proposes the rules; the owner decides. Nothing is written to
  the settings without a yes, and with no answer and no terminal nothing is written.
- **Ownership.** Uninstall removes only what install made: links that point into this clone and
  the rules it adds, so a skill, an `mt` or a rule put there some other way stays.
- **Fail safe.** What install cannot change without harm, it leaves as it is and fails naming it:
  a real folder where a link would go, settings that are not JSON, or a permission list that is
  not a list of strings.
- **Observable end state.** Install is done when a login shell started from the owner's profile
  alone finds `mt` and Bun, the PATH an Orca worker gets, and it checks exactly that.

## Contract

`make install` and `make uninstall` run from the clone. They take `BIN_DIR`, `SKILLS_DIR` and
`SETTINGS`, the places to link `mt`, link the stubs and edit the rules, defaulting to
`~/.local/bin`, `~/.agents/skills` and `~/.claude/settings.json`; `ADD_MT_RULES` and
`REMOVE_MT_RULES`, `yes` or `no`, answer the settings question without asking. Install needs Bun
1.2.23 or later on PATH.

- `install` leaves the clone's dependencies installed from its lockfile, `BIN_DIR/mt` linking to
  `cli/mt`, each stub skill that has a guide linked into `SKILLS_DIR`, no link into this clone left
  for a stub that is gone, the rules in `SETTINGS` if the owner said yes, and a login shell that
  finds `mt` and Bun. It prints what it changed and exits 0, or fails, naming the cause on stderr:
  Bun missing or too old, `BIN_DIR/mt` a folder, a stub's place a real folder, settings it cannot
  read, or a login shell that cannot find `mt` and Bun.
- `uninstall` leaves no `mt` link and no link in `SKILLS_DIR` that points into this clone, and the
  rules removed if the owner said yes. It leaves Bun, the clone and its `node_modules`, the shell
  profile and `mt`'s usage log.
- `bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]` adds or removes the rules,
  keeping everything else in the file. `add` creates a missing file. It asks only when there is
  something to change, and exits 0 whether it changed the file, found nothing to change or was
  declined; declined, it prints one line naming what it left as it is. A file that is not a JSON
  object, or whose `permissions` is not an object or whose `permissions.allow`, `permissions.ask`
  or `permissions.deny` is not a list of strings, is left as it is: one line on stderr says which,
  naming the rules to add by hand when the file is not a JSON object, and it exits 1. A usage
  error exits 2.
- The rules are those `rules()` in `side-effects.ts` builds: `Bash(mt:*)` in `permissions.allow`,
  and in `permissions.ask` one `Bash(mt <command>:*)` per external command that no shorter
  external command covers by prefix, and in `permissions.deny` one `Bash(mt <prefix>:*)` per
  owner-only prefix, `Bash(mt oracle:*)` and `Bash(mt get oracle:*)`. Claude Code checks deny
  rules, then ask rules, then allow rules. Today the one ask rule is `Bash(mt dogfood:*)`, covering
  `mt dogfood triage`. A deny rule matches the command as an agent writes it, so `mt` by its path
  or inside `sh -c` is not refused.
- Side effects: local writes to `BIN_DIR`, `SKILLS_DIR` and `SETTINGS`; `bun install` fetches
  packages from the npm registry.

A new `mt` command gets its class in `side-effects.ts`; a test fails while a command in
`mt --help` has none.

## Config

Install reads no config: not the owner's `mt` config, which it never opens. Its places and answers
come from the make variables above, each the owner's choice for that run.

## Workarounds

A settings file that still holds `Bash(mt get:*)`, `Bash(mt list)` or `Bash(mt shape:*)` has them
replaced by `Bash(mt:*)` on install, and removed on uninstall. Workaround for settings an install
before `Bash(mt:*)` wrote; remove when no such install is left.
