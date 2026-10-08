---
name: orca-worker
description: Use when working an Orca Task as a dispatched worker - a Task spec that names this skill. Covers what is authoritative, when to decide and when to ask a question, assumption IDs, and the report.
---

# orca-worker

How to work an Orca Task. What the work is, and how to check it, is the Task spec's; how to
sequence it is yours.

## Authority

The Task spec is authoritative, and so are the replies to your own questions. Everything this
attempt needs is in the spec; nothing else arrives before you start. Where the spec and a reply
disagree, that is a question.

The spec's first line names the Task's key, `T<n>`. It prefixes every question, assumption and
finding ID you write.

## The door rule

For each decision the spec and replies don't settle:

- **Settled** in the spec or a reply → follow it.
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

Contradicting the spec or a reply is always a question. Unsure → treat it as a one-way door and
say so in the question. Over-escalating is a defect like missing one: a two-way door is yours.

## Questions

One decision per question, readable without opening anything else. Number questions per Task:
`T1/Q1`, `T1/Q2`, ...

```
**T1/Q1.** <neutral question: answerable either way without the stance; concrete>

Stance: <a strong opinion, weakly held, reasoning inline>
Wrong if: <the condition that refutes the stance>
Rules out: <what agreeing costs>
One-way door: <what makes it costly to reverse, and who pays>
Meanwhile: <what stays parked until the answer, and what is already done>
```

Ask with the whole block:

```bash
orca orchestration ask --timeout-ms 60000 --json --question "$(cat <<'EOF'
<the T1/Q1 block>
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

Log every two-way-door decision as an assumption, numbered per Task: `T1/A1`, `T1/A2`, ... Each
says what you decided and what it rules out, in one or two lines. IDs are never reused.

## Report

The report is the `worker_done` body; Orca keeps it on the Task.

```
# T1: <one line>

Outcome: succeeded | failed
<the lines the spec asks the report to add>
Assumptions: T1/A1 - <decision>; rules out <...>
Questions: T1/Q1 - <message ID> - <answer, or pending>
Follow-ups: <proposed work outside this Task> | none
Toolbox: <what this Task lacked - a skill, a tool, a permission, an instruction - and what would have supplied it> | none
```

Propose follow-ups in the report; never create Tasks. Finish with:

```bash
orca orchestration send --type worker_done --task-id <task> --dispatch-id <dispatch> \
  --from <handle> --outcome succeeded|failed --subject "<one line>" --body "$(cat <<'EOF'
<the report>
EOF
)"
```

Take the task ID, dispatch ID and handle from your preamble; without them Orca settles nothing.
