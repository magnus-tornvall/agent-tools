# Symphony-style design on Orca orchestration primitives (Orca task DAG as the only task state)

Research basis: local Orca CLI **1.4.221** (`orca --version`), read-only. Sources cited as `cli:` are the exact command whose output was read (no runs, tasks, workers, gates or automations were created). Guide text comes from `orca skills get orchestration` (the compact guide) and `orca skills get orchestration --reference references/<file>.md`. Local design: `/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md` (its "Known Orca behaviour" section was smoke-tested on 1.4.220). Symphony side: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md) and [README](https://github.com/openai/symphony), read through WebFetch summaries (paraphrase risk noted where it matters).

### Capability map at a glance

| Symphony component / behaviour | Orca primitive(s) | Missing / glue needed | Orca guidance that constrains it |
|---|---|---|---|
| Issue tracker (state store) | Run (namespace + inbox), Task (`task-create --spec --task-title --deps --parent`), statuses `pending, ready, dispatched, completed, failed, blocked` | No priority, labels, assignee, comments, free-form fields; `--result` text only | "A Run is a durable namespace and coordinator inbox; it does not schedule or place workers." |
| Dependencies / `blocked_by` | `--deps <json_array>` on `task-create` / `worker-start`; `task-not-startable` refusal with `data.unmetDependencies` | none for the basics | "Use dependencies only for real ordering and prefer parallel waves over chains deeper than three or four steps" |
| Candidate fetch / eligibility | `task-list --ready [--brief] --json` | Sorting (priority, age) and concurrency caps are glue | `--ready` is described as "external memory" for the coordinator |
| Claim (no duplicate dispatch) | Dispatch = "one authoritative Task attempt"; `worker-start` refuses a non-`ready` Task (`task_not_startable`) | none | Lifecycle authority comes only from the active Dispatch |
| Polling orchestrator loop | Either an LLM coordinator (`check --wait`) or a script calling the same verbs; `orca automations` with `--trigger` cron/RRULE and `--precheck` | Automations always launch an *agent* (`--prompt --provider`), not a script; a pure-script dispatcher is glue run outside Orca (cron/launchd) | Only one terminal may consume a Run's inbox (`consumer_fenced`) |
| Workspace manager (per-issue workspace, hooks) | `worker-start --worktree new-top-level/new-child --name --base-branch --setup run`, repo setup hooks | No `before_run`/`after_run`/`before_remove` hooks; worktree removal after merge is manual | "Create a worktree only when the user requested one or a concrete checkout or filesystem conflict makes sharing unsafe." |
| Agent runner (prompt = ticket + template) | `worker-start --task`, injected preamble with Task + Dispatch IDs, `--agent --model --effort` | Prompt templating (WORKFLOW.md body rendered per issue) is glue; Orca injects the Task spec verbatim | Task-spec contract (Target, Change, Constraints, Ownership, Observable acceptance) |
| Agent writes outcome / handoff state | `send --type worker_done --outcome succeeded|failed --files-modified --report-path`; auto-settles Task | No "Human Review" state distinct from `completed`; PR link has no field | "do not follow it with `task-update --status completed`" |
| Retries + backoff | `worker-start --task --retry-of <dispatch_id>`; circuit-breaker after 3 failures | No backoff timer; no auto-retry | "Retry only a positively proven failed or stopped attempt." |
| Stall detection | `worker-list` `projection.liveness` (`live/unverifiable/exited`), heartbeats, `worker-read` | No inactivity timeout that kills and retries | "Absence never authorizes stop, abandon, retry, or release" |
| Reconciliation (ticket moved → stop worker) | `send --to dispatch:<id>` (worker reads at checkpoints), `worker-stop`, `worker-abandon`, `task-update --status failed --result cancelled` | No push interrupt; worker sees a cancel only when it `check`s | Worker must `check` "at each natural checkpoint … and once more immediately before `worker_done`" |
| Cleanup | `worker-release` (closes terminal, archives output, keeps worktree + branch) | Worktree/branch removal after merge | "Release is post-settlement cleanup, not cancellation." |
| Restart recovery | Durable Run/Task/Dispatch/message state; `request-show`, `--retry-request` | none (better than Symphony, which keeps no DB) | "Only positive proof of exit authorizes stop, abandon, or retry" |
| WORKFLOW.md (repo policy, hot reload) | Nothing native; candidates: Task spec text, repo file named in the spec, `worker-start` flags, automation `--prompt` | A loader that reads WORKFLOW.md and maps it to spec text + flags | Task specs must be "self-contained" |
| Status surface | `worker-list`, `task-list`, `gate-list`, `inbox`, `run-list/run-show`, Orca UI | none required | — |

---

## Can Orca tasks act as Symphony's tracker (states, DAG, readiness, ready query, specs, outcomes / proof of work)?

### Takeaway
Yes for the core: Tasks have a fixed status set, JSON dependency arrays, a parent link, a `--ready` query, a free-text spec, and an outcome recorded by the worker's `worker_done` (outcome, summary, modified files, report path). What is missing compared to a tracker is metadata (priority, labels, assignee, comments, PR link) and a review/handoff state distinct from `completed`.

### Cited Findings
- `task-create` usage: `--spec <text> [--task-title <text>] [--display-name <text>] [--deps <json_array>] [--parent <task_id>] [--run <run_id>] [--from <handle>] [--retry-request <id>] [--json]` — [cli: orca orchestration task-create --help]
- `task-list` usage: `[--status <status>] [--ready] [--brief] [--run <run_id>] [--from <handle>] [--json]`; "--brief collapses whitespace and caps each spec at 160 characters." — [cli: orca orchestration task-list --help]
- `task-update --id <task_id> --status <status> [--result <text>]`; "Valid --status values: pending, ready, dispatched, completed, failed, blocked." and "To cancel a Task, stop or abandon its worker, then set --status failed --result cancelled; a later worker-start --retry-of reopens it." — [cli: orca orchestration task-update --help]
- The guide's ready-wave pattern: create dependent work with `task-create --spec "<dependent work>" --deps <json_array>` then "use the ready view as external memory" via `task-list --ready --brief --json` — [cli: orca skills get orchestration --reference references/coordinator-loop.md]
- Readiness is enforced: `worker-start` refuses with `task_not_startable` — "Task cannot start now: not `ready`, or invalid `--retry-of` (`data.status`, `data.unmetDependencies`, `data.retryOf`)" — [cli: references/recovery-and-cleanup.md]
- A cancelled Task "is `failed`, so its dependents stay blocked until a `--retry-of` replacement completes it" — [cli: references/recovery-and-cleanup.md]
- Proof of work channel: `worker_done` with "a three-sentence executive summary, both lifecycle IDs, and explicit `--outcome succeeded` or `--outcome failed`. Never encode failure only in prose." and "Append `--files-modified` and `--report-path` only with real values" — [cli: orca skills get orchestration]
- "A valid `worker_done` settles the Task and Dispatch automatically; do not follow it with `task-update --status completed`." — [cli: orca skills get orchestration]
- `send --type` values: `status, dispatch, worker_done, merge_ready, escalation, handoff, decision_gate, question, heartbeat` — [cli: orca orchestration send --help]. (`merge_ready` exists as a type; no guide text explains its semantics.)
- Smoke-tested: "its `worker_done` stays in the Run's mailbox until read. The payload carries `taskId`, `dispatchId` and `outcome`." — [local spec, Known Orca behaviour](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)
- Every Task spec must name Target, Change, Constraints, Ownership, Observable acceptance — [cli: orca skills get orchestration, "Task-spec contract"]
- Symphony's issue model requires `id`, `identifier`, `title`, `state`, `dispatchable`; optional `priority, labels, blocked_by, assignee_id, branch_name, url`, timestamps — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Symphony: "A successful run can end at a workflow-defined handoff state (for example Human Review), not necessarily Done." — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Symphony README: agents "provide proof of work: CI status, PR review feedback, complexity analysis, and walkthrough videos" and "When accepted, the agents land the PR safely." — [Symphony README](https://github.com/openai/symphony)

### Inferences
- Symphony's tracker states map to Orca like this: Todo → `ready` (deps met) or `pending` (deps unmet); In Progress → `dispatched`; Human Review → `completed` + a successful `worker_done` whose `--report-path` points at the proof-of-work file and whose body names the branch/PR; Rework → a new Task (or `--retry-of` after a `failed` settlement); Done → reviewer's own record (nothing in Orca); Cancelled → `failed` + `--result cancelled`.
- Because `completed` doubles as "awaiting human review", "accepted by human" needs a place to live. Smallest glue: a follow-up Task per item ("land/merge S1", deps on the impl Task) that only the owner completes, or a convention in `--result`. A separate store would break the "Orca is the only task state" constraint.
- Priority ordering is not native; encode it in `--task-title` (e.g. `P1 S3 …`) and sort in the dispatcher, or by DAG shape.
- Orca enforces dependencies more strongly than Symphony does: per the SPEC summary, `blocked_by` is "Best-effort provider metadata" and readiness is adapter-derived `dispatchable`. (WebFetch summary; the Elixir reference implementation is commonly described as skipping Todo issues with non-terminal blockers — not verified here.)

### Gaps
- Whether `task-list --ready` excludes Tasks with an open gate was not tested (gate-create says "Create a decision gate blocking a task", but the effect on the `ready` status was not observed). The earlier spec draft listed this as an open question.
- Whether `--result` text is shown in `task-list --json`, and its size limit — not checked (would need a Task).
- What `--parent` does beyond grouping (does a parent wait for its children?) is not documented in help or guide.
- No guide text explains `merge_ready` or `handoff` message types.

---

## Can dispatch be done by a deterministic loop (automations with schedule/precheck, or a script) instead of an LLM coordinator? Who must be the coordinator?

### Takeaway
Mostly. Every dispatch verb (`task-list --ready`, `worker-start --task`, `check`, `worker-release`, `worker-list`) is a plain CLI call with `--json`, so a script can do it. But Orca automations always launch an agent session (`--prompt --provider`), so an automation-hosted "tick" is an LLM tick gated by a deterministic `--precheck`. The real constraint is the Run inbox: only one consumer may `check` it (`run-use` fences the previous one). Whatever loop consumes `worker_done`s owns the Run.

### Cited Findings
- `automations create --name <name> --trigger <preset|cron|rrule> --prompt <text> --provider <agent> [--precheck <command>] [--repo …|--workspace …|--project <id> [--host <id>]|…]`, plus `--precheck-timeout`, `--workspace-mode <existing|new-per-run>`, `--reuse-session`, `--fresh-session`, `--missed-run-grace-minutes`, `--timezone` — [cli: orca automations create --help]
- "Use --precheck to run a bounded command before scheduled runs; exit code 0 continues, anything else records a skipped run." and "Use --reuse-session only with existing-workspace automations to submit later runs to the previous live automation session when it is still available." — [cli: orca automations create --help]
- Example in help: `--trigger hourly --precheck "gh pr list --json number -q .[0].number" --prompt "Review requested PRs" --provider codex` — [cli: orca automations create --help]
- Smoke-tested: "An automation with `--precheck` that fails records `skipped_precheck`, dispatches nothing, and keeps its schedule. A manual `automations run` skips the precheck." — [local spec, Known Orca behaviour](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)
- "`run-use` fences the previous consumer: only one terminal at a time may read a Run's inbox; any other terminal's `check`, even `--peek`, fails with `consumer_fenced`." — [local spec, Known Orca behaviour](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)
- `run-use --id <run_id> [--from <handle>] [--takeover-legacy]` binds "this coordinator to an existing Run" — [cli: orca orchestration run-use --help]
- `run-create`: "A Run is a namespace and home inbox. It never schedules or places workers." — [cli: orca orchestration run-create --help]
- "A consuming `check` names its caller with `--terminal <handle>`, never `--from`; omit it inside the coordinator's own Orca terminal. It returns the bound Run's oldest FIFO Delivery and replays that batch until acknowledged." — [cli: orca skills get orchestration]
- `check` flags: `[--terminal <handle>] [--run <run_id>] [--ack <delivery_id>] [--unread | --peek | --all] [--types …] [--wait] [--timeout-ms <n>]`; `--wait` "Emits JSON keepalive lines to stderr every 15s" — [cli: orca orchestration check --help]
- Role table: the coordinator role applies when "The user explicitly asks to supervise, monitor, wait for results, track completion, coordinate a DAG, use a decision gate, or manage ask/reply" — [cli: orca skills get orchestration]
- Coordinator completion bar: "every in-scope Task has one explicit outcome and every settled worker terminal has a next owner or cleanup decision" and "do not end the coordinator turn until [`worker-list --run <run_id> --terminal-state reclaimable --json`] returns none" — [cli: orca skills get orchestration]
- After three empty waits, enumerate with `worker-list --include-remote --json` and act on "literal `projection.nextAction` argv" — [cli: orca skills get orchestration]
- The retired commands: `coordinator-start` / `coordinator-stop` are "Retired: load the current orchestration skill"; "Retired scheduler commands are not aliases for Run creation." — [cli: orca orchestration --help; orca skills get orchestration]
- Symphony's tick: reconcile active runs → validate config → fetch candidates → sort by priority then creation time → dispatch while slots remain; `polling.interval_ms` default 30s; `max_concurrent_agents` default 10 plus per-state overrides — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- The local spec lists "A scheduled tick instead of a live coordinator" as Deferred, with a live coordinator over hours as the open question — [local spec](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)

### Inferences
- Deterministic dispatcher sketch (pure CLI, idempotent per tick): `task-list --ready --json` → filter out Tasks with a live Dispatch / cap by `worker-list --run <id> --terminal-state active` count → `worker-start --task <id> --worktree new-top-level --name <slug> --base-branch main --agent claude --json` for each free slot → `check --json` (non-blocking), process each `worker_done` (run `worker-release`), `--ack` → `worker-list --run <id> --terminal-state reclaimable` → release. Each mutation passes `--retry-request <stable id>` so a crashed tick replays instead of duplicating.
- Hosting: an Orca automation can only host this as an *agent* prompt ("run the dispatch script, report anomalies"), with `--precheck` doing the cheap deterministic test ("any ready Task or unread Run mail?"). For zero LLM in the loop, run the script from OS cron/launchd — glue outside Orca. Both keep Orca as the only state, because the script holds nothing between ticks.
- Consumer identity is the unresolved risk for a script: the guide says `check` needs `--terminal <handle>` outside an Orca terminal, and fencing ties inbox consumption to whoever last ran `run-use`. A cron script with no Orca terminal may lack a handle. Each tick re-running `run-use` would steal the inbox from a human or agent coordinator. Needs a smoke test.
- The guide's coordinator rules (process every message before ack, never release without accepted settlement, absence never authorizes action) are rules a script can follow mechanically. They are not LLM judgement, and a script follows them more reliably than an LLM does.

### Gaps
- Not verified: whether `check` / `run-use` work from a process that is not an Orca terminal (cron), and what handle it would use. `orca status --json` "shows your Orca session ID as `caller.orcaSessionId` when you have one" implies not every caller has one.
- Not verified: whether an automation's agent session can bind to an existing Run (`run-use`) on each tick without colliding with `--reuse-session` state.
- No Orca-native concurrency limit was found; `max_concurrent_agents` is glue.

---

## Can a worker create follow-up tasks or child Runs itself (agent-owned decomposition)? Can a worker coordinate a child Run?

### Takeaway
Yes, within a nesting depth limit: the guide and `send --help` describe workers that "created [their] own Run" and "coordinat[e] a child Run", with group mail routed to their `run:<id>` mailbox. A worker adding sibling Tasks to its *parent* Run is not documented: `task-create` takes `--run` and `--from`, but the guide does not cover it, and the worker contract says "Do only the current Task".

### Cited Findings
- "nested workers obey the depth limit, and a new Run does not reset the caller's depth." — [cli: orca skills get orchestration]
- "A nested worker must respect `nested_worker_depth_exceeded`; creating another Run does not reset depth." — [cli: references/coordinator-loop.md]
- "Mail goes to each `dispatch:<id>` mailbox, except a worker coordinating a child Run receives it in that `run:<id>` mailbox." and "A worker that created its own Run addresses that Run's workers, not its siblings." — [cli: references/messaging-and-gates.md]
- "Nested coordinators receive group mail in their child Run mailbox" — [cli: orca orchestration send --help]
- Worker obligation 1: "Do only the current Task" — [cli: orca skills get orchestration]
- `dispatch --inject` must never be used "to route around the nested-depth limit" — [cli: references/low-level-topology.md]
- After three failures "Do not route around that boundary with a new Run or an unrelated Dispatch." — [cli: references/recovery-and-cleanup.md]
- Symphony itself: "Ticket writes (state transitions, comments, PR links) are typically performed by the coding agent", and the orchestrator remains "a scheduler/runner and tracker reader" — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)

