# agent-tools

Skills for agents working in Orca, and `mt`, which loads them on demand, checks and slices shapes
and drafts, runs a shape's oracles, files dogfooding findings, and prints the owner's config.

## The shape

A shape is one YAML document: the outcome, optionally its `purpose`, why the outcome matters,
requirements keyed `R1…`, non-goals keyed `N1…`, constraints keyed `C1…`, touchpoints, and
decisions keyed `D1…`. Once closed, it may gain oracles keyed `O1…`: acceptance tests in the repo,
each naming the keys it covers, what it does at the base commit, the command that runs it and the
sha256 of each of its files, with `unchecked` naming each key no oracle covers and why. With
oracles, the outcome, every requirement, boundary non-goal and constraint must be covered or
unchecked; `mt get oracle --ref example` prints a shape with its oracles.
The schema in `src/shape/shape.ts` is the contract: a shape is what `mt shape check`
accepts, and `mt get mvc --ref example` prints a filled-in example.

Any producer whose shape passes `mt shape check` is a valid producer. mvc is one producer,
not the contract.

A draft is an unfinished shape: the same document with a top-level `draft` block holding the
`commit` it was written at, if any, the round `budget`, the `rounds_spent`, and the `open`
questions, each a `question` as it was asked with its `stance`. A draft is never a shape:
`mt shape check` fails on the `draft` key, and `mt shape check --draft` checks the partial form.
`mt` keeps no drafts and no shapes; whoever produces one stores it.

## mt

`mt` is a loader. A tool's know-how lives in a guide under `guides/`. A tool an agent or the
owner picks also has a stub skill under `skills/<name>/`: its description says when to use the
tool, and its body only tells the agent to run `mt get <name>` and follow what it prints. The
agent's skill list stays short, the guide enters context only when the tool is used, and each
load is logged.

Every stub has a guide. A guide that only a spec or another guide loads has no stub:
orca-worker and the assignments change and verification, whose references are its judging
perspectives coverage, maintainer and surprise.
No agent chooses them, so a skill-list entry would only cost the sessions that never use them;
`mt get` serves them like any other guide. Stubs remain for what an agent or the owner picks:
mvc, which settles a shape with the owner, oracle, which writes a closed shape's oracles before
it is built, to-orca, which runs one, ask, which composes a question for whoever owns a
decision, door-rule, which says whether a decision is asked at all, debugging, which finds the
root cause of an unexpected failure before it is fixed, commit, which stages, writes and pushes
commits as the session's destination allows, and research, which answers the owner's question
from trusted outside sources; only the owner starts it, by typing `/research`. `mt list` shows
every guide.

```
mt list                       every guide, once, with its stub's description, or the
                              guide's first paragraph when it has no stub
mt get <name>                 print the tool's guide, and log the load
mt get <name> [--ref <ref>]   print one of the tool's references instead, and log the ref
mt shape check [--draft] <file>
                              check that a file is a shape, or with --draft a draft;
                              - reads stdin
mt shape slice <file> --keys <key,...>
                              print the shape with only those top-level keys; - reads stdin
mt oracle hash <file>...      print each file's path from the repo root and sha256, to pin it
mt oracle run [--base] [--timeout <seconds>] <shape>
                              check each oracle's pinned files and run it from the repo root;
                              --base checks each does what its base says; - reads stdin
mt dogfood <title> [--body-file <file>]
                              file a finding as an issue labelled dogfooding; - reads stdin
mt dogfood triage             sort the open dogfooding issues into duplicates, no-brainers and
                              ones to rule on; needs TYPESAFE_API_KEY
mt config [<key>]             print the owner's config, or one key's value
mt --help                     print the usage
```

A reference is a file under `guides/<name>/<ref>.md`, for example
`mt get to-orca --ref overlay`. An unknown tool or ref exits 1 with a message on stderr;
the attempt is still logged, with `found` false.

### Contracts

Each command's contract: its purpose, what it takes, what it prints, how it exits, and its
side-effect class. A class is one of read-only, which reads and prints and writes nothing; local
write, which writes on this machine only; and external, which reaches a service off it. The classes
are declared once in `src/install/side-effects.ts`, and install builds its permission rules from
them: every class but external runs without a prompt, and each external command asks first (see
Install). Every usage error prints `mt: <reason>` and a usage on stderr, nothing on stdout, and
exits 2. Only `mt config` and `mt dogfood triage` read the owner's config (see Config); every
other command behaves the same whatever the config holds.

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

