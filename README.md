# agent-tools

The tick: a script that coordinates an Orca Run on the owner's behalf, run by
hand from the terminal bound to the Run, plus the skills its workers follow. Also the
shape schema: the contract for what any producer hands to orca-start.

```
$ bun src/orca/tick.ts help
```

`help` prints each command with its flags, built from the same definitions the
commands parse, so it is the one place the syntax lives.

## The commands

| Command | What it does |
|---|---|
| `use` | Binds the calling terminal to the Run, fencing whichever terminal held it before |
| `status` | Opens a gate on each failed surprise check that has none, then lists the Run's open questions, closed questions, open gates, failed attempts, completed Tasks whose work has not merged into `main` yet, and the item report: a succeeded surprise check's report |
| `reply` | Answers one open question. Refuses if the question already has a reply or the attempt that asked it has ended |
| `gate` | Resolves one open gate with the owner's ruling. Refuses a gate that is resolved or not in the Run |
| `advance` | Cancels any `--cancel` Tasks, releases settled workers, then starts attempts up to `--cap` in flight: `--retry` Tasks first, then ready Tasks whose parents have merged into `main` |

Every attempt `advance` starts first gets a message carrying the questions earlier
attempts at the same Task asked, with their answers. It is sent even when there are none.

An item's surprise check is a Task like any other, created by orca-start's script from
`surpriseCheckSpec` and recognised by `kind: surprise-check` in its spec's frontmatter.
`surpriseCheckSpec` takes the item's shape as a typed `Shape` and carries it in the spec
as YAML. The check measures the diff against the shape, each checked Task's spec and the
answers, and reports every requirement in the shape by its ID, done or not.
It fails when it finds a surprise that needs a decision, a requirement that is not done
among them; the owner reads its report
under failed attempts and rules by resolving the gate with `gate`, which sets the check `ready` for
`advance` to run again.

## What it will not do

- **Keep state.** Orca is the only state. Every call reads the Run afresh.
- **Push or touch code.** Merging a Task's work into `main` is the owner's job. The
  tick only checks whether it has happened.
- **Start a Task early.** Orca lists a Task as `ready` before its parents complete,
  so the tick checks each parent itself and holds the Task until they have all merged.

## Starting a Run

orca-start's script turns a shape and the DAG the owner approved into a Run. Run it from the
owner's terminal: `run-create` binds that terminal to the Run as its coordinator.

```
$ bun src/orca/start.ts <shape.yaml> <dag.yaml>
```

`bun src/orca/start.ts help` prints the usage and the DAG's format.

The DAG maps each Task's S ID to its title, the requirement IDs it owns, and the non-goal and
decision IDs that bear on it, plus the S IDs it depends on:

```yaml
S1: { title: Store the reason, owns: [R1, R3], bears: [N1, D1] }
S2: { title: Export the reason, owns: [R2], bears: [D1], after: [S1] }
```

It refuses before any Orca call unless every requirement is owned by exactly one Task, every
ID the DAG names exists, and the dependencies form no cycle. Then it creates the Run with the
shape's outcome as objective, each Task in dependency order, and the surprise check depending
on every Task, and prints their IDs as JSON. Each Task's spec, from `taskSpec`, is its slice
of the shape in the shape's own field names: the outcome, the requirements it owns, the
non-goals and decisions that bear on it, and the constraints and touchpoints.

A failed call stops it with what it created so far; when Orca reports a call's outcome unknown
with a request ID, it retries that call once with `--retry-request` first. It never resumes a
half-created Run: cancel it and start again.

## The shape

A shape is one YAML document: the outcome, requirements keyed `R1…`, non-goals keyed
`N1…`, approach, constraints, touchpoints, and decisions keyed `D1…`. The Zod schema in
`src/shape/shape.ts` is the one definition; `src/shape/fixtures/example.yaml` is a
filled-in example.

Any producer whose shape passes `shape-check` can feed orca-start. mvc is one producer,
not the contract.

```
$ bun src/shape/shape-check.ts <file>
```

It prints nothing and exits 0 on a shape, otherwise one `path: message` line per
violation and exits 1. Keys the schema does not define are violations.

`src/shape/shape.schema.json` is generated from the Zod schema for editors and for
anything not written in TypeScript. After changing the schema, run `bun run shape-schema`;
a test fails while the committed file is stale.

## The orca-tick skill

`skills/orca-tick` is the tick for the owner: one pass that reads `help`, runs `use` and `status`,
shows what waits on the owner, sends their answers with `reply` and rulings with `gate`,
asks retry, cancel or leave for each failed attempt, then runs `advance`. It runs no
Orca command itself and never loops.

## Skills that run scripts

A skill shared through Orca must work without this repository, so each skill carries the
scripts and assets it runs in its own `scripts/` and `assets/`, built from `src/`:
`skills/mvc` gets `shape-check.js` and the filled-in example, `skills/orca-start` gets
`start.js` and `shape-check.js`, `skills/orca-tick` gets `tick.js`. They run with `bun`. After changing anything they are built from, run
`bun run build-skills`; a test fails while a skill's copy is stale.

## Requirements

`bun`, plus `orca` and `git` on `PATH`. Every Orca call passes `--run`, except
`run-use`, `gate-resolve` and `gate-create`. Orca allows `gate-create` only from the
terminal bound to the Run, so run `status` there, after `use`.

```sh
npm install
bun test
npm run typecheck
```

## Layout

```
src/orca/tick.ts            the tick
src/orca/start.ts           orca-start's script
src/orca/task-spec.ts       an implementation Task's spec
src/orca/surprise-check.ts  the surprise check's Task spec
src/orca/orca.ts            running an orca orchestration command
src/orca/tick.test.ts       tests against Orca JSON recorded from real Runs (src/orca/fixtures/tick)
src/shape/shape.ts          the shape schema and parseShape
src/shape/shape-check.ts    checking a file against the shape schema
src/shape/shape.schema.json the JSON Schema generated from it
src/shape/shape.test.ts     tests, with the filled-in example in src/shape/fixtures
src/shell.ts                running a command and reading its output
src/build-skills.ts         building each skill's scripts/ and assets/ from src/
skills/                     orca-worker, which workers follow, orca-tick, which the owner runs, plus the
                            unrelated commit and mvc skills, with built files in skills/mvc, skills/orca-start
                            and skills/orca-tick
docs/                       known Orca behaviour, plans, research
```