### Inferences
- Two decomposition patterns fit Orca:
  1. **Child Run (supported):** the worker becomes coordinator of a child Run (`run-create`, `task-create … --deps`, `worker-start`) and only sends its own `worker_done` once the child Run settles. The parent sees one Task; depth is limited.
  2. **Propose follow-ups to the parent's dispatcher:** the worker lists follow-up specs in its `--report-path` file (or a `status` message), and the parent loop runs `task-create --deps` for them. This keeps the "only the coordinator mutates the DAG" model. The direct alternative is the worker calling `task-create --run <parent_run>`, which is undocumented and against the "Do only the current Task" obligation.
- Symphony gives the agent tracker write access by design (state transitions, comments). Orca's model instead restricts the worker to its own lifecycle messages. To mirror Symphony faithfully, follow-up ticket creation becomes coordinator/dispatcher glue.

### Gaps
- Not verified: whether `task-create --run <parent_run>` from a dispatched worker's terminal is accepted, refused, or fenced.
- The numeric value of the nested depth limit is not documented in help or guide.

---

## How does a worker ask the owner a question and block, and how can the owner answer without being the Run's fenced consumer? What do gates do exactly?

### Takeaway
The worker blocks with `ask` (durable, survives a timeout, resumed by message ID), addressed by default to its Run mailbox. Anyone answers with `reply --id <msg_id> --body`. `reply` has no fencing note (only `check` is fenced), but the owner must learn the message ID, and per the smoke test listing the Run inbox via `check`, even `--peek`, is fenced. Gates are a separate thing: a coordinator-owned decision record that blocks one Task in the DAG. The guide says gates must not be used as the answer channel for an `ask`.

