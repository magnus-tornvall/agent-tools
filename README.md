# agent-tools

Skills for agents working in Orca, and `mt`, which loads them on demand.

## The shape

A shape is one YAML document: the outcome, requirements keyed `R1…`, non-goals keyed
`N1…`, approach, constraints, touchpoints, and decisions keyed `D1…`.
`skills/mvc/assets/example.yaml` is a filled-in example. The agent reading a shape uses
judgement on it; no schema or script enforces the format.

Any producer whose shape follows the example is a valid producer. mvc is one producer,
not the contract.

## mt

`mt` is a loader. A tool's know-how lives in a guide under `guides/`. The tool also has a
stub skill under `skills/<name>/`: its description says when to use the tool, and its body
only tells the agent to run `mt get <name>` and follow what it prints. The agent's skill
list stays short, the guide enters context only when the tool is used, and each load is
logged.

Every guide has a stub and every stub a guide. `mt list` shows only tools that have both.
Skills that are not stubs, such as commit and mvc, stay whole in `skills/` and `mt` does
not serve them.

```
mt list                       every tool, once, with its when-to-use description
mt get <name>                 print the tool's guide, and log the load
mt get <name> [--ref <ref>]   print one of the tool's references instead, and log the ref
```

A reference is a file under `guides/<name>/<ref>.md`, for example
`mt get to-orca --ref overlay`. An unknown tool or ref exits 1 with a message on stderr;
the attempt is still logged, with `found` false.

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

### Install

Link `cli/mt` onto your PATH, and link each stub skill folder into the agent's skills
folder. `mt` finds the guides through the link, so the clone stays where it is.

```sh
ln -sfn "$PWD/cli/mt" ~/.local/bin/mt
for tool in $(mt list | awk '{print $1}'); do
  ln -sfn "$PWD/skills/$tool" ~/.agents/skills/"$tool"
done
```

Use the skills folder your agent reads; `~/.agents/skills` is one example. `-n` replaces a
link that is already there instead of writing a stray link inside the folder it points to.

A skill already linked from a clone becomes a stub when that clone pulls this layout, and the
stub runs `mt get`. Put `mt` on PATH before or with the pull, or every agent that loads the skill
fails on its first command.

### Test

```sh
bash test/mt.sh
```

The test needs `python3` on PATH to parse the log's JSON lines; `mt` itself does not.

## Layout

```
cli/      mt
guides/   one guide per tool, <name>.md, with its references in <name>/<ref>.md
skills/   a stub skill per guide, <name>/SKILL.md, plus the commit and mvc skills,
          which are whole
test/     mt.sh, which checks mt
docs/     known Orca and guide behaviour, research
```
