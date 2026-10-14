# agent-tools

Skills for agents working on the owner's platform, and `mt`, which loads them on demand, checks
and slices shapes, prints the owner's config, and updates its own clone. Install it with one line
(see Install):

```sh
curl -fsSL https://raw.githubusercontent.com/magnus-tornvall/agent-tools/main/install.sh | bash
```

## The shape

A shape is one YAML document: the outcome, its `purpose`, why the outcome matters, requirements
keyed `R1…`, non-goals keyed `N1…`, constraints keyed `C1…`, and decisions keyed `D1…`.
Oracles are not part of it: they are tests in the repo, written as their own commit on the work
branch (`mt get oracle`). The schema in `src/shape/shape.ts` is the contract: a shape is what
`mt shape check` accepts, and `mt get mvc --ref example` prints a filled-in example.

Any producer whose shape passes `mt shape check` is a valid producer. mvc is one producer,
not the contract.

`mt` keeps no drafts and no shapes; whoever produces one stores it.

## mt

`mt` is a loader. A tool's know-how lives in a guide under `guides/`. A tool an agent or the
owner picks also has a stub skill under `skills/<name>/`: its description says when to use the
tool, and its body only tells the agent to run `mt get <name>` and follow what it prints. The
agent's skill list stays short, the guide enters context only when the tool is used, and each
load is logged.

Every stub has a guide. A guide that only a spec or another guide loads has no stub:
worker; brief, which the ask, mvc and coordinate guides load to lay out every message to the
owner; and the assignments change and verification, whose references are its judging
perspectives coverage, maintainer and surprise.
No agent chooses them, so a skill-list entry would only cost the sessions that never use them;
`mt get` serves them like any other guide. The oracle guide has no stub either: an oracle Task runs
only when the owner opts in. Stubs remain for
what an agent or the owner picks: mvc, which settles a shape with the owner, coordinate, which runs
a change unattended, on the platform the request or session names, from a shape, an issue or
prose, ask, which composes a question for whoever owns a decision, door-rule, which says whether a
decision is asked at all, debugging, which finds the root cause of an unexpected failure before it
is fixed, commit, which stages, writes and pushes commits as the session's destination allows, and
research, which answers the owner's question from trusted outside sources; only the owner starts
it, by typing `/research`. `mt list` shows every guide.

```
mt list                       every guide, once, with its stub's description, or the
                              guide's first paragraph when it has no stub
mt get <name>                 print the tool's guide, and log the load
mt get <name> [--ref <ref>]   print one of the tool's references instead, and log the ref
mt shape check <file>         check that a file is a shape; - reads stdin
mt shape slice <file> --keys <key,...>
                              print the shape with only those top-level keys; - reads stdin
mt config [<key>]             print the owner's config, or one key's value
mt update                     move this clone forward along the channel it has checked out,
                              and run make install
mt --help                     print the usage
```

A reference is a file under `guides/<name>/<ref>.md`, for example `mt get coordinate --ref orca`,
except that `mt get mvc --ref example` prints `src/shape/example.yaml`. An unknown tool or ref exits
1 with a message on stderr; the attempt is still logged, with `found` false.

### Contracts

Each command's contract: its purpose, what it takes, what it prints, how it exits, and its
side-effect class. A class is read-only, which reads and prints and writes nothing; local write,
which writes on this machine only; or network, which reaches off this machine. The classes are
declared once in `src/install/side-effects.ts`. The one allow rule `Bash(mt:*)` covers every
command, and an ask rule per network command, `Bash(mt update:*)`, makes Claude Code ask before an
agent runs it (see Install). Every usage error prints `mt: <reason>` and a usage on stderr,
nothing on stdout, and exits 2. Only `mt config` reads the owner's config (see Config); every other
command behaves the same whatever the config holds.

**`mt get <tool> [--ref <ref>]`**, local write. Prints a tool's guide, `guides/<tool>.md`, or one
of its references, `guides/<tool>/<ref>.md`, on stdout and exits 0. A tool or ref with no such
file prints one line on stderr naming it and pointing at `mt list`, and exits 1. A missing tool, a
`--ref` without a value, an unknown option or a second tool exits 2. Each load, found or not, but
no usage error, appends a line to the usage log, read from `MT_LOG`, `XDG_STATE_HOME` and the
session variables (see Usage log); a log that cannot be written is said on stderr and changes no
exit code.

