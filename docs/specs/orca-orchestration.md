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
- **One writer per change; parallelism across items** (Cognition 2025–26; Anthropic multi-agent
  research 2025; "Towards a Science of Scaling Agent Systems" 2025: −70% on sequential work, +81%
  on decomposable work) → one agent
  owns an item end to end; items run side by side.
- **Boundaries in code, process in agents** (OpenAI on Symphony: "treating agents as rigid nodes in a
  state machine doesn't work well"; Cemri et al. 2025: most multi-agent failures are system
  design and agents misaligning with each other) → a deterministic script dispatches and enforces
  what no agent may move; no agent coordinates. The owner runs it through a skill that holds the
  only judgement in the loop: rulings, and what follows a failure. How a Task gets done belongs to
  the agent that owns it, working from an objective and a toolbox, so a better model does more
  without more glue.
- **Asking pays, when cheap and early** (Ambig-SWE 2025: up to +74% on underspecified tasks;
  ImpossibleBench 2025: an explicit way to flag cut test cheating from 54% to 9%) → the grill
  settles ambiguity up front, and a one-way door still stops the worker.
- **Passing checks is not mergeable** (UTBoost 2025: 15.7% of passing patches wrong; METR 2026:
  maintainers merged 24 points below the grader) and **self-review is weak** (ImpossibleBench
  2025: agents cheated on about half of impossible tasks; LLM monitors caught 42–50%) → whoever
  produces a change never certifies it. Required gates the producer can neither skip nor steer
  stand between every code change and the owner.
- **Repo policy files help only when short** (Gloaguen et al. 2026: +4% success, up to +19% cost)
  → always-loaded repo files hold only repo facts; the worker protocol is a skill, loaded when
  an agent works an Orca Task.
- **Review effectiveness drops past ~400 LOC and 60–90 min** (SmartBear/Cisco) → the owner reviews
  decisions and evidence, not whole diffs.
- **Out-of-the-loop and automation bias** (Bainbridge 1983; Endsley & Kiris 1995; Parasuraman &
  Manzey 2010) → the report feeds understanding back; spot-check it.
- **Generation effect** (Slamecka & Graf 1978) → the owner writes the shape; agents write the how.

The evidence behind the newer bullets, with strength and disputed figures, is in the
[research report](../research/agentic-systems/report.md).

## Approach

`mvc` is the decision layer, Orca is the execution layer and the only work state. Between them
sit a tick script, three skills and a few rules; no agent runs the loop on its own.

- **Orca's model, used as designed.** Runs, Tasks, Dispatches, `ask`/`reply`, gates, retries and
  cancellation are used the way Orca's orchestration guide describes them. The tick is the Run's
  coordinator; workers follow the worker contract. Where Orca's model and this design disagree,
  the design changes. Nothing works around Orca: no conventions layered over its state, no verb
  used for a job the guide gives another.

- **`mvc` stays a simple first step.** The grill settles every one-way door before code is written
  and, when an item has parts, names the split. Its shape file is the agents' spec.
- **`to-orca` turns the shape into a Run.** One Task per part, dependencies from the shape. It
  decides nothing; a split the shape doesn't name doesn't happen. How much it adds beyond pointing
  each Task at the shape is open until a real shape has been run (OO-19).
- **Code does the mechanics; the owner runs it.** The tick script reads Orca state, replies to
  questions with the owner's rulings and records them, starts ready Tasks under a cap, runs the required gates and
  releases settled workers. It holds nothing between runs and is tested against recorded Orca
  JSON. The `orca-tick` skill wraps it for judgement: the owner runs it in a scheduled window, it
  shows each question, failure and report, and it calls the script for everything else. Neither
  decides how a Task is done.
- **Workers own a Task with a toolbox.** One agent owns a Task end to end from an objective: the
  shape and rulings, the repo's own commands, the `orca-worker` skill, Orca's orchestration verbs,
  and any subagents it chooses to use on its own work. Better models use the same toolbox better;
  nothing in the harness has to change.
- **The escalation rule is the door distinction.** Settled in the shape or a ruling → follow it.
  Two-way door → the worker decides, records an assumption, carries on. One-way door → the worker
  asks with Orca's `ask`, parks what the question decides, and the owner rules. No other tiers.
