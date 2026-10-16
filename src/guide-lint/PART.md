# guide-lint

Domain: Tools. guide-lint fails when a guide, a stub skill or the charter mentions in backticks an
`mt` guide, reference or command, or an `orca` command or flag, that no longer exists, or a
platform's command outside that platform's reference; when a guide names a spec section the spec
guide does not declare; and when a fixed rule sits outside the home the charter names for it, or
a home carries none. Its code is
`src/guide-lint/`: `lint.ts` matches mentions and reads no files, `main.ts` gathers the files and
runs the tools. `test/guides.sh` runs it on this repo.

## Purpose

An agent that loads a guide never meets a command or guide that is gone: the prose agents follow
stays in step with the tools it names. The parts stay agnostic of the platform that runs a Run:
one platform's commands live only in its reference. And what one part states for the others
stays where they can find it: a judge's reference names spec sections it never sees declared, and
a fixed rule read through `mt get` is found only in its home, so a rename in the spec guide or a
rule moved or copied fails here instead of drifting.

## Principles

- **Design by contract.** A mention is a claim about a tool's interface, checked against what the
  tool itself publishes: `mt --help` for `mt` commands, `mt get` for guides and references, and
  `orca agent-context --json` for Orca commands and flags.
- **Single source of truth.** guide-lint keeps no list of commands; each check reads the tool's
  own, so a new `mt` command is known once its usage lists it.
- **Falsifiability.** Each failure names the file, the line, the mention and the reason. A source
  it cannot read fails as one line instead of passing every mention.
- **Mechanism, not policy.** It checks that what a mention names exists, never what a guide
  should say or mention.
- **Leave no trace.** Running the tools it checks writes nothing the owner keeps.

## Contract

`bun src/guide-lint/main.ts <repo>`, or `bash test/guides.sh` for this repo.

- Reads every Markdown file under `<repo>/guides/`, `<repo>/skills/*/SKILL.md` and
  `<repo>/AGENTS.md`. A mention is a backticked span that starts with `mt ` or `orca `; a span may
  wrap onto the next line of its paragraph.
- An `mt get` mention is run as `<repo>/cli/mt get <args>`: exit 0 resolves, 1 is no such guide or
  reference, 2 is arguments `mt get` rejects. One with a `<placeholder>` for its tool is skipped;
  a placeholder ref is dropped with its flag and the guide is still checked. Any other `mt`
  mention resolves when its plain words match, as a prefix either way, a command `mt --help`
  lists.
- A mention of two or more words whose first word names a platform with a reference,
  `guides/coordinate/<platform>.md`, fails anywhere but that reference, whether or not the
  platform is on PATH. The platforms are read from the files there, not from a list.
- An `orca` mention resolves when its command path and every `--flag` appear in
  `orca agent-context --json`, schema version 1, a `commands` array whose entries each have a
  string `command` and an array `path`. A path's proper prefix is a group, which takes a
  subcommand, never an argument. Without `orca` on PATH it checks the `mt` mentions only and says
  so in one line.
- A backticked span that is a title-case phrase, such as `In scope`, names a spec section. Each
  one outside `guides/spec.md` must be one `guides/spec.md` itself names in backticks; with no
  spec guide, or one naming no section, none is checked.
- The charter's `## Fixed` section names each fixed rule's home as an `mt get` mention: the
  tool's guide, one reference, or every reference of the tool for `--ref <placeholder>`. Each
  home that exists must carry the sentence `Fixed: changing it is the owner's call.`, and no
  guide or stub outside the homes may carry it. A charter with no such section, or none, checks
  neither. It catches a rule moved or copied, not one reworded.
- On success it prints `guide-lint: <n> mt mentions [and <m> Orca mentions] resolve; placeholder
  mentions skipped: <k>` and exits 0. Otherwise it prints one ``<file>:<line>: `<mention>`:
  <reason>`` line per failing mention, or one line when `mt --help` prints no usage, there are no
  guides, or `orca agent-context --json` fails, is not JSON or has an unreadable shape, and exits 1.
  A section the spec guide does not declare fails as a mention; a home without a fixed rule fails
  at the charter line that names it, and a stray fixed rule at its own line.
  No repo exits 2.
- Side effects: it runs only `mt --help`, `mt get` and `orca agent-context --json`, and writes
  nothing.

## Config

guide-lint reads no config: not the owner's `mt` config, which it never opens, and no setting of
its own.

## Workarounds

An `orca` mention that opens with a flag or holds a short flag (`-x`) fails, since it cannot be
checked: write the command path first, then long flags. Workaround for `orca agent-context --json`
listing only long flags; remove when it lists each short flag with the long one it stands for.
