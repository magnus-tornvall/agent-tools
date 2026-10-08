# agent-tools

The tick: a script that coordinates an Orca Run on the owner's behalf, run by
hand from the terminal bound to the Run, plus the skills its workers follow.

```
$ bun src/orca/tick.ts status  --run <run_id>
$ bun src/orca/tick.ts reply   --run <run_id> --id <message_id> --answer <text>
$ bun src/orca/tick.ts advance --run <run_id> [--agent claude] [--model sonnet] [--cap 1]
                               [--base-branch main] [--retry <task_id>]... [--cancel <task_id>]...
```

From this repository's root, `bun run tick <command> …` does the same thing.

## The three commands

| Command | What it does |
|---|---|
| `status` | Lists the Run's open questions, closed questions, failed attempts, and completed Tasks whose work has not merged into `main` yet |
| `reply` | Answers one open question. Refuses if the question already has a reply or the attempt that asked it has ended |
| `advance` | Cancels any `--cancel` Tasks, releases settled workers, then starts attempts up to `--cap` in flight: `--retry` Tasks first, then ready Tasks whose parents have merged into `main` |

Every attempt `advance` starts first gets a message carrying the questions earlier
attempts at the same Task asked, with their answers. It is sent even when there are none.

## What it will not do

- **Keep state.** Orca is the only state. Every call reads the Run afresh.
- **Push or touch code.** Merging a Task's work into `main` is the owner's job. The
  tick only checks whether it has happened.
- **Start a Task early.** Orca lists a Task as `ready` before its parents complete,
  so the tick checks each parent itself and holds the Task until they have all merged.

## Requirements

`bun`, plus `orca` and `git` on `PATH`. Every Orca call passes `--run`, so the tick
needs no Orca terminal of its own.

```sh
npm install
bun test
npm run typecheck
```

## Layout

```
src/orca/tick.ts       the tick
src/orca/tick.test.ts  tests against Orca JSON recorded from real Runs (src/orca/fixtures/tick)
src/shell.ts           running a command and reading its output
skills/                orca-worker, which workers follow, plus the unrelated commit and mvc skills
docs/                  known Orca behaviour, plans, research
```