**`mt shape check [--draft] <file>`**, read-only. Takes a file, or `-` for stdin. Prints nothing
and exits 0 when it is a shape, or with `--draft` a draft. A file that cannot be read, or is not
one, prints a line on stderr per violation, or the reason it cannot be read, and exits 1. No file,
two files or an unknown option exits 2. See Shapes.

**`mt shape slice <file> --keys <key,...>`**, read-only. Takes a file, or `-` for stdin, and the
top-level keys to keep. Prints those keys as YAML on stdout and exits 0. A key the schema does not
define, a file that cannot be read, is not YAML or whose top level is not a map prints a line on
stderr, nothing on stdout, and exits 1. No file, a second file, no `--keys` value or an unknown
option exits 2.

**`mt oracle hash <file>...`**, read-only. Prints `<path>: <sha256>` on stdout per file, its path
from the root of the git repo it runs in, and exits 0. Run outside a git repo, or given a file it
cannot read or pin, it says so on stderr and exits 1, still printing the files it could. No file or
an option exits 2.

**`mt oracle run [--base] [--timeout <seconds>] <shape>`**, local write. Takes a shape, or `-` for
stdin, whose `oracles` block is sound. Runs each oracle's command from the repo root, its output on
stderr, and prints one `O<n>: <verdict> (covers <keys>)` line per oracle on stdout. Exits 0 when
every oracle passes, or with `--base` when each does what its `base` says, and 1 otherwise, or when
the shape cannot be read, its `oracles` block is not sound or it runs outside a git repo. No shape,
two shapes, an unknown option or a `--timeout` that is not a whole number above 0 exits 2. It
deletes the JUnit report each oracle names before running it, and runs each command as written,
whatever that command does; it is classed local write and runs without a prompt because it runs
the commands of a shape the owner approved. See Oracles.

**`mt dogfood <title> [--body-file <file>]`**, external. Files a finding as an issue labelled
`dogfooding` on this repo's public GitHub, through `gh`; `--body-file -` reads the body from stdin.
Prints the new issue's URL on stdout and exits 0. When it cannot file, because `gh` is missing or
fails, it prints one `mt: finding not filed: <reason>` line on stderr, nothing on stdout, and still
exits 0, by design, so the agent carries on. A body file it cannot read exits 1; a blank or second
title, a `--body-file` without a value or an unknown option exits 2. See Dogfooding.

**`mt dogfood triage`**, external. Reads the open dogfooding issues through `gh`, sends them to jev
with `TYPESAFE_API_KEY`, prints one report on stdout, changes nothing on GitHub, and exits 0. It
reads the advisory key `triage_confidence`; when that is missing or invalid it still exits 0 and
says so on the report's first line. Without `TYPESAFE_API_KEY`, or when `gh` or a jev call fails, it
prints one line on stderr, nothing on stdout, and exits 1. Any word after `triage` exits 2. See
Dogfooding.

**`mt config [<key>]`**, read-only. Prints the owner's config: the file's path, then one line per
key. With a key, prints that key's value alone. Exits 0, 1 or 2 as Config says.

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

`mt shape check <file>` prints nothing and exits 0 when the file is a shape. Otherwise it
prints one `path: message` line per violation on stderr and exits 1; a file that is not YAML
is one violation, on `(document)`, and a `draft` key is one on `draft`. With `--draft` it
checks a draft instead: the `draft` block is required and checked, and every other key is
optional but checked when present, `requirements` with no minimum and oracles without the
coverage rule. A key repeated in `requirements`, `non_goals`, `constraints`, `decisions`,
`oracles` or `unchecked` is a violation on that key, found in block-style maps; YAML keeps only
the last of a repeated key, so without this one entry would be dropped silently.

`mt shape slice <file> --keys outcome,non_goals` prints a YAML document with only those
top-level keys of the shape, their values unchanged. A key the schema does not define, or a
file that is not YAML or whose top level is not a map, exits 1 with nothing on stdout. Slice
does not run the check, so a shape with a violation the owner ruled on can still be sliced.

