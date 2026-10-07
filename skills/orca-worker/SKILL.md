---
name: orca-worker
description: Use when working an Orca Task as a dispatched worker - a Task spec that names this skill, or a coordinator preamble with a task ID. Covers what is authoritative, when to decide and when to ask a question, assumption IDs, tests, checks, and the report.
---

# orca-worker

How to work an Orca Task. How to sequence the work is yours.

## Authority

The shape file named in the Task spec is authoritative, and so are the answers to this Task's
questions: the replies to your own asks, and any the coordinator sends you from an earlier
attempt. The spec is a view of them. Read the shape and those answers before anything else. Where
the spec and the shape or an answer disagree, that is a question.

The coordinator sends every attempt a starting message: this Task's earlier questions and
answers, or that there are none. It never appears in your prompt and may arrive after you start,
so your first command waits for it:

```bash
orca orchestration check --terminal <handle> --wait --timeout-ms 100000 --json
```

Read every message in the batch, then ack it. The ack checks again, so read and ack each batch it
returns until one has no `deliveryId`:

```bash
orca orchestration check --terminal <handle> --ack <delivery_id> --json
```

If the wait times out with nothing, send `worker_done --outcome failed` saying no starting message
arrived. Never start without it.

## The door rule

For each decision the shape and answers don't settle:

- **Settled** in the shape or an answer → follow it.
- **Two-way door** → decide, log it as an assumption, carry on.
- **One-way door** → ask a question.

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

Contradicting the shape or an answer is always a question. Unsure → treat it as a one-way door and
say so in the question. Over-escalating is a defect like missing one: a two-way door is yours.

## Questions

One decision per question, readable without opening anything else. Number questions per Task
like assumptions: `S1/Q1`, `S1/Q2`, ...

```
**S1/Q1.** <neutral question: answerable either way without the stance; concrete>

Stance: <a strong opinion, weakly held, reasoning inline>
Wrong if: <the condition that refutes the stance>
Rules out: <what agreeing costs>
One-way door: <what makes it costly to reverse, and who pays>
Meanwhile: <what stays parked until the answer, and what is already done>
```

Ask with the whole block:

```bash
orca orchestration ask --timeout-ms 60000 --json --question "$(cat <<'EOF'
<the S1/Q1 block>
EOF
)"
```

Keep the message ID it returns. A timeout exits 1 with `timedOut: true` and leaves the question
pending: carry on with what it doesn't park, and at each checkpoint run `ask --resume
<message_id>` with the same timeout. When only parked work is left, run the resume with
`--timeout-ms 1800000`, Orca's maximum, as a background command and end your turn; you wake when
it exits. On a timeout, start it again. The reply is the answer: follow it, whether it decides the
question or hands it back to you. Never send `worker_done` to stop on a question.

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

The report is the `worker_done` body; Orca keeps it on the Task.

```
# <task ID>: <one line>

Outcome: succeeded | failed
Requirements: R1 - done, <test that shows it> | not done, <why>
Assumptions: S1/A1 - <decision>; rules out <...>
Checks: <command> - pass | fail
Follow-ups: <proposed work outside this Task>
Questions: S1/Q1 - <message ID> - <answer, or pending>
```

Propose follow-ups in the report; never create Tasks. Finish with:

```bash
orca orchestration send --type worker_done --task-id <task> --dispatch-id <dispatch> \
  --from <handle> --outcome succeeded|failed --subject "<one line>" --body "$(cat <<'EOF'
<the report>
EOF
)"
```

Take the task ID, dispatch ID and handle (`--from`, `--terminal`) from your preamble; without
them Orca settles nothing.