### Cited Findings
- `ask (--question <text> | --resume <message_id>) [--to <run:id>] [--run <run_id>] [--options <csv>] [--timeout-ms <n>] [--from <handle>]`; "From an active Dispatch, a new question defaults to its owning Run mailbox." and "Timeout leaves the question pending; resume with the original message ID." — [cli: orca orchestration ask --help]
- "Use Orca `ask` whenever the coordinator must answer. Never open a local question TUI the coordinator cannot answer." and "Skip [heartbeats] while blocked inside `ask` or `check --wait`; those calls are liveness signals." — [cli: references/worker-contract.md]
- `reply --id <msg_id> --body <text> [--run <run_id>] [--from <handle>]` — [cli: orca orchestration reply --help]
- "A worker uses `ask`; its timeout leaves one durable question pending, which the worker resumes by message ID. The coordinator answers that message with `reply`." — [cli: references/messaging-and-gates.md]
- "Use a gate only for a coordinator-owned Task-DAG decision" with `gate-create --task <task_id> --question "<decision>" --options <json_array>`, `gate-resolve --id <gate_id> --resolution "<choice>"`, `gate-list --task <task_id>`; then: "Do not create a gate merely to answer a worker's `ask`." — [cli: references/messaging-and-gates.md]
- `gate-create`: "Create a decision gate blocking a task"; `gate-list [--task <task_id>] [--status <status>] [--run <run_id>]` — "--run inspects a named Run without binding; otherwise gates are scoped to the caller." — [cli: orca orchestration gate-create/gate-list --help]
- `inbox [--limit <n>] [--terminal <handle>] [--full]`: "Show messages across (or for) recipients" — [cli: orca orchestration inbox --help]
- "`check` names its caller with `--terminal <handle>` and is the only verb that rejects `--from`" and "`--peek` and `--all` are read-only inspection, not progress through the coordinator inbox." — [cli: references/messaging-and-gates.md]
- Smoke-tested: `check`, even `--peek`, from a non-consumer fails with `consumer_fenced`; "`gate-resolve --resolution` takes free text; `gate-create --options` is optional."; "`ask` timing out leaves the question pending; the worker resumes it by message ID." — [local spec, Known Orca behaviour](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)
- Run group addresses "exclude [the] owning coordinator; send to run:<id> to raise something with yours." — [cli: orca orchestration send --help]
- Open questions in the earlier spec draft: (ask across hours-long wait), (gate-list/gate-resolve from owner terminal while coordinator holds the Run), (how the coordinator learns a gate resolved), (gate-on-ask vs guidance), (enumerate open gates across Runs) — [local spec](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)