Both read the document from stdin when the file is `-`, and read only a whole YAML document:
a shape inside other text, such as Markdown, is taken out of it by whoever pipes it in.

The schema is `src/shape/shape.ts`. `mt shape` and `mt oracle` load it only when called, so
`mt get` and `mt list` need nothing beyond `cli/mt` and Bun.

### Oracles

`mt oracle run <shape>`, run anywhere in a git repo, takes each oracle in turn; pinned files,
`junit` and commands are relative to the repo root. A pinned file that is missing, not a file, or
whose sha256 differs makes the oracle `tampered`, and it is not run. Otherwise its command runs
through `sh -c`, its output going to stderr, and it is `pass`, `fail`, `blocked` or `broken`: from
its JUnit report when it names one in `junit`, where an error is broken, a failure fails, a skip is
blocked and a report with no test case, or one that does not end its root element, is broken,
comments and CDATA unread; else from its exit code, read as automake does, 0 pass, 77 blocked, 99
broken, anything else fail, except 126 or 127, a command that did not start, and 128 and up, a
signal, which are broken. Those exit codes are broken even when a report was written. The file
`junit` names is deleted before the run, so a report from an earlier run never answers; a `junit`
that names a folder is broken, and the schema refuses one that names a file any oracle pins. Each
command runs in a process group of its own, killed when the command exits, so nothing it started in
the background outlives it. With `--timeout`, an oracle still running after that many seconds is
killed and broken. It prints one `O<n>: <verdict> (covers <keys>)` line per oracle on stdout and
exits 0 when every oracle passes. With `--base` it exits 0 when each does what its `base` says
instead: `fail` for new behaviour, `pass` for what must not change. Only the `oracles` block has to
be sound; the rest of the shape is not checked, so an owner's ruling on another violation does not
stop the run, and the block piped alone as `-` is enough. Each command is run as written: `mt oracle
run` executes what the shape says, so run it only on a shape you trust.

`mt oracle hash <file>...` prints `<path>: <sha256>` per file, the form `files` takes, with the
path from the repo root whichever folder it runs in; a file outside the repo, or whose path holds
whitespace, cannot be pinned and exits 1.

### Dogfooding

`mt dogfood` sends findings to this repo: it opens an issue labelled `dogfooding` on the GitHub
repo of the clone `mt` runs from, magnus-tornvall/agent-tools, which is public. It does so through
`gh`, run in that clone rather than the caller's directory, so a finding from a Run on any other
repo lands here too.

`mt dogfood "<title>" --body-file finding.md` prints the new issue's URL. `--body-file -` reads the
body from stdin, and the body may be left out. `mt` appends what the finding was seen on: this
repo's `HEAD`, `orca --version` when `orca` is on PATH, and the session, terminal and worktree from
the same variables as the usage log, each only when set.

When the finding cannot be filed, because `gh` is not on PATH, not authenticated or fails
otherwise, `mt` prints one `mt: finding not filed: <reason>` line on stderr, nothing on stdout, and
still exits 0, so the agent carries on. A usage error exits 2, an unreadable body file 1. Since
`triage` is a subcommand, a finding titled exactly `triage` cannot be filed.

