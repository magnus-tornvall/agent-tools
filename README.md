# agent-tools

The tick: a script that coordinates an Orca Run on the owner's behalf, run by
hand from the terminal bound to the Run, plus the skills its workers follow. Also the
shape schema: the contract for what any producer hands to to-orca.

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
| `status` | Opens a gate on each failed surprise check that has none, then lists the Run's open questions, closed questions, open gates, failed attempts, and completed Tasks whose work has not merged into `main` yet |
| `reply` | Answers one open question. Refuses if the question already has a reply or the attempt that asked it has ended |
| `advance` | Cancels any `--cancel` Tasks, releases settled workers, then starts attempts up to `--cap` in flight: `--retry` Tasks first, then ready Tasks whose parents have merged into `main` |

Every attempt `advance` starts first gets a message carrying the questions earlier
attempts at the same Task asked, with their answers. It is sent even when there are none.

An item's surprise check is a Task like any other, created by to-orca's script from
`surpriseCheckSpec` and recognised by `kind: surprise-check` in its spec's frontmatter.
It fails when it finds a surprise that needs a decision; the owner reads its report
under failed attempts and rules by resolving the gate, which sets the check `ready` for
`advance` to run again.

## What it will not do

- **Keep state.** Orca is the only state. Every call reads the Run afresh.
- **Push or touch code.** Merging a Task's work into `main` is the owner's job. The
  tick only checks whether it has happened.
- **Start a Task early.** Orca lists a Task as `ready` before its parents complete,
  so the tick checks each parent itself and holds the Task until they have all merged.

## The shape

A shape is one YAML document: the outcome, requirements keyed `R1…`, non-goals keyed
`N1…`, approach, constraints, touchpoints, and decisions keyed `D1…`. The Zod schema in
`src/shape/shape.ts` is the one definition; `src/shape/fixtures/example.yaml` is a
filled-in example.

Any producer whose shape passes `shape-check` can feed to-orca. mvc is one producer,
not the contract.

```
$ bun src/shape/shape-check.ts <file>
```

It prints nothing and exits 0 on a shape, otherwise one `path: message` line per
violation and exits 1. Keys the schema does not define are violations.

`src/shape/shape.schema.json` is generated from the Zod schema for editors and for
anything not written in TypeScript. After changing the schema, run `bun run shape-schema`;
a test fails while the committed file is stale.

## Requirements

`bun`, plus `orca` and `git` on `PATH`. Every Orca call passes `--run`, except
`gate-create`, which Orca allows only from the terminal bound to the Run, so run `status`
there.

```sh
npm install
bun test
npm run typecheck
```

## Layout

```
src/orca/tick.ts            the tick
src/orca/surprise-check.ts  the surprise check's Task spec
src/orca/tick.test.ts       tests against Orca JSON recorded from real Runs (src/orca/fixtures/tick)
src/shape/shape.ts          the shape schema and parseShape
src/shape/shape-check.ts    checking a file against the shape schema
src/shape/shape.schema.json the JSON Schema generated from it
src/shape/shape.test.ts     tests, with the filled-in example in src/shape/fixtures
src/shell.ts                running a command and reading its output
skills/                     orca-worker, which workers follow, plus the unrelated commit and mvc skills
docs/                       known Orca behaviour, plans, research
```