- **The producer never certifies.** Every code change passes required gates the worker can neither
  skip nor steer: the repo's checks first, then a review agent with a clean context. A gate
  detects and sorts; it never edits code. What it finds goes in the report.

## Flow

```
owner: mvc grill ─► shape file ─► to-orca: Run, Tasks S1…Sn with deps
  ─► owner runs orca-tick: worker-start per ready Task (cap), each in its own worktree
  ─► worker implements with its toolbox; one-way door ─► ask, carries on with what isn't parked
  ─► owner runs orca-tick: reads each question, rules ─► reply, ruling appended ─► worker resumes
  ─► all parts done ─► tick script runs the repo's checks on the item branch ─► surprise check Task
  ─► orca-tick shows the item report ─► owner pushes and opens the PR, or rules a rework
```

The owner touches each item at the `mvc` grill (with `to-orca` in the same sitting), in tick
windows where a question or a report is waiting, and at the final push. A tick with nothing to
rule costs a glance.

## Shape → Task spec

`to-orca` writes each Task spec from the shape, using Orca's task-spec fields. This table is the
starting guess: running a real shape decides whether the spec needs more than a pointer to the
shape and the part's name (OO-19).

| Task-spec field | From the shape |
|---|---|
| Target | `touchpoints` for this part |
| Change | the part of `outcome` and `approach` it delivers |
| Constraints | `constraints`, `non_goals`, and the decision log's rejected alternatives |
| Ownership | the files this part may edit; everything else is read-only |
| Observable acceptance | the `requirements` it satisfies, as given/when/then tests |

Every spec carries the absolute paths of the shape file and the rulings file, says to read and
follow both, and names the `orca-worker` skill. The shape and rulings are authoritative; the spec
is a view of them. Edits to the skill take effect on the next attempt.

**Unit of work.** One Task per item by default. The shape may name independent parts (parallel
Tasks) or a strict sequence (a chain); `to-orca` copies that and nothing else (OO-6). Several
agents never write one change in parallel.

**Two files, two writers.** The shape file is `mvc`'s export: written once, never edited by
agents. Rulings go to `<shape-name>.rulings.md` beside it, appended only by the tick script. A later
`mvc` re-run replaces the shape without losing rulings. The shape must be written to a durable
path, not the system temp directory.

**IDs.** `to-orca` assigns requirements `R1…` in shape order and parts `S1…` as Task title
prefixes. Workers number assumptions per Task (`S1/A1`). The tick script numbers rulings `D1…`,
each naming the Task it answers. IDs are never reused within an item.

## Where policy lives

Each piece of policy goes where its reader already looks:

| Policy | Home | Read by |
|---|---|---|
| Agent, model, concurrency cap, base branch | Flags to the tick script, with defaults | The tick script |
| The check commands the mechanical gate runs | A committed per-repo file | The tick script |
| The surprise check's Task spec | The tick script | The surprise check agent |
| Lint/test/build commands, repo conventions | The repo itself: its manifests and `AGENTS.md`/`CLAUDE.md` | Workers, the way any agent finds them |
| How to work an Orca Task | The `orca-worker` skill | Workers |
| What a worker may run, the `git push` deny | The repo's committed `.claude/settings.json` | Claude Code, enforced |

The `orca-worker` skill says: the shape and rulings are authoritative; the door rule and the
list below; the question format; assumptions logged with IDs; tests from the acceptance cases
first, and a requirement with no observable form gets a test the worker picks, logged as an
assumption; run the repo's checks before reporting success; the report format; propose follow-ups
in the report, never create Tasks. It is loaded only when an agent works an Orca Task, and its
lines are instructions an agent follows at a cost, so keep it short.

The check commands are the repo's own, named again in the per-repo file so the script can run
them without a model; the file holds nothing else.
Nothing here tells a worker how to sequence its work.

## Mid-flight decisions

Questions use Orca's own `ask` and `reply`, as Orca's orchestration guide intends: a worker asks,
the coordinator replies. Gates stay what the guide says they are, coordinator-owned decisions on
the Task DAG, and never carry a worker's question.