**`mt list`**, read-only. Prints one line per guide under `guides/`, its name padded to 20
columns, then its stub's description, or its first paragraph when it has no stub, and exits 0.
Words after `list` are ignored.

**`mt shape check <file>`**, read-only. Takes a file, or `-` for stdin. Prints nothing and exits 0
when it is a shape. A file that cannot be read, or is not one, prints a line on stderr per
violation, or the reason it cannot be read, and exits 1. No file, two files or an unknown option
exits 2. See Shapes.

**`mt shape slice <file> --keys <key,...>`**, read-only. Takes a file, or `-` for stdin, and the
top-level keys to keep. Prints those keys as YAML on stdout and exits 0. A key the schema does not
define, a file that cannot be read, is not YAML or whose top level is not a map prints a line on
stderr, nothing on stdout, and exits 1. No file, a second file, no `--keys` value or an unknown
option exits 2.

**`mt config [<key>]`**, read-only. Prints the owner's config: the file's path, then one line per
key. With a key, prints that key's value alone. Exits 0, 1 or 2 as Config says.

**`mt update`**, network. Moves the clone `mt` runs from forward along the channel it has checked
out, then runs `make install` from it. With a release tag checked out, it lists origin's tags and
checks out the newest release, the highest `vMAJOR.MINOR.PATCH`, other tags ignored, when it is
newer, printing the release it leaves and the one it moves to; at the newest it says the clone is
already there. With `main` checked out, it fetches origin's `main` and fast-forwards to it; at
origin's `main` it says the clone is already there. It runs `make install` whether or not the clone
moved, its input from `mt update`'s, and exits 0. When `make install` fails, it exits 1 saying to
run `make install` again, and keeps the move. It refuses, exiting 1 with one line on stderr and the
clone's `HEAD`, branch and files as they were, when tracked files have local changes, naming them;
when the clone is on a branch other than `main`, naming it; when it has neither `main` nor a
release checked out; when its release is newer than origin's newest, or its `main` is ahead of or
has diverged from origin's `main`, so it cannot move forward; when origin has no release; when git
or make is not on PATH; and when a fetch from origin fails, naming it. An argument exits 2. Agents
are asked before they run it (see Install).

**`mt`, `mt help`, `mt -h` and `mt --help`**, read-only. Print the usage on stdout and exit 0.
The usage lists every command, and names the usage log's path and the config file's path.

**`mt <anything else>`**, read-only. An unknown command prints `mt: unknown command '<command>'`
and the usage on stderr, and exits 2.

### Usage log

Every `mt get` appends one JSON line to `$MT_LOG`, or to
`${XDG_STATE_HOME:-$HOME/.local/state}/mt/usage.jsonl` when it is unset. This is the log's
format, JSON Lines at that path with these keys; whatever reads the log relies on it:

| key        | value                                                          |
| ---------- | -------------------------------------------------------------- |
| `time`     | UTC time of the load, ISO 8601                                 |
| `tool`     | the tool asked for                                             |
| `ref`      | the reference asked for, or `null`                             |
| `found`    | `true` when a guide was printed, `false` when there was none   |
| `commit`   | `HEAD` of this repo when the guide was read, or `null`         |
| `session`  | `$CLAUDE_CODE_SESSION_ID`, or `null`                           |
| `terminal` | `$ORCA_TERMINAL_HANDLE`, or `null`                             |
| `worktree` | `$ORCA_WORKTREE_ID`, or `null`                                 |

If the log cannot be written, `mt` says so on stderr and still prints the guide.

### Shapes

`mt shape check <file>` prints nothing and exits 0 when the file is a shape. Otherwise it prints one
`path: message` line per violation on stderr and exits 1; a file that is not YAML is one violation,
on `(document)`. A key repeated in `requirements`, `non_goals`, `constraints` or `decisions` is a
violation on that key, found in block-style maps; YAML keeps only the last of a repeated key, so
without this one entry would be dropped silently.

`mt shape slice <file> --keys outcome,non_goals` prints a YAML document with only those
top-level keys of the shape, their values unchanged. A key the schema does not define, or a
file that is not YAML or whose top level is not a map, exits 1 with nothing on stdout. Slice
does not run the check, so a shape with a violation the owner ruled on can still be sliced.

