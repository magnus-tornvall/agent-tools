---
status: draft
mvp: >-
  One trial item carried from an mvc shape to a merge-ready local branch through Orca, the owner
  touching it only at the grill, at gate rulings, and at the report.
tasks:
  - id: 1
    step: Smoke-test a worker blocked in ask across an hours-long wait
    done_when: the worker resumes after a late reply, or the fallback below is adopted
    status: todo
  - id: 2
    step: Smoke-test a gate on one Task
    done_when: sibling Tasks still dispatch while it is open; whether Orca's UI shows it is recorded
    status: todo
  - id: 3
    step: Write the worker addendum
    status: todo
  - id: 4
    step: Write the coordinator prompt
    depends_on: [1, 2, 3]
    status: todo
  - id: 5
    step: Write the inbox skill
    depends_on: [2]
    status: todo
  - id: 6
    step: Owner runs mvc for the scaffold item, writing the shape to a durable path
    status: todo
  - id: 7
    step: Run the scaffold item end to end
    depends_on: [4, 5, 6]
    done_when: merge-ready local branch, report read, touches and time logged
    status: todo
---

# Async mvc on Orca orchestration

## Problem

The owner settles a change with `mvc` and then implements it serially; more than two parallel
items is taxing. The goal: hand a settled shape to agents, get back a merge-ready local branch,
and spend owner attention only on decisions costly to reverse — answered in batches, not as
interruptions — while the owner still understands what shipped.

## Why this shape

- **The owner is the serial fraction** (Amdahl). Throughput is capped by owner touches, so cut
  their number and cost, not agent time.
- **Supervisory fan-out ≈ neglect time / interaction time + 1** (Olsen & Goodrich 2003). A
  settled shape raises neglect time; self-contained questions cut interaction time.
- **Open loops drain, not queue length** (Rubinstein/Meyer/Evans 2001; Leroy 2009), and **batched
  interruptions lower stress** (Kushlev & Dunn 2015; Fitz et al. 2019) → park the question,
  answer in scheduled windows.
- **WIP limits** (Reinertsen): more items in flight without more throughput only lengthens lead
  time. Expected ceiling: 3–5 items, not 10.
- **Review effectiveness drops past ~400 LOC and 60–90 min** (SmartBear/Cisco) → the owner reviews
  decisions and evidence, not whole diffs.
- **Out-of-the-loop and automation bias** (Bainbridge 1983; Endsley & Kiris 1995; Parasuraman &
  Manzey 2010) → the report feeds understanding back; spot-check it; count escapes.
- **Generation effect** (Slamecka & Graf 1978) → the owner writes the shape; agents write the how.
- **Self-perception is unreliable** (METR 2025: 19% slower, felt 20% faster) → measure touches,
  don't judge by feel.

## Approach

`mvc` is the decision layer, Orca is the execution layer. Build only the glue between them.

- **`mvc` already does the planning handoff.** The grill settles every one-way door before code is
  written, which is what a separate planner and brief would exist to do. Its shape file is the
  agents' spec.
- **Orca already does the coordination.** A Run is the mailbox, Tasks with dependencies are the
  slices, `worker-start` gives each slice its own worktree, `ask` is the blocking question, and a
  gate parks one task while the rest of the graph moves.
- **The escalation rule is the door distinction.** Settled in the shape or a ruling → answered
  from there. Two-way door → the worker decides, records it as an assumption, carries on. One-way
  door → the owner decides. No other tiers.

## Flow

```
owner: mvc ─► shape file
  ─► coordinator agent: run-create, task-create per slice (deps), worker-start per ready slice
  ─► workers implement; one-way door ─► ask ─► coordinator gates the blocked task
  ─► owner: inbox window, resolves gates ─► coordinator records the ruling, replies, worker resumes
  ─► all slices done ─► coordinator runs lint/test/build on the integrated branch, writes the report
  ─► owner: reads report, pushes, opens PR
```

The owner touches each item three times: the `mvc` grill, gate rulings (only when a one-way door
surfaces), and the final report.

## Shape → task spec

Each Task spec is self-contained and uses Orca's task-spec fields, filled from the shape file:

| Task-spec field | From the shape |
|---|---|
| Target | `touchpoints` for this slice |
| Change | the slice of `outcome` and `approach` it delivers |
| Constraints | `constraints`, `non_goals`, and the decision log's rejected alternatives |
| Ownership | the files this slice may edit; everything else is read-only |
| Observable acceptance | the `requirements` it satisfies, as given/when/then tests |