1. The worker hits a decision the shape and rulings don't settle. Two-way door: decide, record it
   as an assumption, continue. One-way door: write the question to its report in `mvc`'s format
   (neutral question, stance, Wrong if, Rules out, One-way door) plus a **Meanwhile** line naming
   what stays parked, then `ask` with that whole block as `--question` and a timeout. One
   decision per question, readable without opening anything else.
2. `ask` blocks only until its timeout; the question stays pending in Orca. The worker carries on
   with the work the question doesn't park and resumes the same question by message ID
   (`ask --resume <message_id>`) at its checkpoints. With nothing left that the question doesn't
   park, it waits on the resume. It never sends `worker_done` to stop on a question.
3. Tasks that depend on the asking Task stay pending until it completes; the rest of the DAG moves.
4. The owner runs `orca-tick` in a scheduled window, in the terminal that is the Run's
   coordinator. The script reads the questions from the Run's inbox, and the skill shows each one.
   The owner answers in free text. Free text keeps "you are asking the wrong thing" and "that's a
   two-way door, decide it" as easy to type as an answer. The skill hands the answer to the
   script, which sends it with `reply --id <message_id>` and appends it to the rulings file.
5. The worker's resume returns the ruling and it carries on in the same attempt. If the attempt
   ended before the reply reached it, the next attempt reads the ruling from the rulings file with
   the shape.

More than three one-way doors on one item means the shape wasn't settled. The tick shows the
count, and the owner sends the item back to `mvc` rather than ruling again.

The tick shows every attempt that didn't succeed, and the owner decides what follows, using
Orca's verbs for it:

- **Ended without a report** (crash, kill, closed terminal; Orca records it) → shown with Orca's
  `lastFailure`, and the number of attempts so far. The owner retries or cancels.
- **Reported failed** → shown with the report body. The owner retries (`worker-start --retry-of`)
  or cancels. Never retried without the owner.
- **Cancel** is Orca's: settle the worker if it is still live (`worker-stop` or `worker-abandon`),
  then `task-update --status failed --result cancelled`. Dependants stay blocked.