### Inferences
- Answering without being the consumer: the likely-valid path is `gate-list --run <id>` (explicitly "without binding") plus `gate-resolve` for DAG decisions, and `inbox` (not `check`) to find a pending question's message ID, then `reply --id`. Neither `inbox` nor `reply` is documented as fenced, but neither has been smoke-tested against a fenced Run.
- A guide-compliant reading of "gate on ask": the gate parks *other* Tasks whose work depends on the decision (a DAG decision), while the `ask` is answered by `reply`. One owner ruling then produces two writes: `gate-resolve` (unparks dependents) and `reply` (unblocks the asking worker). Creating a gate on the asking worker's own Task purely to queue the question is the pattern the guide forbids. This matches the earlier spec draft's framing ("the gate is shown to be the parking mechanism for the dependent Tasks (not the answer channel)").
- Symphony has no blocking-question channel; its agents run unattended to a handoff state. Ask/reply/gates are therefore Orca extras that a Symphony-style design can use for one-way-door decisions.

### Gaps
- Whether `inbox` and `reply` work from a terminal that is not the Run's consumer: untested.
- Whether `gate-resolve` posts a message to the Run mailbox (so a dispatcher's `check --wait` wakes) or must be polled via `gate-list`: undocumented.
- Whether a gate changes the gated Task's status to `blocked`, and whether it affects `--ready`: undocumented.
- How long `ask` can block (hours?) before the agent's own session times out: untested.

---

## Retries, stall detection, heartbeats, crashed-worker recovery, worker-release and worktree cleanup

### Takeaway
Orca supplies explicit retry (`--retry-of`, 3-failure circuit breaker), layered liveness (`worker-list` fleet verdict + heartbeats + transcript reads), idempotent mutation recovery (`--retry-request`, `request-show`) and safe terminal cleanup (`worker-release`). Its policy is the opposite of Symphony's on stalls: Orca forbids acting on absence of signal, while Symphony kills and retries after `stall_timeout_ms`. Automatic backoff, inactivity timeouts and worktree removal are glue.

### Cited Findings
- Retry: `worker-start --task <task_id> --retry-of <dispatch_id> --worktree <explicit_placement> --agent <agent>`; "Placement is never silently inherited"; "After three consecutive failures for one Task, its dispatch context circuit-breaks and the Task is failed." — [cli: references/recovery-and-cleanup.md]
- State → action table: `failed`/`stopped` → "Start a replacement with `--retry-of`"; `outcome_unknown` → "Inspect, then choose `worker-stop` or explicit `worker-abandon`"; `unverifiable` → "Keep waiting or inspect; never stop, abandon, retry, or release" — [cli: references/recovery-and-cleanup.md]
- "Leave the wait only on positive proof the agent stopped: `exited` liveness, the worker's own observation of process exit, or a transcript whose final agent turn sent no `worker_done`." — [cli: orca skills get orchestration]
- "Liveness is layered: `worker-list`'s `projection.liveness` is the fleet verdict for the agent; `worker-show`'s `observation.status` is PTY liveness only. A live terminal can still hold a dead or stuck agent." — [cli: orca skills get orchestration]
- Heartbeat: `send --from <worker_handle> --type heartbeat --subject "alive" --task-id … --dispatch-id … --phase "<investigating|implementing|reviewing|waiting>"`; "A heartbeat proves liveness, never completion." Cadence comes from the preamble — [cli: references/worker-contract.md]
- Lost mutation responses: "Every orchestration mutation accepts `--retry-request <id>`"; `request-show --request <id>` returns `completed` / `pending` / `absent`, and "`absent` … is not proof nothing happened" — [cli: references/recovery-and-cleanup.md]
- `worker-stop` "closes only the exact proven supervised agent terminal. It never deletes the worktree"; `worker-abandon` "fences orchestration while accepting that resources may remain live" — [cli: references/recovery-and-cleanup.md]
- `worker-release`: "Post-completion cleanup for a settled (succeeded or failed) worker"; "An inspectable output archive is preserved before the terminal closes"; "Idempotent" — [cli: orca orchestration worker-release --help]. "Never release because of timeout, TUI idle, heartbeat, status, question, escalation, or stale/rejected completion." — [cli: references/recovery-and-cleanup.md]
- `worker-list --terminal-state <active|reclaimable|retained|release_pending|release_unknown|released>`; "Terminal state is process accounting and is reported separately from Task status; a completed Task can still own a live terminal." — [cli: orca orchestration worker-list --help]
- Smoke-tested: "`worker-release` closes the terminal and keeps the worktree and branch; remove them after merge or abandonment."; "A worker keeps running after the session that started it closes" — [local spec, Known Orca behaviour](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)
- "`orchestration reset` is destructive recovery." (`reset (--all | --tasks | --messages)`) — [cli: references/recovery-and-cleanup.md; orca orchestration reset --help]
- Symphony: continuation after clean exit 1000 ms; failure retries `delay = min(10000 * 2^(attempt-1), agent.max_retry_backoff_ms)` (default max 300 s); stall: "If `elapsed_ms > codex.stall_timeout_ms`" (default 300 s) terminate and retry; terminal-state issues → stop worker and clean workspace; restart recovery "without requiring a persistent database" — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Symphony hooks: `after_create`, `before_run`, `after_run`, `before_remove`, `hooks.timeout_ms` default 60 s; "Workspaces are reused across runs for the same issue. Successful runs do not auto-delete workspaces." — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)

