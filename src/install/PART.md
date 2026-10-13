# install

Domain: Tools. Install puts `mt` and its stub skills where agents find them, and offers the owner
the Claude Code permission rules that let agents run `mt`; uninstall takes back out what install
put there. Its code is the Makefile's `install` and `uninstall` targets and the targets they run,
`src/install/mt-rules.ts`, which edits the settings, and `src/install/side-effects.ts`, which
declares each `mt` command's side-effect class. The README keeps the steps a human follows.

## Purpose

An agent, or an Orca worker started in the owner's login shell, can run every `mt` command and
load every stub, and every `mt` command's own effect stays on the machine. A class covers what
`mt` itself does. `mt oracle run` runs the commands of a shape, which may reach further. It is
allowed so a worker runs its oracles without a prompt, and nothing checks who wrote or approved the
shape it runs.

## Principles

- **Idempotence.** Every target converges on the desired state: it changes only what is missing or
  stale, so it is safe to run again after a pull or on a half-set-up machine.
- **Least privilege**, as far as `mt`'s own effects go. A command's class is declared once in code.
  Every class, read-only or local write, stays on the machine, so the one allow rule `Bash(mt:*)`
  covers every command; a class that leaves the machine would have to bring install's handling with
  it. The commands `mt oracle run` runs for a shape are not `mt`'s own and are not classed.
- **Mechanism, not policy.** Install proposes the rules; the owner decides. Nothing is written to
  the settings without a yes, and with no answer and no terminal nothing is written.
- **Ownership** is by where a link points, not by who made it. Uninstall removes the links that
  point into this clone, or to a stub link in `SKILLS_DIR`, and the rules install adds, so a skill
  or an `mt` that points elsewhere, and any other rule, stays.
- **Fail safe.** What install cannot change without harm, it leaves as it is and fails naming it:
  a real folder or file where a link would go, settings that are not JSON, or a `permissions.allow`
  that is not a list of strings.
- **Observable end state.** Install is done when a login shell started from the owner's profile
  alone finds `mt` and Bun, the PATH an Orca worker gets, and it checks exactly that.

## Contract

`make install` and `make uninstall` run from the clone. They take `BIN_DIR`, `SKILLS_DIR`,
`CLAUDE_SKILLS_DIR` and `SETTINGS`, the places to link `mt`, link the stubs, link Claude Code's
skills and edit the rules, defaulting to `~/.local/bin`, `~/.agents/skills`, `~/.claude/skills`
and `~/.claude/settings.json`; `ADD_MT_RULES` and `REMOVE_MT_RULES`, `yes` or `no`, answer the
settings question without asking. With `SKILLS_DIR` not given and no `~/.agents/skills` folder as
make starts, `SKILLS_DIR` is `CLAUDE_SKILLS_DIR`, so the stubs are linked straight into Claude
Code's folder and `~/.agents` is not created. Install and uninstall touch `CLAUDE_SKILLS_DIR` only
when `SKILLS_DIR` is not given: an override, for another agent, works on that folder alone. Install
needs Bun 1.2.23 or later on PATH.

- `install` leaves the clone's dependencies installed from its lockfile, `BIN_DIR/mt` linking to
  `cli/mt`, each stub skill that has a guide linked into `SKILLS_DIR`, and, when it links Claude
  Code's folder and that is another folder, `CLAUDE_SKILLS_DIR/<tool>` linking to
  `SKILLS_DIR/<tool>`; no link left for a stub that is gone, whether into this clone or to such a
  link in `SKILLS_DIR`; the rules in `SETTINGS` if the owner said yes, and a login shell that finds
  `mt` and Bun. It prints what it changed and exits 0, or fails, naming the cause on stderr: Bun
  missing or too old, `BIN_DIR/mt` a folder, a stub's place a real folder or file, settings it
  cannot read, or a login shell that cannot find `mt` and Bun.
- `uninstall` leaves no `mt` link, no link in `SKILLS_DIR` or `CLAUDE_SKILLS_DIR` that points into
  this clone, and none in `CLAUDE_SKILLS_DIR` to a link in `SKILLS_DIR` that does, absolute or
  relative, whoever made it; with `~/.agents/skills` gone, none in `CLAUDE_SKILLS_DIR` to it; and
  the rules removed if the owner said yes. It leaves Bun, the clone and its `node_modules`, the
  shell profile and `mt`'s usage log.
- `bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]` adds or removes the rules,
  keeping everything else in the file. `add` creates a missing file. It asks only when there is
  something to change, and exits 0 whether it changed the file, found nothing to change or was
  declined. A file that is not a JSON object, or whose `permissions` is not an object or whose
  `permissions.allow` is not a list of strings, is left as it is: one line on stderr says which,
  naming the rule to add by hand when the file is not a JSON object, and it exits 1. A usage error
  exits 2.
- The rule is `ALLOW_RULES` in `side-effects.ts`: `Bash(mt:*)` in `permissions.allow`, which
  allows every command, as every class is allowed. Install writes no `permissions.ask` and leaves
  one that is there as it is.
- Side effects: local writes to `BIN_DIR`, `SKILLS_DIR`, `CLAUDE_SKILLS_DIR` when `SKILLS_DIR` is
  not given, and `SETTINGS`;
  `bun install` fetches packages from the npm registry.

A new `mt` command gets its class in `side-effects.ts`; a test fails while a command in
`mt --help` has none.

## Config

Install reads no config: not the owner's `mt` config, which it never opens. Its places and answers
come from the make variables above, each the owner's choice for that run.

## Workarounds

A settings file that still holds `Bash(mt get:*)`, `Bash(mt list)` or `Bash(mt shape:*)` has them
replaced by `Bash(mt:*)` on install, and removed on uninstall. Workaround for settings an install
before `Bash(mt:*)` wrote; remove when no such install is left.