`mt dogfood triage` reads the open issues labelled `dogfooding` through `gh` and asks
[jev](https://docs.typesafe.ai) to sort them. It prints one report and changes nothing on GitHub:
a first line states the confidence threshold, a line names the jev model that answered
(`TYPESAFE_DEFAULT_MODEL` picks one, `jev-latest` when unset), then three groups, each issue with
its number, its title, and jev's probability and confidence for every answer it gave: for a
duplicate its strongest shared-problem link, and for any other issue both its change answer and its
verdict, whatever it is about:

- duplicates: issues jev judges to report at least one same problem, grouped;
- no-brainers: defects in `mt`'s own code or tests that jev judges safe to implement unattended,
  meaning its answers that it is `mt` code and that it is a no-brainer are each at least as
  confident as the threshold;
- rule on: everything else, including guide wording and Orca's own behaviour, with a label saying
  why.

The threshold is the owner's `triage_confidence` (see Config), and the report's first line states
it, `triage_confidence: 0.70`. It only labels items in the report, and authorizes nothing; it moves
with the model, which is why the report names the model and shows every score. When it is missing
or invalid, triage still runs and exits 0: the first line says it is missing, or invalid and why,
every score is still shown, and no item is labelled a no-brainer; each defect in `mt`'s code goes to
rule on.

An agent reading the report may argue an item across the threshold, in the report, and say that it
did; it may propose a new `triage_confidence` with evidence, such as items the threshold sorted
wrongly at the model the report names. Only the owner edits config.

It needs `TYPESAFE_API_KEY` set to a jev API key, read from that variable only and never printed.
The title and body of every open dogfooding issue, and the key, are sent to `api.typesafe.ai`, or
to `TYPESAFE_BASE_URL` when that is set; the issues are already public. The footer `mt dogfood`
appends to a body, with its commit, session and worktree, is left out. `TYPESAFE_LOG_LEVEL` sets
how much of the SDK's request log goes to stderr, which never shows the key. Without the key, when
`gh` fails, or when a jev call fails, it prints one line on stderr, nothing on stdout, and exits 1;
the first failed call aborts the calls still in flight and starts no more.

Both are external, so `mt dogfood` sits under an ask rule, `Bash(mt dogfood:*)` in
`permissions.ask` (see Install), and each filing, which posts to a public repo, and each triage,
which sends the issues to jev, still asks first. Claude Code checks deny rules, then ask rules, then
allow rules, so the ask rule prompts even though `Bash(mt:*)` is allowed.

### Config

The owner's config is one TOML file of standing policy for unattended work, values only the owner
holds, at `${XDG_CONFIG_HOME:-$HOME/.config}/mt/config.toml`. `mt --help` names that path and
`mt config` prints it, so no consumer spells it out. Only the owner edits it; `mt` only reads it,
and an agent proposes a change with evidence. There is one file per user and no per-repo override.
The owner's explicit choice for a Run beats it.

| key                 | kind     | value                                                         |
| ------------------- | -------- | ------------------------------------------------------------- |
| `agents`            | binding  | the Orca agents unattended work may run on, a non-empty list  |
| `fix_rounds`        | binding  | fix rounds before the owner gets a finding, an integer from 0 |
| `triage_confidence` | advisory | the no-brainer threshold of `mt dogfood triage`, from 0 to 1  |

A TOML float with an integer value, such as `fix_rounds = 2.0`, counts as that integer, since
`Bun.TOML.parse` cannot tell them apart. `Bun.TOML.parse` also reads some values that are not
valid TOML as numbers: `-foo`, `+inf`, `-inf` and `-nan` as 0, `.7` as 0.7 and `07` as 7. So
`mt config` takes `fix_rounds = -foo` as a valid 0, and `triage_confidence = -inf` as 0, which
labels every `mt-code` issue a no-brainer. The owner writes the number keys as plain TOML numbers.
`mt` checks that an agent name is well formed, not that Orca knows it, and a repeated name is
allowed.

`mt dogfood triage` reads `triage_confidence`. No `mt` command reads `agents` or `fix_rounds`;
whatever coordinates unattended work reads them through `mt config <key>`. For example:

```toml
agents = ["claude"]
fix_rounds = 1
triage_confidence = 0.7
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

`mt` is TypeScript run by [Bun](https://bun.sh). Bun must be on the PATH that agents and Orca
workers launch with, not only on your interactive shell's, or every `mt` command they run
fails. Use Bun 1.2.23 or later: `Bun.YAML.parse` arrived in 1.2.21, `Bun.YAML.stringify` in
1.2.22, and from 1.2.23 `Bun.YAML.parse` throws a `SyntaxError` on invalid input, which `mt
shape` relies on ([release notes](https://bun.com/blog/release-notes/bun-v1.2.23)). It is
tested on 1.3.14. `mt config` reads its file with `Bun.TOML.parse`, which is older. Install Bun,
then run this from the clone:

```sh
make install
```

It is safe to run again, after a pull or on a machine that is half set up; it changes only what
is missing or stale. It:

- checks Bun's version and runs `bun install --frozen-lockfile`, since `mt shape` needs zod and
  `mt dogfood triage` needs the jev SDK, `@typesafe-ai/sdk`. Rerun `make install` after pulling, so
  the SDK is installed;
- links `cli/mt` as `~/.local/bin/mt`. `mt` finds the guides through the link, so the clone
  stays where it is;
- links each stub skill that has a guide into `~/.agents/skills`, and removes links into this
  clone whose stub is gone;
- asks whether to add `Bash(mt:*)` to `permissions.allow` and `Bash(mt dogfood:*)` to
  `permissions.ask` in `~/.claude/settings.json`, so Claude Code agents run every `mt` command
  without a prompt except an external one, `mt dogfood`, which asks before each filing and each
  triage. The rules follow from each command's side-effect class (see Contracts). A file that still
  holds `Bash(mt get:*)`, `Bash(mt list)` or `Bash(mt shape:*)` from an earlier install has them
  replaced.
  A yes keeps everything else in the file; it is not asked again once the rules are there.
  `ADD_MT_RULES=yes` or `ADD_MT_RULES=no` answers without asking, and with no terminal to ask on
  nothing is written;
- checks that a login shell started from your profile alone finds `mt` and Bun. Orca starts a
  worker in a terminal running your shell, so this is the PATH workers get.

Set `BIN_DIR`, `SKILLS_DIR` or `SETTINGS` to use other places, for example
`make install SKILLS_DIR=~/.claude/skills` to link the stubs straight into Claude Code's folder. A skill
installed as a real folder is left alone and the install fails, naming it: linking over it
would write a stray link inside it. The whole mvc from before it became a guide is such a folder,
and so is a whole commit skill copied in before commit became one; the old and the new cannot both
be installed under one name. To keep the old one for a later comparison, move it out of the skills
folder rather than delete it. Settings that are not a JSON object, or whose `permissions` is not an
object or whose `permissions.allow` or `permissions.ask` is not a list of strings, are left alone
too, and the install fails saying which; it names the rules to add by hand only when the settings
are not JSON or not an object.

`make uninstall` takes it back out: the `mt` link and every link in the skills folder that points
into this clone, so a skill or `mt` installed some other way stays. It asks before removing the
two rules, and any of the three earlier ones, from the settings; `REMOVE_MT_RULES=yes` or `=no` answers without asking. It leaves
Bun, the clone and its `node_modules`, your shell profile and the usage log. Pass the same
`BIN_DIR`, `SKILLS_DIR` and `SETTINGS` you installed with.

A skill already linked from a clone becomes a stub when that clone pulls this layout, and the
stub runs `mt get`. Run `make install` with the pull, or every agent that loads the skill fails on
its first command.

### Test

```sh
bash test/mt.sh
bash test/install.sh
bash test/guides.sh
bun test
bun run typecheck
```

`test/mt.sh` checks `mt get`, `mt list` and filing with `mt dogfood`, with a fake `gh`, and needs `python3`
on PATH to parse the log's JSON lines; `mt` itself needs only Bun. `test/install.sh` runs `make
install` and `make uninstall` against throwaway home folders, and needs `python3` too.
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
`mt --help` has a side-effect class. It also runs `mt dogfood triage`
(`src/dogfood/triage.test.ts`) with the real SDK against a local fake jev server selected by
`TYPESAFE_BASE_URL`, and a fake `gh`; no test reaches the real jev or GitHub. `bun run typecheck`
runs `tsc --noEmit` over `src/`; `tsc` cannot read `cli/mt`, which has no extension.

## Layout

```
AGENTS.md the charter: each part's domain, what a part contains, the fixed rules, the config rule;
          CLAUDE.md imports it
cli/      mt
Makefile  make install and make uninstall
src/      shape/, the shape schema and mt shape; oracle/, mt oracle; dogfood/, mt dogfood triage;
          config/, the owner's config and mt config; install/, the side-effect classes and the
          settings rules; guide-lint/, the check test/guides.sh runs; each with its tests, and
          install/ and guide-lint/ with their part, PART.md
guides/   one guide per tool, <name>.md, with its references in <name>/<ref>.md
skills/   a stub skill per guide an agent or the owner picks, <name>/SKILL.md, mvc and ask
          among them
test/     mt.sh, which checks mt get, mt list and filing with mt dogfood; install.sh, which checks make
          install and uninstall; guides.sh, which checks that what guides and AGENTS.md mention
          still exists
docs/     known Orca and guide behaviour, research
```