Every spec carries the absolute paths of the shape file and the rulings file. Both are
authoritative; the spec is a view of them.

**Two files, two owners.** The shape file is `mvc`'s export: written once, never edited by agents.
Rulings made during the run go to `<shape-name>.rulings.md` beside it, appended by the coordinator
only. A later `mvc` re-run replaces the shape without losing rulings. The shape must be written to
a durable path, not the system temp directory.

**IDs.** The coordinator assigns them when slicing, so the report can point back: requirements
`R1…` in the order the shape lists them, slices `S1…` as Task title prefixes, assumptions `A1…`
and rulings `D1…` in the order they arise. IDs are never reused within an item.

## Mid-flight decisions

1. The worker hits a decision the shape and rulings don't settle. Two-way door: decide, record it
   as an assumption, continue. One-way door: `ask` the Run, in `mvc`'s question format (neutral
   question, stance, Wrong if, Rules out, One-way door), plus a **Meanwhile** line naming what
   stays parked. One decision per question, readable without opening anything else.
2. The coordinator re-checks the shape and rulings. If they settle it, reply. If the worker
   mis-classified a two-way door, reply with "decide it, record the assumption". Otherwise
   `gate-create` on each Task that depends on the answer, and leave the `ask` pending.
3. The owner opens the inbox in a scheduled window, reads each gate, and answers with
   `gate-resolve --resolution "<free text>"`. Free text keeps "you are asking the wrong thing" as
   easy to type as an answer.
4. The coordinator appends the ruling to the rulings file, then replies to the pending `ask` with
   it.

More than three one-way doors surfacing on one item means the shape wasn't settled: the
coordinator stops dispatching and reports it back as a reason to run `mvc` again.

**What counts as a one-way door** — costly to undo once shipped because someone outside this
change pays:

- **Consumers** — public routes, API shapes, events, contracts others consume.
- **Data** — persisted schema, migrations, stored data, formats written to disk or a queue.
- **Architecture** — module boundaries, state ownership, sync vs async between components, a new
  store, cache or queue, cross-cutting conventions (errors, logging, auth flow, config).
- **Infrastructure** — cloud resources, network, IAM, secrets, CI/CD, environments, recurring cost.
- **Precedent** — the first instance of a pattern; later code and agents copy it.
- **Dependencies** — a new package or service others will build on.
- **Security** — auth and trust boundaries, sensitive data.
- **External effects** — sends, deletes, payments; anything that cannot be recalled.
- **Test contracts** — changing what an existing test asserts.

Contradicting the shape or a ruling is always a question. Unsure → treat it as a one-way door and
say so in the question. This list is wider than `mvc`'s today; see [Deferred](#deferred).

Asking is not free: over-escalating is a defect like missing one. The rule changes only from
evidence — an escape after merge — never on a calendar.

## Pieces to build

| Piece | Form | Contents |
|---|---|---|
| Coordinator | Agent prompt | Slice the shape into Tasks and assign IDs; the escalation rule; gate-on-ask; keep the rulings file; never push; release settled workers; final integration check and report. |
| Worker addendum | Text appended to each Task spec | Shape and rulings are authoritative; ask only on one-way doors; record assumptions with IDs; tests from the acceptance cases first; a requirement with no observable form gets a test the worker picks, recorded as an assumption. |
| Inbox | Skill | `gate-list` across open Runs, show each question, `gate-resolve` with the owner's answer. |

The report is ordered surprise-first, so the owner reads what most needs a decision before what
merely confirms:

1. Anything that contradicts the shape or a ruling — blocks pushing until ruled.
2. Changes outside the shape's touchpoints.
3. Assumptions the workers made (`A…`).
4. Rulings made at gates (`D…`).
5. Per requirement (`R…`): done or not, with test evidence.

## Constraints

- Agents never push. The owner pushes and opens the PR after reading the report.
- Every code-changing worker runs in its own worktree from `main`
  (`worker-start --worktree new-top-level --base-branch main`).
- One item in flight until one has run cleanly end to end; then at most three.
- Orca is the only task state. No second tracker.
- Trial repo only: `~/dev/me/ai/vscode` (github.com/magnus-tornvall/vscode), local branches from
  `main`. It is empty today, so the first item establishes the lint/test/build commands the
  coordinator's integration check calls.