Both read the document from stdin when the file is `-`, and read only a whole YAML document:
a shape inside other text, such as Markdown, is taken out of it by whoever pipes it in.

The schema is `src/shape/shape.ts`. `mt shape` loads it only when called, so `mt get` and
`mt list` need nothing beyond `cli/mt` and Bun.

### Config

The owner's config is one TOML file of standing policy for unattended work, values only the owner
holds, at `${XDG_CONFIG_HOME:-$HOME/.config}/mt/config.toml`. `mt --help` names that path and
`mt config` prints it, so no consumer spells it out. Only the owner edits it; `mt` only reads it,
and an agent proposes a change with evidence. There is one file per user and no per-repo override.
The owner's explicit choice for a Run beats it.

| key                 | kind     | value                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `agents`            | binding  | the agents a Task on the owner's platform may run on, a non-empty list |
| `fix_rounds`        | binding  | fix rounds before the owner gets a finding, an integer from 0          |

A TOML float with an integer value, such as `fix_rounds = 2.0`, counts as that integer, since
`Bun.TOML.parse` cannot tell them apart. `Bun.TOML.parse` also reads some values that are not
valid TOML as numbers: `-foo`, `+inf`, `-inf` and `-nan` as 0, `.7` as 0.7 and `07` as 7. So
`mt config` takes `fix_rounds = -foo` as a valid 0. The owner writes `fix_rounds` as a plain TOML
number. `mt` checks that an agent name is well formed, not that the platform knows it, and a
repeated name is allowed.

No `mt` command reads `agents` or `fix_rounds`; whatever coordinates unattended work, such as the
coordinate guide, reads them through `mt config <key>`. For example:

```toml
agents = ["claude"]
fix_rounds = 1
```

A binding key is one no agent overrides, and it has no default: when it is missing or invalid,
whatever reads it stops and names it, and the agent asks the owner. An advisory key leaves its
reader running without it, saying so. Only a command that reads a key fails on it; nothing else
reads the config, so a missing or broken file changes no other command.

`mt config` prints the file's path, then one line per key: its name, `binding` or `advisory`, and
its value, `missing`, or `invalid: <why>`. A key `mt` does not know gets a line saying so. It exits
0, or 1 when a binding key is missing or invalid or a key is unknown, so a misspelt key is never
read as missing without a word. A file that is not there leaves every key missing; one that cannot
be read, or is not TOML, leaves every key invalid, saying why.

`mt config <key>` prints that key's value alone, a list one item per line, and exits 0. It looks at
that key only: a key missing or invalid prints `mt: config: <key> is missing from <path>` or `is
invalid in <path>: <why>` on stderr and exits 1, and a key `mt` does not know is a usage error,
exit 2.

### Install

Install is for Claude Code: it links the stub skills where Claude Code finds them and adds `mt`'s
rules to Claude Code's settings. `SKILLS_DIR` only changes where the stubs go, a folder you name
instead of Claude Code's; the rest of install still runs, linking `mt` onto your PATH and offering
to add its rules to Claude Code's settings.