Orca enforces no attempt limit on `worker-start` (see
[Known Orca behaviour](#known-orca-behaviour)), so the script counts attempts as the Dispatches
`worker-list --run` names for each Task. A crash leaves the Task `ready`, and a `ready` Task
restarts with plain `worker-start`, so the `retry_of_dispatch_id` chain can undercount.

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

## Required gates

The worker that produced a change never certifies it. Every code change passes the gates below
before the owner sees it. The tick script runs them with inputs fixed in code, so neither a
worker nor the skill can skip them or choose their inputs. A worker may still use reviewers of its own while it works; those are its toolbox, not
gates, and count for nothing here.

A gate is either mechanical or an agent with a clean context. An agent gate is defined by a
contract, not a role: fixed inputs, one objective, a verdict format. It never sees worker
transcripts, so it doesn't inherit their reasoning, and it never edits code: one writer per
change. Mechanical gates run first, and an agent gate never replaces them.

When every implementation Task of an item has completed, the tick script runs:

1. **Mechanical gate**, on the item branch: the repo's check commands, a flag for every changed
   test file, and a flag for every file outside the shape's touchpoints. A failing command is a
   finding: the worker reported success on checks that don't pass. The flags are not findings;
   they go in the report.
2. **Surprise check**, an agent gate the tick starts as an Orca Task once the mechanical gate
   passes.
   - **Inputs:** the shape, the rulings, the diff, the worker reports and the mechanical gate's
     results.
   - **Objective:** list what a reader holding only the shape and rulings would not expect.
   - **Verdict:** each surprise in one bin:
     - **logged assumption** — fine, listed in the report;
     - **correctable** — contradicts the shape or a ruling where they settle what is right;
     - **needs a ruling** — an unlogged one-way-door decision, or a contradiction the shape
       doesn't settle; the script opens a gate on the item's Task for it, and it counts as a near
       miss.
3. **No automatic rework.** Findings go in the report. The owner pushes as is, or rules what to
   fix; the tick then starts a rework Task — a worker with the item's own objective plus the
   findings — and runs the gates once more when it completes. A worker handed findings works like
   any other worker; there is no separate correction role. How a rework attempt starts from the
   item branch is open (OO-20), and is settled the first time one is ruled.

The surprise check writes the item report, ordered surprise-first:

1. Anything that contradicts the shape or a ruling — blocks pushing until ruled.
2. Mechanical gate results: failing commands, changed tests, changes outside the touchpoints.
3. Assumptions the workers made (`S…/A…`).
4. Rulings made during the item (`D…`).
5. Per requirement (`R…`): done or not, with test evidence.

LLM reviewers miss about half of what they look for (ImpossibleBench 2025), which is why the
mechanical gate runs first and is never replaced.

## Pieces to build

| Piece | Form | Contents |
|---|---|---|
| `to-orca` | Skill | Shape → Run, one Task per named part with dependencies; R and S IDs; show the DAG to the owner. No splitting decisions. How much each spec holds beyond the shape is open (OO-19). |
| `orca-worker` | Skill | How to work an Orca Task (see [Where policy lives](#where-policy-lives)). |
| Tick script | Script, tested against recorded Orca JSON | Runs as the Run's coordinator. `status`: open questions from the Run's inbox and pending gates (needs-a-ruling surprises), with their item's door count; failed or crashed attempts with attempt counts; items ready for gating. `rule`: reply to a question with the owner's ruling and append it with the next D ID. `advance`: start ready Tasks under the cap, retry with `--retry-of` or cancel a Task when the owner says so, release settled workers. `gate`: run the mechanical gate on an item, then start the surprise check. Holds the surprise check's Task spec. Never pushes, never edits code, holds no state. |
| `orca-tick` | Skill, run by the owner | Calls `status`; shows each question, surprise, failure and report; hands rulings to `rule`; asks retry or cancel after a failure; calls `advance` and `gate`. Runs no Orca command the script covers. |
| Rules | Committed repo files | `.claude/settings.json` with the scoped allowlist and the `git push` deny; the check commands file; the constraints below. |

## Constraints

- Agents and the tick never push. The owner pushes and opens the PR after reading the report.
  Workers run under the trial repo's committed `.claude/settings.json`: a scoped allowlist and a
  `git push` deny, never a bypass of permissions.
- Every code-changing worker runs in its own worktree (`worker-start --worktree new-top-level`),
  from `main`. A Task reads `completed` when its worker reports done, before the owner lands it,
  so the tick starts a dependent Task only once every parent's branch is merged into `main`.
- One item in flight until one has run cleanly end to end; then at most three.
- Orca is the only task state. The rulings file is a record, not task state.
- Orca's model is used as its orchestration guide describes, never worked around. When a piece
  of this design needs Orca to behave otherwise, the design changes, not the use of Orca.
- No silence-based kills. A stale worker is shown in the tick; act only on positive evidence that
  it has exited, as Orca's own recovery rules require.
- Trial repo only: `~/dev/me/ai/vscode` (github.com/magnus-tornvall/vscode), local branches from
  `main`. It is empty today, so the first item establishes the lint/test/build commands.

## Non-goals

- An issue tracker — boundary. Orca Tasks hold the state.
- An autonomous coordinator — boundary. The tick runs only when the owner runs it.
- A worker certifying its own change — boundary. Required gates certify.
- Code that scripts how a worker does its Task — boundary. The tick enforces limits and gates.
- Several agents writing one change in parallel — boundary. Parallelism is across items.
- Notifications — boundary. The owner runs the tick on their own schedule.
- A human review gate on intention — deferral; see [Deferred](#deferred).

## Deferred

Captured so they aren't lost; each waits for evidence from a trial run.

### Workflow

- **Scheduled tick.** Run the tick script's `advance` and `gate` from launchd, so Tasks start and
  items are gated without the owner present; rulings still go through the skill. OO-1 showed Orca
  can be driven from launchd with no Orca terminal. Trigger: ticking by hand is the bottleneck.
- **Automatic rework round.** One rework attempt started without the owner when the mechanical
  gate fails or the surprise check finds something correctable. Trigger: the owner rules "fix it"
  on most findings. Needs OO-20.
- **Attempt limits enforced, not shown.** The tick stops dispatching an item after three one-way
  doors, and sends a Task to the owner after three crashes in a row, without asking. Arrives with
  the scheduled tick.
- **Intention review gate.** The owner judges whether the change does what was meant, from the
  shape, the report and the evidence — not the code. Needs the quality review below first, or
  quality escapes go unseen.
- **Quality review**, a second agent gate. Inputs: the diff and the repo, no shape (to avoid
  anchoring). Objective: "would a maintainer of this repo merge this?". Verdict: merge as is, or
  the changes a maintainer would ask for. Code quality is the most common reason maintainers reject
  test-passing agent patches (METR 2026). Trigger: the first escape that is a quality problem.
- **More responsibility to workers.** Letting a worker decide the split. Trigger: splits keep
  reaching the owner that the worker would have handled as well.
- **IDs scoped across items** (e.g. `#58/D2`) once more than one item is in flight.
- **Worker-declared transient failures.** A `Blocked:` subject for a failure the worker judges
  environmental (network, rate limit, flaky tool), which the tick retries under its cap without the
  owner. Deferred because a worker's diagnosis is weak evidence (a failing test is easily called
  flaky) and an unattended retry hides a real defect. Trigger: the owner keeps ruling reported
  failures "just retry".

### mvc

- **Widen the one-way door definition** to the list above. `mvc` names only public routes and API
  shapes, persisted columns, consumed contracts, depended-on dependencies, and data migrations;
  architecture, infrastructure, precedent, security, external effects and test contracts are
  missing. Precedent matters most for agents, which copy what exists. One definition in one place,
  so this spec and `mvc` can't drift.
- **IDs in the shape file.** Requirements and decision-log entries carry IDs that outlive the
  conversation, so `to-orca` inherits them instead of numbering by position.
- **Every requirement observable.** A closing check that each requirement is given/when/then or
  says why it can't be, so no worker invents acceptance.
- **Rulings as round-0 input.** A re-run after too many one-way doors reads the rulings file as
  facts, so the grill doesn't re-ask what the owner already ruled.

## Trial

A read-only VS Code extension that shows the Orca tasks of open Runs, specced with `mvc` as three
items, run one at a time in order:

1. Scaffold — extension skeleton and the lint/test/build commands. Likely one-way doors: package
   manager, bundler, test runner (precedent), dependencies.
2. Task view — a tree of tasks grouped by status. Hinge: read Orca state through
   `orca orchestration ... --json`, or some other way (consumers, data).
3. Owner queue — a view of Tasks awaiting a ruling with a count in the status bar, opening the
   question. Hinge: may anything in the extension act on Orca state, such as recording a ruling or
   retrying a Task (external effects)?

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

Smoke-tested on Orca 1.4.221:

- The tick needs no Orca terminal. A launchd job with no `ORCA_*` environment and no `caller` in
  `orca status` ran `task-list --run`, `worker-start --run --task --worktree --agent`,
  `worker-list --run` and `worker-release --dispatch`, all exiting 0. Passing `--run` on every
  call is enough; the tick never runs `run-use`, so it never fences the owner's terminal.
- `worker-start` moves the Task to `dispatched`, so the next tick's `task-list` no longer shows
  it as `ready`. That status, not a request ID, is what stops a second tick from starting it twice.
- `--retry-request` only accepts the UUID Orca issued for an earlier request; a caller-chosen key
  is refused with `invalid_argument`.
- Release what `worker-list` names: a settled worker's `projection.nextAction.argv` is
  `worker-release --dispatch <id>`. Its `terminalState` can be `retained` rather than
  `reclaimable` (it was after `worker-stop`), so filtering on `reclaimable` misses it.
- `worker-stop` settles the Dispatch as `failed` and leaves the Task `blocked`.
- A `worker_done` without `--dispatch-id` is rejected and settles nothing; the Task stays
  `dispatched`. It still reaches the Run's inbox as a `worker_done` whose payload carries
  `_orcaLifecycleRejection` (`missing_dispatch_id`), so only an inbox reader sees why.
- `orca terminal send` to a supervised worker's terminal is refused with `agent_prompt_blocked`.
  Talk to a worker through the orchestration verbs.
- A `claude` worker started without permission settings stopped at a prompt for its own
  `orca orchestration send`. `worker-start` has no permission flag: the worker launches as the
  owner's new-agent-tab setting says.
- A scoped `.claude/settings.json` on the worktree's base branch is enough for an unattended
  `claude` worker. It allows `Read`, `Edit`, `Write`, `Bash(orca orchestration:*)` and
  `Bash(git status|diff|add|commit:*)`, and denies `Bash(git push:*)`. A Sonnet worker in a
  `new-top-level` worktree of the trial repo edited, committed and sent `worker_done` with no
  prompt. Its `git push --dry-run origin HEAD` was refused at once ("Permission to use Bash with
  command git push … has been denied"); git never ran and the remote was unchanged. A compound
  command containing the push was refused whole, so the worker split it and edited with `Write`.
  The deny matches the command prefix, so it stops an agent's ordinary push, not a determined one
  (`git -C . push` would not match).
- A settled `new-top-level` worker is releasable: `terminalState` `reclaimable`, `nextAction`
  `worker-release --dispatch <id>`, liveness still `live`. Releasing it left the worktree and its
  branch. Only a `--worktree current` worker reads `user_owned` with nothing to release.
- A valid `worker_done` settles the Task with no inbox reader. Nobody ran `check`; `task-list`
  showed the Task `completed` within ten seconds of the send, while the message sat in the Run
  mailbox unread, never delivered or acknowledged. Reading and acking it later changed no Task
  or Dispatch state. The tick reads Task state only; the inbox belongs to the owner.
- `run-create` binds the Run to the terminal it runs under, even from a child process with every
  `ORCA_*` variable removed: Orca identifies the caller by process, not environment. So the
  owner's terminal that runs `to-orca` is the Run's inbox reader. It ran `check` and `--ack`
  while `task-list`, `worker-list` and `worker-release` ran beside it, and was not fenced. Here
  those tick calls ran as children of the owner's terminal; OO-1 ran them from launchd.
- `worker-start --task … --retry-of <dispatch_id>` starts a fresh attempt on a Task left `blocked`
  by `worker-stop`.
- A worker that settled `succeeded` in `--worktree current` reads `resource.state: user_owned` with
  `nextAction` `none`, and its terminal stays live. `worker-list` names no release, so the tick
  leaves it.
- `worker_done --outcome failed` moves the Task straight to `failed` and leaves the Dispatch's
  `failure_count` at 0. Four such attempts in a row, chained with `--retry-of`, and a
  `worker-stop` among them, all left it at 0; each retry was accepted. A question costs nothing
  against Orca's limit, so there is nothing for a retry after a ruling to reset.
- `failure_count` rises only when Orca itself sees the attempt end: the worker's terminal process
  exits without a report (`last_failure` "Agent process ended"), the terminal is closed, preamble
  injection fails, or (read from the bundle, not tested) an escalation arrives once the worker has
  settled. Killing only the agent process left the Dispatch `dispatched` and its liveness
  `unverifiable`; killing the pane's shell settled it `failed` with `failure_count` 1 and put the
  Task back to `ready`, not `failed`. Each such exit also put an `escalation` from Orca, "Agent
  exited unexpectedly", in the Run's inbox; reading and acking it later changed no count.
- The limit never trips through `worker-start`: each new Dispatch starts at 0, with or without
  `--retry-of`, so three crashes in a row gave three Dispatches at 1 and a `ready` Task. Only plain
  `dispatch` seeds a new Dispatch from the Task's highest count; two dispatches ended by closing
  the terminal went to 2, then 3, `circuit_broken`, Task `failed`. A circuit-broken Task cannot be
  retried: `worker-start --retry-of` refuses it with `task_not_startable`.
- `--retry-of` must name the latest settled Dispatch of a `failed` or `blocked` Task; a `ready`
  Task refuses it and starts with plain `worker-start --task`. A `failed` Task refuses plain
  `dispatch`, though `dispatch --dry-run` accepts it.
- `task-list`'s `result` for a reported Task carries the report's `outcome`, `subject`, `body` and
  `reportPath`; `worker-show` on an older Dispatch still returns its `lastFailure`, so a Task's
  attempts can be walked back through `retry_of_dispatch_id`.
- `worker-start --terminal` refuses a terminal Orca doesn't recognise as an agent
  (`agent_unconfigured`), even one running a process named `claude`.
- A Haiku worker given a vague spec improvised its own `worker_done` and stalled at a permission
  prompt for a command with a shell variable in it. A precise spec and the scoped settings above
  avoided both.

Smoke-tested on Orca 1.4.222:

- A worker cannot open a gate on its own Task. Its `gate-create --task <own task> --from
  <handle>` failed with `run_required` ("No Run is bound"), and `gate-create` takes no `--run`
  (`invalid_argument`, unknown flag). Only `run-use` would bind it, and that fences the owner's
  inbox. The worker's `worker_done --outcome failed` still settled the attempt: Task `failed`,
  Dispatch `failed`, `failureCount` 0, `lastFailure` carrying the report's subject, body and
  `reportPath`, and `gate-list --status pending` empty.
- `gate-create` acts only on Tasks in the caller's bound Run: from a terminal bound to one Run, a
  Task in another Run is `task_not_found`. `gate-list --run` reads any Run.
- From the terminal bound to the Run, `gate-create` on a `failed` Task moves it to `blocked`, and
  `gate-list --run --status pending` lists the gate with its `task_id` and question.
- `gate-resolve` moves the Task to `ready`, whether it was `blocked` or `failed`. A `ready` Task
  refuses `worker-start --retry-of` (`task_not_startable`); plain `worker-start --task` starts the
  fresh attempt, with `retryOfDispatchId` null.
- A pending gate does not stop a retry: `worker-start --retry-of` on a `blocked` Task with a
  pending gate started an attempt. When that attempt reported `failed`, the Task went back to
  `failed` and the gate stayed pending. The gate, not the Task status, says a question is open.
- `worker-list --run` keeps released Dispatches with their `taskId` and `dispatchStatus`, so a
  Task's attempts can be counted from it.
- `run-list` and `run-show` carry no open or closed field: only `id`, `objective`,
  `coordinator_handle`, `consumer_generation` and timestamps. A Run is a namespace and an inbox,
  not something that opens and closes.

Read from the guide, `--help` and the bundled code on Orca 1.4.221 and 1.4.222, not smoke-tested:

- Task statuses are `pending, ready, dispatched, completed, failed, blocked`; `task-create --deps`
  takes a JSON array; `task-list --ready` lists what can start; `worker-start` refuses a Task with
  unmet dependencies (`task_not_startable`).
- `worker_done` takes `--report-path` alongside `--outcome`, and `--outcome` only `succeeded` or
  `failed`.
- The guide meant gates for coordinator-owned decisions on the Task DAG ("Do not create a gate
  merely to answer a worker's `ask`"); a worker uses `ask`. `gate-list` is scoped to one Run
  (`--run`).
- A worker asks with `ask --question … --timeout-ms <n>`; a timeout leaves the question pending,
  and `ask --resume <message_id>` picks it up. The coordinator answers with `reply --id
  <message_id> --body`. A pending ask and a reply have durable recovery identities.
- `--question` has no length limit and keeps line breaks. Orca stores it as the message body
  under the fixed subject `Question`; `check` prints a multi-line body line by line, `check
  --json` returns it unchanged, and `inbox` shows only the subject unless `--full`.
- `--timeout-ms` defaults to 600000 and is capped at 1800000 (30 minutes); a longer value is cut
  to the cap.
- The coordinator consumes its Run's inbox with `check`, processes every row of the batch and acks
  it; `check --peek` reads without consuming.
- To cancel a Task: settle its worker with `worker-stop` or `worker-abandon`, then `task-update
  --status failed --result cancelled`. A cancelled Task is `failed`, so its dependants stay blocked.
- `gate-create` on a Task with a live Dispatch completes that Dispatch and revokes its capability
  (open issue stablyai/orca#13298), so a gate goes only on a Task with no live attempt.
- After an unknown result, a mutation is retried with the `--retry-request <uuid>` Orca reported,
  and `request-show` tells whether it took effect.
- Automations always launch an agent (`--prompt` and `--provider` are required), so a scheduled
  tick would be a script, not an automation.
- "Absence never authorizes stop, abandon, retry, or release": only proven exit or a finished
  transcript with no `worker_done` allows acting on a silent worker.

Unverified: everything tracked as an open `kind: unknown` in the frontmatter, each with its
fallback where one exists.

Ask before writing outside this repo.
