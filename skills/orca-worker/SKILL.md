---
name: orca-worker
description: Use when working an Orca Task as a dispatched worker - a Task spec that names this skill, or a coordinator preamble with a task ID. Covers what is authoritative, when to decide and when to stop with a question, assumption IDs, tests, checks, and the report.
---

# orca-worker

How to work an Orca Task. How to sequence the work is yours.

## Authority

The shape file and its rulings file, named in the Task spec, are authoritative; the spec is a
view of them. Read both before anything else. Where the spec and the shape or a ruling disagree,
that is a question.

## The door rule

For each decision the shape and rulings don't settle:

- **Settled** in the shape or a ruling → follow it.
- **Two-way door** → decide, log it as an assumption, carry on.
- **One-way door** → stop with a question.

A one-way door is costly to undo once shipped because someone outside this change pays:

- **Consumers** - public routes, API shapes, events, contracts others consume.
- **Data** - persisted schema, migrations, stored data, formats written to disk or a queue.
- **Architecture** - module boundaries, state ownership, sync vs async between components, a new
  store, cache or queue, cross-cutting conventions (errors, logging, auth flow, config).
- **Infrastructure** - cloud resources, network, IAM, secrets, CI/CD, environments, recurring
  cost.
- **Precedent** - the first instance of a pattern; later code and agents copy it.
- **Dependencies** - a new package or service others will build on.
- **Security** - auth and trust boundaries, sensitive data.
- **External effects** - sends, deletes, payments; anything that cannot be recalled.
- **Test contracts** - changing what an existing test asserts.

Contradicting the shape or a ruling is always a question. Unsure → treat it as a one-way door and
say so in the question. Over-escalating is a defect like missing one: a two-way door is yours.

## Questions

Write the question to your report, then stop with:

```bash
orca orchestration send --type worker_done --task-id <task> --dispatch-id <dispatch> \
  --from <handle> --outcome failed --subject "Question: <one line>" --report-path <report>
```

Take the task ID, dispatch ID and `--from` handle from your preamble; without them Orca settles
nothing. One decision per question, readable without opening anything else:

```
**Q1.** <neutral question: answerable either way without the stance; concrete>

Stance: <a strong opinion, weakly held, reasoning inline>
Wrong if: <the condition that refutes the stance>
Rules out: <what agreeing costs>
One-way door: <what makes it costly to reverse, and who pays>
Meanwhile: <what stays parked until the ruling, and what is already done>
```

No option lists in the stance. Never ask through a local prompt; no one is at the keyboard.

## Assumptions

Log every two-way-door decision as an assumption, numbered per Task with the Task's prefix:
`S1/A1`, `S1/A2`, ... Each says what you decided and what it rules out, in one or two lines. IDs
are never reused.

## Tests

Write the tests from the spec's acceptance cases first. A requirement with no
observable form gets a test you pick; log the choice as an assumption.

## Checks

Before reporting success, run the repo's own lint, typecheck, test and build commands - find them
in its manifests and `AGENTS.md`/`CLAUDE.md`, never invent them. A failing check is not success.
Never push.

## Report

Write the report to the path the Task names; it is never committed.

```
# <task ID>: <one line>

Outcome: succeeded | failed | question
Requirements: R1 - done, <test that shows it> | not done, <why>
Assumptions: S1/A1 - <decision>; rules out <...>
Checks: <command> - pass | fail
Follow-ups: <proposed work outside this Task>
Question: <only when stopping on one>
```

Propose follow-ups in the report; never create Tasks. Finish with the same command as a question,
with `--outcome succeeded` or `--outcome failed`, a one-line `--subject`, and a `--body` that
summarises the report in three sentences: what you did, what you found, what's left.