`mt` is TypeScript run by [Bun](https://bun.sh). Bun must be on the PATH that agents and Orca
workers launch with, not only on your interactive shell's, or every `mt` command they run
fails. Use Bun 1.2.23 or later: `Bun.YAML.parse` arrived in 1.2.21, `Bun.YAML.stringify` in
1.2.22, and from 1.2.23 `Bun.YAML.parse` throws a `SyntaxError` on invalid input, which `mt
shape` relies on ([release notes](https://bun.com/blog/release-notes/bun-v1.2.23)). It is
tested on 1.3.14. `mt config` reads its file with `Bun.TOML.parse`, which is older. Install git,
make and Bun, then run:

```sh
curl -fsSL https://raw.githubusercontent.com/magnus-tornvall/agent-tools/main/install.sh | bash
```

`install.sh` clones this repo into `${XDG_DATA_HOME:-$HOME/.local/share}/agent-tools` with the
newest release checked out, the highest `vMAJOR.MINOR.PATCH` tag, and runs `make install` there,
asking its questions on your terminal. It installs none of git, make and Bun: one missing, it says
which and clones nothing. A folder already in the clone's place that is not a clone of this repo is
left as it is, and it fails naming it; a clone whose origin spells this repo's GitHub URL another
way, over ssh or without `.git`, is a clone of it. While `~/.local/bin/mt` links into another
clone, such as one you ran `make install` from, it fails naming that clone and clones and links
nothing: run `make uninstall` there first. Run again over the clone, it runs the clone's
`mt update`. `AGENT_TOOLS_URL` clones another repo instead, as the tests do with a local one.

The clone follows the channel it has checked out, with no config: a release tag follows releases,
and `main` follows `main`. `mt update` moves it forward along that channel and runs `make install`
again (see Contracts); check out `main` in the clone to follow it. A clone on another branch, with
local changes or ahead of origin is left as it is. When `make install` fails after a move, the move
stays and `mt update` says to run `make install` again.

To work on `mt`, run `make install` from your own clone instead. It is safe to run again, after a
pull or on a machine that is half set up; it changes only what is missing or stale. It:

- checks Bun's version and runs `bun install --frozen-lockfile`, since `mt shape` needs zod;
- links `cli/mt` as `~/.local/bin/mt`. `mt` finds the guides through the link, so the clone
  stays where it is;
- links each stub skill that has a guide into `~/.agents/skills`, and links each into
  `~/.claude/skills` as a link to `~/.agents/skills/<tool>`, so Claude Code finds it. With no
  `~/.agents/skills` folder it links the stubs straight into `~/.claude/skills` and does not create
  `~/.agents`. It removes the links to a stub that is gone;
- asks whether to add `Bash(mt:*)` to `permissions.allow` and `Bash(mt update:*)` to
  `permissions.ask` in `~/.claude/settings.json`, so Claude Code agents run every `mt` command
  without a prompt but `mt update`, which reaches off the machine (see Contracts) and is asked
  first. Claude Code checks ask rules before allow rules, so the ask rule beats `Bash(mt:*)`, and it
  prompts even in auto mode; it matches the command as written, so `mt` by its path or inside
  `sh -c` still runs unasked, and an agent that does not read these settings is not asked. A file
  that still holds `Bash(mt get:*)`, `Bash(mt list)` or `Bash(mt shape:*)` from an earlier install
  has them replaced. A yes keeps everything else in the file; it is not asked again once the rules
  are there;
- asks, in a y/N of its own, whether to remove `Bash(mt oracle:*)` and `Bash(mt get oracle:*)`
  from `permissions.deny`, where an earlier install put them, so an agent can load the oracle guide.
  Your other denies stay. Declining keeps them and changes no other rule, and every later install
  or `mt update` asks again while they are there.
  `ADD_MT_RULES=yes` or `ADD_MT_RULES=no` answers both questions without asking, and with no
  terminal to ask on nothing is written;
- checks that a login shell started from your profile alone finds `mt` and Bun. Orca starts a
  worker in a terminal running your shell, so this is the PATH workers get.

Set `BIN_DIR`, `SKILLS_DIR`, `CLAUDE_SKILLS_DIR` or `SETTINGS` to use other places, for example
`make install SKILLS_DIR=~/.claude/skills` to link the stubs straight into Claude Code's folder.
A `SKILLS_DIR` override, for another agent, links the stubs into that folder alone and leaves
`~/.claude/skills` as it is; `CLAUDE_SKILLS_DIR` moves Claude Code's folder when `SKILLS_DIR` is not
set. A skill installed as a real folder, or a file where a stub goes, is left alone and the install
fails, naming it: linking over it would write a stray link inside the folder, or replace the file.
The whole mvc from before it became a guide is such a folder, and so is a whole commit skill copied
in before commit became one; the old and the new cannot both be installed under one name. To keep
the old one for a later comparison, move it out of the skills folder rather than delete it. Settings
that are not a JSON object, or whose `permissions` is not an object or whose `permissions.allow`,
`permissions.ask` or `permissions.deny` is not a list of strings, are left alone too, and the
install fails saying which; it names the rules to add by hand only when the settings are not JSON
or not an object.

`make uninstall` takes it back out: the `mt` link, every link in either skills folder that points
into this clone, and every link in `~/.claude/skills` to such a link in `~/.agents/skills`, however
it spells the path and even one made by hand, so a skill or `mt` installed some other way stays.
With `~/.agents/skills` gone, it also removes the links in `~/.claude/skills` to it. It asks before
removing the rules, and any of the earlier ones, from the settings, keeping every other rule;
`REMOVE_MT_RULES=yes` or `=no` answers without asking. It leaves Bun, the clone and its
`node_modules`, your shell profile and the usage log. Pass the same `BIN_DIR`, `SKILLS_DIR`,
`CLAUDE_SKILLS_DIR` and `SETTINGS` you installed with.

A skill already linked from a clone becomes a stub when that clone pulls this layout, and the
stub runs `mt get`. Run `make install` with the pull, or every agent that loads the skill fails on
its first command.

### Release

A release is a tag `vMAJOR.MINOR.PATCH` on this repo, and the newest is the highest version; other
tags are ignored. Cut one by running the tests on the commit, then pushing its tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

`install.sh` and `mt update` read origin's tags, so the tag is the release.

### Test

```sh
bash test/mt.sh
bash test/install.sh
bash test/update.sh
bash test/guides.sh
bun test
bun run typecheck
```

`test/mt.sh` checks `mt get` and `mt list`, and needs `python3` on PATH to parse the log's JSON
lines; `mt` itself needs only Bun. `test/install.sh` runs `make install` and `make uninstall`
against throwaway home folders, and needs `python3` too. `test/update.sh` runs `install.sh` and
`mt update` against a local origin, made from this worktree's files, and throwaway home folders, and
needs `python3` and Bun's package cache to hold this repo's dependencies: it reaches no network, so
`bun install` fails on a package the cache lacks.
`src/install/PART.md` and `src/guide-lint/PART.md` hold the contracts of install and guide-lint.
`test/guides.sh` is guide-lint, whose code is `src/guide-lint/`. It fails, one ``file:line:
`mention`: reason`` line each, when a guide, stub skill or `AGENTS.md` mentions in backticks an `mt
get` guide or reference that `mt get` no longer finds, an `mt` command its usage no longer lists, or
an `orca` command or `--flag` that `orca agent-context --json` no longer lists. A guide spells every
Orca command in full, `orca orchestration worker-start`; only a backticked span that starts with
`orca ` is an Orca mention, so a bare `worker-start` is never checked. An Orca mention that opens
with a flag or holds a short flag (`-x`) fails, because the lint cannot check it; write the command
path first, then long flags. An `mt get` mention with a `<placeholder>` for its tool is skipped; a
placeholder ref is dropped with its flag and the guide is still checked. Its success line counts the
mentions it checked and says how many placeholder mentions it skipped.

It runs only `mt get` and `mt --help`, with `MT_LOG` on a throwaway file, so it leaves the usage log
alone. Without `orca` on PATH it checks the `mt` mentions only and says so in one line. It fails
when `mt --help` prints no usage, when it finds no guides, and when `orca agent-context --json`
exits non-zero, prints something that is not a JSON object, reports a schema version other than 1,
or lists its commands in a shape the lint does not read (no `commands` array, or a command without a
string `command` and an array `path`), each as one line instead of one per mention.

`bun test` runs guide-lint against fixture repos and a fake `orca`, and checks the shape
schema and `mt shape`, `mt config` against a throwaway `XDG_CONFIG_HOME`, and that every command in
`mt --help` has a side-effect class. `bun run typecheck` runs `tsc --noEmit` over `src/`; `tsc`
cannot read `cli/mt`, which has no extension.

## Layout

```
AGENTS.md the charter: each part's domain, what a part contains, the fixed rules, the config rule;
          CLAUDE.md imports it
cli/      mt
install.sh
          the curl line's installer: clones the newest release and runs make install
Makefile  make install and make uninstall
src/      shape/, the shape schema and mt shape; config/, the owner's config and mt config;
          install/, the side-effect classes and the settings rules; guide-lint/, the check
          test/guides.sh runs; each with its tests, and install/ and guide-lint/ with their part,
          PART.md
guides/   one guide per tool, <name>.md, with its references in <name>/<ref>.md
skills/   a stub skill per guide an agent or the owner picks, <name>/SKILL.md, mvc and ask
          among them
test/     mt.sh, which checks mt get and mt list; install.sh, which checks make install and
          uninstall; update.sh, which checks install.sh and mt update; guides.sh, which checks
          that what guides and AGENTS.md mention still exists
docs/     known Orca and guide behaviour, research
```