### Inferences
- Retry policy glue: the dispatcher retries only on a settled `worker_done --outcome failed` or a proven `exited`, using `--retry-of`. Orca has no field for a backoff timer, so a stateless dispatcher has nowhere durable to keep one. The simplest Orca-only encoding is "no timer": retry at the next tick (the tick interval is the backoff), and let the 3-failure breaker cap attempts.
- Stall detection: the guide's "absence never authorizes" rule conflicts with Symphony's timeout-kill. The guide-compliant substitute: on a stale heartbeat, read `worker-read --source auto` and act only on positive evidence (final agent turn without `worker_done` → `worker-stop` → `--retry-of`). A hung-but-alive agent stays a human escalation.
- Worktree cleanup (Symphony's `before_remove` + terminal-state cleanup) is glue: after the owner merges, `git worktree remove` / branch delete, or Orca's own worktree verbs (via `orca-cli`, not examined here).
- Orca's durable state makes restart recovery stronger than Symphony's (which restores no scheduler state). A restarted dispatcher just re-reads `task-list` and `worker-list`.

### Gaps
- Heartbeat cadence and whether Orca itself turns a missed heartbeat into a liveness verdict: the cadence is "in the preamble", which was not inspected (`dispatch-show --task <id> --preamble` needs an existing Task).
- No Orca setting for per-attempt wall-clock or turn limits (Symphony `max_turns`) was found.
- Orca worktree removal commands were not examined (outside the orchestration surface).

---

## Where would the WORKFLOW.md-equivalent policy live?

### Takeaway
Orca has no repo-owned workflow file. Policy splits across three places: (1) the Task spec text (per-ticket prompt; the guide requires it to be self-contained); (2) `worker-start` flags (placement, agent, model, effort, setup policy), which take over Symphony's front-matter `workspace`/`codex`/`agent` keys; (3) repo setup hooks, used via `--setup run`. A small loader that reads a repo `WORKFLOW.md` and renders spec text plus flags is the glue.

### Cited Findings
- Task-spec contract: "Every Task spec must be self-contained and name: Target … Change … Constraints … Ownership … Observable acceptance" — [cli: orca skills get orchestration]
- "The injected preamble is authoritative." Workers use the exact executable, handle and IDs in it — [cli: references/worker-contract.md]
- `worker-start` flags: `--worktree <current|selector|new-child|new-top-level>`, `--name`, `--repo`, `--base-branch`, `--setup <run|skip|inherit>`, `--agent`, `--model`, `--effort`, `--timeout-ms`, `--on <saved-environment>`; "New worktrees use agent-first creation and default --setup to run. Repository start-immediately runs setup beside the agent; wait-for-setup gates agent readiness and task input." — [cli: orca orchestration worker-start --help]
- "How the worker runs follows the user's own setting for new agent tabs; there is no flag for it" — [cli: orca orchestration worker-start --help]
- `--model`/`--effort`: "Pass it only when the user named a model; otherwise omit it so the worker inherits the user's configured agent default." — [cli: references/coordinator-loop.md]
- Symphony: WORKFLOW.md front matter keys `tracker, polling, workspace, hooks, agent, codex`; body is a strict prompt template with `issue` and `attempt` variables; "The workflow file is expected to be repository-owned and version-controlled."; "The software MUST detect WORKFLOW.md changes … without restart." — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Local design already does this split: each Task spec carries "the absolute paths of the shape file and the rulings file. Both are authoritative; the spec is a view of them", plus a "Worker addendum" appended to each spec — [local spec](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)

### Inferences
- Mapping: `tracker.*` → the Run id and `task-list --ready`; `polling.interval_ms` → automation `--trigger` (cron granularity is one minute) or the OS cron; `workspace.root` → `--worktree new-top-level --base-branch`; `hooks.after_create` → repo setup hooks (`--setup run`); `before_run`/`after_run`/`before_remove` → no equivalent (glue in the dispatcher or in the worker addendum); `agent.max_concurrent_agents` → dispatcher glue; `codex.command`/sandbox → `--agent`/`--model`/`--effort` + user agent settings; prompt body → rendered into `--spec` at `task-create` time.
- Hot reload: if the dispatcher renders the template at dispatch time (not at `task-create`), editing WORKFLOW.md changes future attempts. But the spec is stored on the Task, so the render must happen before `task-create`. A practical compromise: Task spec = ticket-specific content + "Read and follow `<repo>/WORKFLOW.md`" (policy by reference, always current), keeping the self-contained requirement for the ticket's own Target/Change/Acceptance.

### Gaps
- Whether `worker-start` can inject extra prompt text beyond the Task spec (no such flag found).

---

## Gaps: what Symphony does that Orca lacks, and the smallest glue for each

### Takeaway
The missing pieces are all on the scheduler/policy side: a non-LLM loop host with a concurrency cap and backoff, priority ordering, hot-reloaded repo policy, stall-timeout kill, extra lifecycle hooks, a review/landing state, and worktree removal. Each can be met by a stateless dispatcher script over Orca's `--json` verbs plus conventions in the spec and report. Orca is stronger than Symphony on durable state, explicit DAG readiness, blocking questions, gates, and idempotent mutation recovery.

### Cited Findings
- Symphony components: Workflow Loader, Config Layer, Issue Tracker Adapter, Orchestrator, Workspace Manager, Agent Runner, Status Surface, Logging; claim states Unclaimed/Claimed/Running/RetryQueued/Released — [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Orca guide: "Orchestration is Orca's structured coordination layer. It records who owns work, which attempt is authoritative, and when supervised work has settled." — [cli: orca skills get orchestration]
- `worker-start` "exits 0 only for ready. Failed or outcome_unknown exits 1 and JSON includes stage/failedStage, setup, effects, residualResources, and recovery commands" — [cli: orca orchestration worker-start --help]
- Local constraints: "Orca is the only task state. No second tracker."; "Agents never push." — [local spec](/Users/magnustornvall/dev/me/ai/agent-tools/docs/specs/orca-orchestration.md)

### Inferences
| Symphony capability | Orca status | Smallest glue |
|---|---|---|
| Deterministic poll loop | Verbs exist; automations host only agents | Stateless `dispatch-tick` script (cron/launchd) or an automation whose `--precheck` is `task-list --ready` non-empty |
| `max_concurrent_agents` | None | Tick counts `worker-list --terminal-state active` before starting |
| Priority sort | None | Title prefix convention, sorted by the tick |
| Exponential backoff | `--retry-of` + 3-failure breaker | Retry on the next tick; breaker caps attempts |
| Stall timeout kill | Forbidden on absence | Escalate on stale heartbeat; stop only on positive evidence |
| WORKFLOW.md + hot reload | None | Spec references repo `WORKFLOW.md`; loader renders front matter into `worker-start` flags |
| `before_run` / `after_run` / `before_remove` hooks | Only setup hooks (`--setup`) | Worker addendum steps (before/after) + post-merge cleanup script |
| Human Review / Rework / Done states | `completed`/`failed` only | Owner-only "land" Task depending on each impl Task; Rework = new Task or `--retry-of` |
| Agent writes tracker (comments, PR links) | Worker writes only its own lifecycle (`worker_done`, `--report-path`) | Proof-of-work file at `--report-path`; dispatcher creates follow-up Tasks from it |
| Workspace removal | `worker-release` keeps worktree + branch | Post-merge cleanup step (owner or script) |
| Reconciliation (ticket state change stops agent) | `send --to dispatch:<id>` read at checkpoints; `worker-stop` | Cancellation = `worker-stop` + `task-update --status failed --result cancelled` |

### Gaps
- Unverified behaviours that decide whether a pure-script dispatcher is viable: consuming `check` without an Orca terminal; `run-use` contention between a script and a human; `inbox`/`reply`/`gate-resolve` from a non-consumer; gate effect on `--ready`; worker-side `task-create` into the parent Run. All are read-only-unknown here and need smoke tests (several were open questions in the earlier spec draft).
- The Symphony SPEC was read through a summarizing fetch (first 100k of 108k characters). Exact wording of blocker eligibility rules was not confirmed verbatim.