## Non-goals

- backlog-md as the tracker — boundary. Orca tasks hold the state.
- Notifications — boundary. The owner opens the inbox on their own schedule.
- Every reviewer-type agent — deferral; see [Deferred](#deferred).

## Deferred

Captured so they aren't lost; each waits for evidence from a trial run.

### Workflow

- **Surprise check.** After all slices pass and before the report, a fresh agent sees only the
  shape, the rulings, the diff and the logged assumptions — never worker transcripts, so it does
  not inherit their reasoning — and lists what a reader holding only shape and rulings would not
  expect. Each surprise lands in one bin: logged assumption (fine), unlogged decision (goes in the
  report, counts as a near miss), contradiction (blocks pushing). It catches the failure nothing
  else here sees: a worker that mis-classified a one-way door and never asked. Trigger to add it:
  the first escape, or the first unlogged decision the owner finds in a diff.
- **More review roles.** A code reviewer that sees only the diff (no spec, to avoid anchoring), a
  conformance reviewer checking diff against shape, a fixer with one round, and a judge separate
  from the finders. Add one only when an escape shows a gap it would have caught.
- **A scheduled tick** instead of a live coordinator. Smoke-tested; the fallback if coordinator
  sessions prove fragile.
- **IDs scoped across items** (e.g. `#58/D2`) once more than one item is in flight.

### mvc

- **Widen the one-way door definition** to the list above. `mvc` names only public routes and API
  shapes, persisted columns, consumed contracts, depended-on dependencies, and data migrations;
  architecture, infrastructure, precedent, security, external effects and test contracts are
  missing. Precedent matters most for agents, which copy what exists. One definition in one place,
  so this spec and `mvc` can't drift.
- **IDs in the shape file.** Requirements and decision-log entries carry IDs that outlive the
  conversation, so the coordinator inherits them instead of numbering by position.
- **Every requirement observable.** A closing check that each requirement is given/when/then or
  says why it can't be, so no worker invents acceptance.
- **Rulings as round-0 input.** A re-run after too many one-way doors reads the rulings file as
  facts, so the grill doesn't re-ask what the owner already ruled.

## Measure

Per item: owner touches, time spent, escapes after merge. Compare with plain `mvc` followed by
manual implementation over 3–5 items.

Calibration signals, logged per item, read only after several items:

- `ask`s answered from the shape or rulings → the worker isn't reading them.
- `ask`s sent back as two-way doors → over-escalating.
- Gates → the real one-way doors; many means a thin shape.
- Escapes → under-escalating. For each, record which door category should have fired; that is the
  only input that changes the escalation rule.

## Trial

A read-only VS Code extension that shows the Orca tasks of open Runs, specced with `mvc` as three
items, run one at a time in order:

1. Scaffold — extension skeleton and the lint/test/build commands. Likely one-way doors: package
   manager, bundler, test runner (precedent), dependencies.
2. Task view — a tree of tasks grouped by status. Hinge: read Orca state through
   `orca orchestration ... --json`, or some other way (consumers, data).
3. Owner queue — a view of open gates with a count in the status bar, opening the question.
   Hinge: may anything in the extension resolve a gate (external effects)?

## Known Orca behaviour

Smoke-tested on Orca 1.4.220:

- A worker keeps running after the session that started it closes, and its `worker_done` stays in
  the Run's mailbox until read. The payload carries `taskId`, `dispatchId` and `outcome`.
- `run-use` fences the previous consumer: only one terminal at a time may read a Run's inbox; any
  other terminal's `check`, even `--peek`, fails with `consumer_fenced`.
- An automation with `--precheck` that fails records `skipped_precheck`, dispatches nothing, and
  keeps its schedule. A manual `automations run` skips the precheck.
- `worker-release` closes the terminal and keeps the worktree and branch; remove them after merge
  or abandonment.
- `ask` timing out leaves the question pending; the worker resumes it by message ID.
- `gate-resolve --resolution` takes free text; `gate-create --options` is optional.

Unverified, and tasks 1–2 above: whether a worker blocked in `ask` survives an hours-long wait —
fallback: the worker sends `worker_done --outcome failed` with the question, and the coordinator
re-dispatches the Task after the ruling — and whether a gate on one Task leaves its siblings
dispatchable and shows in Orca's UI.

Ask before writing outside this repo.
