# OpenAI Symphony: Design, Rationale, and Reception

Source versions read (as of 2026-10-07):
- `openai/symphony` at commit `be10a1b` (2026-09-15). The latest release is **0.0.3**, tagged 2026-09-15. SPEC.md header: "Status: Draft v1 (language-agnostic)". SPEC.md was last changed in `8001b52` on 2026-08-12. The first commit is `fa75ec6` (2026-03-04). The original 2026-03-04 SPEC was diffed against the current one where the two differ materially.
- SPEC history worth knowing: 2026-03-04 initial (Linear-only); 2026-03-11 SSH workers; 2026-04-27 "Clarify Symphony service specification (#61)"; 2026-05-20 "Surface input-blocked Symphony sessions (#66)"; 2026-06-04 "Require opt-in labels for dispatch (#88)"; 2026-07-17 "Add generic tracker interface with Linear adapter (#102)"; 2026-07-20 GitHub Issues, Jira Cloud, Asana and GitLab adapters added to the Elixir implementation.
- OpenAI blog post "An open-source spec for Codex orchestration: Symphony" by Alex Kotliarskyi, Victor Zhu and Zach Brock, 2026-04-27. openai.com returned 403 to direct fetches, so I read it through the r.jina.ai reader proxy. Quotes from it are marked [Blog].
- URLs: SPEC https://github.com/openai/symphony/blob/main/SPEC.md · README https://github.com/openai/symphony · Elixir README https://github.com/openai/symphony/blob/main/elixir/README.md · WORKFLOW.md https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md · Blog https://openai.com/index/open-source-codex-orchestration-symphony/

## Components, orchestrator nature, and state machines

### Takeaway
Symphony is a **deterministic, non-LLM daemon**. It polls a tracker, claims eligible issues, creates one workspace per issue, and drives one Codex app-server session per issue. All judgment (what to do, when to hand off, how to move the ticket) lives in the `WORKFLOW.md` prompt and is carried out by the agent through tracker tools. There are two separate state machines. The first is a small **internal claim state machine**, which is in memory only. The second is the **tracker's own status workflow**, which is defined by policy and moved by the agent or by humans.

### Cited Findings
- Problem statement: "Symphony is a long-running automation service that continuously reads work from a configured issue tracker, creates an isolated workspace for each issue, and runs a coding agent session for that issue inside the workspace." — [SPEC §1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Boundary: "Symphony is a scheduler/runner and tracker reader. Ticket writes (state transitions, comments, PR links) are typically performed by the coding agent through provider-native tools executed by Symphony with the configured tracker credential." — [SPEC §1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Components (§3.1):
  - Workflow Loader: parses YAML front matter plus the prompt body into `{config, prompt_template}`.
  - Config Layer: typed getters, defaults, `$VAR` indirection, preflight validation.
  - Issue Tracker Adapter.
  - Orchestrator: "Owns the poll tick. Owns the in-memory runtime state. Decides which issues to dispatch, retry, stop, or release."
  - Workspace Manager.
  - Agent Runner: creates the workspace, builds the prompt, launches the app-server, streams events.
  - Status Surface (OPTIONAL).
  - Logging.
  - Source: [SPEC §3.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Layering (§3.2): Policy (`WORKFLOW.md` prompt body: "Team-specific rules for ticket handling, validation, and handoff") / Configuration / Coordination (orchestrator) / Execution (workspace + agent subprocess) / Integration (tracker adapter) / Observability. — [SPEC §3.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- The orchestrator is the single mutator: "The orchestrator is the only component that mutates scheduling state. All worker outcomes are reported back to it and converted into explicit state transitions." Goal: "Maintain a single authoritative orchestrator state for dispatch, retries, and reconciliation." — [SPEC §7, §2.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- **Internal claim states** (§7.1): `Unclaimed`, `Claimed` ("In practice, claimed issues are either `Running` or `RetryQueued`"), `Running`, `RetryQueued`, and `Released` ("Claim removed because issue is terminal, non-active, missing, or retry path completed without re-dispatch"). The SPEC states explicitly: "This is not the same as tracker states (`Todo`, `In Progress`, etc.)." — [SPEC §7.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- **Run attempt phases** (§7.2): `PreparingWorkspace → BuildingPrompt → LaunchingAgentProcess → InitializingSession → StreamingTurn → Finishing →` one of `Succeeded | Failed | TimedOut | Stalled | CanceledByReconciliation`. "Distinct terminal reasons are important because retry logic and logs differ." — [SPEC §7.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Transition triggers (§7.3): Poll Tick, Worker Exit (normal), Worker Exit (abnormal), Codex Update Event, Retry Timer Fired, Reconciliation State Refresh, Stall Timeout. — [SPEC §7.3](https://github.com/openai/symphony/blob/main/SPEC.md)
- Tick order (§8.1): (1) reconcile running issues; (2) dispatch preflight validation; (3) fetch candidates in active states; (4) sort by priority; (5) dispatch while slots remain; (6) notify observers. "Reconciliation runs before dispatch on every tick." — [SPEC §8.1, §7.4](https://github.com/openai/symphony/blob/main/SPEC.md)
- Eligibility (§8.2). An issue is eligible only when all of these hold:
  - it has id, identifier, title and state;
  - its state is in `active_states` and not in `terminal_states`;
  - the adapter says `dispatchable == true`;
  - it carries all `required_labels`;
  - it is not already running or claimed;
  - global and per-state slots are free.
  - Sorting: priority 1..4 ascending, then oldest `created_at`, then identifier.
  - Source: [SPEC §8.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Continuation semantics: "A successful worker exit does not mean the issue is done forever." After each normal turn the worker re-checks the tracker. If the issue is still active, it starts another turn on the **same live thread**, up to `agent.max_turns` (default 20). Continuation turns "SHOULD send only continuation guidance... not resend the original task prompt". After a normal exit the orchestrator "still schedules a short continuation retry (about 1 second)". — [SPEC §7.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Agent protocol: the spec targets the Codex app-server ("Coding-agent executable that supports the targeted Codex app-server mode"). The default `codex.command` is `codex app-server`, launched via `bash -lc` in the workspace. "If this specification appears to conflict with the targeted Codex app-server protocol, the Codex protocol controls protocol shape". — [SPEC §3.3, §10](https://github.com/openai/symphony/blob/main/SPEC.md)
- Blog on app-server: "We also got to use Codex in app server mode, a built-in headless mode for Codex... talk to it programmatically via a well documented JSON-RPC API." On the Elixir choice: "a relatively niche language with excellent primitives for orchestrating and supervising concurrent processes." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Blog framing: the tracker board becomes the state machine. Help Net Security reports: "Ticket statuses act as a state machine that drives the orchestrator's behavior" and "Symphony decouples work from sessions and from pull requests". — [Help Net Security](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)
- The reference **tracker-level** workflow is defined in the example WORKFLOW.md prompt, not in code:
  - `Backlog` → out of scope.
  - `Todo` → agent immediately moves it to `In Progress`.
  - `In Progress`.
  - `Human Review` → "PR is attached and validated; waiting on human approval".
  - `Merging` → "approved by human; execute the `land` skill flow".
  - `Rework` → "reviewer requested changes".
  - `Done`.
  - Front matter: `active_states: [Todo, In Progress, Merging, Rework]`, `terminal_states: [Closed, Cancelled, Canceled, Duplicate, Done]`.
  - Source: [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)

### Inferences
- The "intelligence" sits entirely in the policy prompt plus the agent. The orchestrator is a level-triggered reconciler: each tick it compares desired state (tracker says active) with actual state (running or claimed) and closes the gap. It resembles a Kubernetes controller far more than an LLM planner.
- `Human Review` is deliberately **not** an active state in the reference WORKFLOW.md, so moving a ticket there makes reconciliation stop the agent. This is "neither active nor terminal → terminate worker without workspace cleanup" (§8.5), so the workspace is preserved for later `Rework`. The prompt nonetheless tells the agent to "wait and poll" in Human Review. That instruction has no effect, because the orchestrator never dispatches non-active states. This is a small policy/config inconsistency in the example.
- `max_turns` plus the 1 s continuation retry together mean that "done" is defined purely by the tracker state leaving the active set. An agent that never moves the ticket will be re-dispatched indefinitely: the attempt counter increments, but continuations use only the 1 s delay and there is no cap.

### Gaps
- I could not read the Elixir `orchestrator.ex` in depth. I did not verify whether the reference implementation caps total continuation cycles per issue beyond `max_turns` per worker. The SPEC defines no global cap.

## Unit of work, decomposition, roles, follow-ups

### Takeaway
The unit of work is **one tracker issue → one workspace → one agent thread (with continuation turns)**. Symphony has no planner, reviewer or other roles in the orchestrator; there is one objective per ticket. Decomposition and follow-up creation happen *through the tracker*: agents (or humans) file new issues with blocker links, and the scheduler picks them up like any other issue. Dependencies are modelled only as adapter-supplied `blocked_by` metadata gating `dispatchable`, not as a first-class DAG in the scheduler.

### Cited Findings
- The Issue entity is generic: "The name `Issue` is generic in this specification; an adapter MAY map it from a ticket, card, project item, or another provider-native work object." Each workspace belongs to "one issue identifier"; each Run Attempt is "One execution attempt for one issue." — [SPEC §4.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Non-goal: "Built-in business logic for how to edit tickets, PRs, or comments. (That logic lives in the workflow prompt and agent tooling.)" — [SPEC §2.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Decomposition via planning tickets [Blog]: "We might file a task asking the agent to analyze the codebase, Slack, or Notion and produce an implementation plan. Once we're happy with the plan, the agent generates a tree of tasks, breaking the work into stages and defining dependencies between tasks." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- DAG via blockers [Blog]: "we marked the React upgrade as blocked on a migration to Vite. As expected, agents started upgrading React only after the migration to Vite was complete." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Agent-created follow-ups [Blog]: "During implementation or review, they often notice improvements that fall outside the scope of the current task... When that happens, they simply file a new issue that we can evaluate and schedule later." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- The reference policy encodes this rule. Out-of-scope improvements become a separate issue, which:
  - must have "a clear title, description, and acceptance criteria";
  - is "placed in `Backlog`" (outside active states, so a human must promote it);
  - is put in the same project;
  - links the current issue as `related`;
  - "use[s] `blockedBy` when the follow-up depends on the current issue."
  - Source: [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- Roles vs objectives [Blog]: "treating agents as rigid nodes in a state machine doesn't work well. Models get smarter and can solve bigger problems than the box we try to fit them in... We eventually moved toward giving agents *objectives* instead of strict transitions, much like a good manager would assign a goal to a direct report... give them tools and context and let them cook." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Within one ticket, the reference prompt makes a single agent do everything in sequence:
  - planning ("Spend extra effort up front on planning");
  - "principal-style self-review of the plan";
  - reproduction;
  - implementation;
  - validation;
  - the PR feedback sweep;
  - landing.
  - Planning state lives in a single persistent `## Codex Workpad` tracker comment, "the source of truth for progress".
  - Source: [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- **Dependency model in the SPEC (current version)**:
  - `blocked_by` is "Best-effort provider metadata" with `{id, identifier, state}`.
  - `dispatchable` is "REQUIRED adapter-derived eligibility for provider-specific rules that the generic scheduler cannot infer safely, such as assignment, board membership, or blocker semantics."
  - "The orchestrator MUST NOT... branch on provider-specific blocker... semantics."
  - "adapters MUST NOT invent blocker semantics they cannot represent reliably."
  - Source: [SPEC §4.1.1, §11.2, §11.3](https://github.com/openai/symphony/blob/main/SPEC.md)
- **Original SPEC (2026-03-04, `fa75ec6`)** had the blocker rule in the scheduler itself: "Blocker rule for `Todo` state passes: If the issue state is `Todo`, do not dispatch when any blocker is non-terminal." The July 2026 generic-tracker refactor (#102) moved this into the adapter. — [SPEC history, commit 7af5a76](https://github.com/openai/symphony/commits/main/SPEC.md)
- Linear adapter today: "marks an issue dispatchable only when optional assignee routing matches and a `Todo` issue has no non-terminal blocker... blockers come from inverse `blocks` relations." Jira adapter: "issues in Jira's `new` status category wait until blockers reach configured terminal states, while in-progress categories keep running." — [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- Non-goal: "General-purpose workflow engine or distributed job scheduler." — [SPEC §2.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Secondary (Ry Walker): "No multi-agent collaboration within an issue (unlike Gastown or Metaswarm)". — [rywalker.com](https://rywalker.com/research/symphony)

### Inferences
- Blockers gate only the *start* of work (`Todo`). Once an issue is In Progress, the Linear and Jira adapters keep it running even if a blocker reappears. Dependencies are a dispatch gate, not a scheduling graph. There is no critical-path ordering, no fan-in or fan-out logic, and no "re-run downstream on upstream change".
- Planning is just another ticket whose output is more tickets. The human approval gate between plan and execution is implicit: the new tickets land in `Backlog`, and a human moves them to `Todo`.

### Gaps
- The blog does not say whether generated task trees use Linear sub-issues (parent/child) or only blocker relations. The SPEC has no `parent` field.

## Human involvement, handoff, blocked states, proof of work

### Takeaway
Humans interact **only through tracker state and PR review**. A run "succeeds" by reaching a policy-defined handoff state (e.g. `Human Review`), not `Done`. Questions to humans are actively suppressed: the high-trust example treats user-input requests as failures, and the prompt forbids asking humans. The only structured escalation is a "blocker brief" in the workpad plus a move to `Human Review`. Proof of work (CI green, PR feedback sweep, walkthrough media) is entirely prompt/skill policy; Symphony itself verifies nothing.

### Cited Findings
- "A successful run can end at a workflow-defined handoff state (for example `Human Review`), not necessarily `Done`." "Workflow-specific success often means 'reached the next handoff state'". — [SPEC §1, §11.5](https://github.com/openai/symphony/blob/main/SPEC.md)
- Operator intervention is via tracker state: "terminal state -> running session is stopped and workspace cleaned when reconciled; non-active state -> running session is stopped without cleanup". Editing `WORKFLOW.md` is the other lever. — [SPEC §14.4](https://github.com/openai/symphony/blob/main/SPEC.md)
- User input: "A run MUST NOT stall indefinitely waiting for user input. A conforming implementation MAY fail the run, surface the request to an operator, satisfy it through an approved operator channel, or auto-resolve it". The "Example high-trust behavior" will "Auto-approve command execution... file-change approvals" and "Treat user-input-required turns as hard failure." — [SPEC §10.5](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir impl (since 2026-05-20, #66): "If Codex reports that operator input, approval, or MCP elicitation is required, Symphony keeps the issue claimed and exposes it as blocked in the runtime state, JSON API, and dashboard. Blocked entries are in memory only; restarting the orchestrator clears that blocked map". The safer default `approval_policy` rejects sandbox approvals, rules and MCP elicitations. — [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- Prompt policy: "This is an unattended orchestration session. Do not ask a human to perform follow-up actions." "Only stop early for a true external blocker (missing required tools, auth, permissions, or secrets)." "Final message must report completed actions and blockers only." — [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- Blocked-access escape hatch: "move the ticket to `Human Review` with a short blocker brief in the workpad that includes: what is missing, why it blocks required acceptance/validation, exact human action needed to unblock." "GitHub is **not** a valid blocker by default." The workpad also has a `### Confusions` section for unclear parts. — [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- Completion bar before Human Review:
  - checklist complete;
  - ticket-provided `Validation`/`Test Plan` executed ("non-negotiable");
  - "Validation/tests are green for the latest commit";
  - "PR feedback sweep is complete and no actionable comments remain" (human *or bot* comments, each either addressed or given "explicit, justified pushback");
  - PR checks green;
  - `symphony` label;
  - if app-touching, `launch-app` validation and media via `github-pr-media`.
  - Source: [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- Review loop: a human moves the ticket to `Rework` or `Merging`. "Treat `Rework` as a full approach reset, not incremental patching". The agent closes the PR, deletes the workpad, and starts a fresh branch from `origin/main`. In `Merging` the agent runs the `land` skill in a loop until merged, then moves the ticket to `Done`. — [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- README on proof of work: "The agents complete the tasks and provide proof of work: CI status, PR review feedback, complexity analysis, and walkthrough videos. When accepted, the agents land the PR safely. Engineers do not need to supervise Codex". — [README](https://github.com/openai/symphony)
- Blog: proof includes "a video walkthrough of the feature working inside the real product". Last mile: "The system watches CI, rebases when needed, resolves conflicts, retries flaky checks, and generally shepherds changes through the pipeline." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Blog on a cost of the design: "When we moved from steering agents interactively to assigning them work at the ticket level, we lost the ability to constantly nudge them mid-flight and course-correct when needed. Sometimes the agent produced something that completely missed the mark." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Tessl paraphrase of the objective shift: "changing their goal to 'convince a human to merge this code'". — [Tessl](https://tessl.io/blog/openai-open-sources-symphony-a-spec-for-orchestrating-codex-agents)

### Inferences
- "Complexity analysis" appears in the README but **not** in the reference WORKFLOW.md or the SPEC. It probably comes from OpenAI-internal skills or harness work not included in the repo.
- Symphony has no first-class "question" object. A blocked state is overloaded onto `Human Review` plus free text. A human cannot tell a "ready for review" item from a "needs your input" item without reading the workpad, unless the team adds a distinct state or label to its own WORKFLOW.md.

### Gaps
- None of the primary sources show how humans answer a blocker brief (e.g. comment, then move back to Todo). This is implicit in the policy and left undefined.

## Policy: WORKFLOW.md and versioning

### Takeaway
`WORKFLOW.md` is a single repo-owned file:
- YAML front matter: tracker, polling, workspace, hooks, agent, codex.
- A strict Liquid prompt template as the body.

It is **hot-reloaded** without restart, and invalid reloads keep the last good config. Hooks are trusted shell. Concurrency limits are global plus per-state. Tracker state mapping comes from `active_states`/`terminal_states` and `required_labels`.

### Cited Findings
- The goal "keeps the workflow policy in-repo (`WORKFLOW.md`) so teams version the agent prompt and runtime settings with their code." "The workflow file is expected to be repository-owned and version-controlled." — [SPEC §1, §5.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Path: "Explicit application/runtime setting (set by CLI startup path)", otherwise "`WORKFLOW.md` in the current process working directory." — [SPEC §5.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Front matter keys:
  - `tracker`: `kind`, adapter-owned `provider`, `required_labels`, `active_states`, `terminal_states`.
  - `polling`: `interval_ms`, default 30000.
  - `workspace`: `root`.
  - `hooks`: `after_create`, `before_run`, `after_run`, `before_remove`, `timeout_ms` (default 60000).
  - `agent`: `max_concurrent_agents` (default 10), `max_turns` (default 20), `max_retry_backoff_ms` (default 300000), `max_concurrent_agents_by_state`.
  - `codex`: `command`, `approval_policy`, `thread_sandbox`, `turn_sandbox_policy`, `turn_timeout_ms` (default 3600000), `read_timeout_ms` (default 5000), `stall_timeout_ms` (default 300000).
  - "Unknown keys SHOULD be ignored for forward compatibility."
  - Source: [SPEC §5.3, §6.4](https://github.com/openai/symphony/blob/main/SPEC.md)
- Hook semantics: `after_create` failure aborts workspace creation; `before_run` failure aborts the attempt; `after_run` and `before_remove` failures are logged and ignored. "Hooks are fully trusted configuration." — [SPEC §5.3.4, §15.4](https://github.com/openai/symphony/blob/main/SPEC.md)
- Template: "Use a strict template engine (Liquid-compatible semantics are sufficient). Unknown variables MUST fail rendering." Inputs are `issue` (all normalized fields, including labels and blockers) and `attempt` (null on first run). "The core `attempt` value does not distinguish a normal continuation from an error/timeout/stall retry." — [SPEC §5.4, §12.3](https://github.com/openai/symphony/blob/main/SPEC.md)
- Dynamic reload: "Dynamic reload is REQUIRED... On change, it MUST re-read and re-apply workflow config and prompt template without restart." "Implementations are not REQUIRED to restart in-flight agent sessions". "Invalid reloads MUST NOT crash the service; keep operating with the last known good effective configuration". — [SPEC §6.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Design note: "`WORKFLOW.md` SHOULD be self-contained enough to describe and run different workflows (prompt, runtime settings, hooks, and tracker selection/config) without requiring out-of-band service-specific configuration." — [SPEC §5.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Example config: `polling.interval_ms: 5000`; `after_create` does `git clone --depth 1 ...`; Codex runs `gpt-5.5` with `model_reasoning_effort=xhigh`, `approval_policy: never`, `thread_sandbox: workspace-write`, `networkAccess: true`. — [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)
- Secondary claim (verdent.ai, surfaced via search snippet): "when the agent checks out a branch, it reads WORKFLOW.md from that checkout." **This conflicts with the SPEC**, which loads one WORKFLOW.md from the service's CLI path or cwd and applies it to all issues. Per-branch policy is not specified. — [Verdent guide](https://www.verdent.ai/guides/openai-symphony-architecture-deep-dive) vs [SPEC §5.1](https://github.com/openai/symphony/blob/main/SPEC.md)

### Inferences
- "Versioned with the repo" means the *service's* copy of WORKFLOW.md lives in git. The running daemon applies whatever is on disk at its configured path, hot-reloaded and global across issues. A policy change reaches in-flight issues on their next session, not their current one. Policy is not pinned per ticket.

### Gaps
- None significant.

## Failure handling

### Takeaway
Failure handling is crash-only and tracker-reconciled:
- exponential backoff retries (10 s × 2^(n−1), capped at 5 min);
- a 1 s continuation retry after a clean exit;
- inactivity-based stall detection (5 min);
- a per-turn silence timeout (1 h);
- reconciliation against tracker state on every tick;
- no durable DB.

Restart loses retry timers and in-flight sessions. Recovery comes from re-polling the tracker and reusing preserved workspaces.

### Cited Findings
- Backoff: "Normal continuation retries after a clean worker exit use a short fixed delay of `1000` ms. Failure-driven retries use `delay = min(10000 * 2^(attempt - 1), agent.max_retry_backoff_ms)`." — [SPEC §8.4](https://github.com/openai/symphony/blob/main/SPEC.md)
- Retry handling re-fetches the issue by ID:
  - not found → release the claim;
  - terminal → clean the workspace and release;
  - active and routable → dispatch, or requeue with "no available orchestrator slots";
  - otherwise → release.
  - Source: [SPEC §8.4](https://github.com/openai/symphony/blob/main/SPEC.md)
- Stall detection: "If `elapsed_ms > codex.stall_timeout_ms`, terminate the worker and queue a retry," measured from the last Codex event. `turn_timeout_ms` is "maximum silence interval while a turn stream is active; each app-server output resets it, so it is not a total turn runtime cap". — [SPEC §8.5, §10.6](https://github.com/openai/symphony/blob/main/SPEC.md)
- Reconciliation:
  - "If tracker state is terminal: terminate worker and clean workspace."
  - Active but no longer routable (e.g. a label was removed) → terminate without cleanup.
  - Neither active nor terminal → terminate without cleanup.
  - "If state refresh fails, keep workers running and try again on the next tick."
  - Source: [SPEC §8.5](https://github.com/openai/symphony/blob/main/SPEC.md)
- Restart: "Current design is intentionally in-memory for scheduler state... No retry timers are restored from prior process memory. No running sessions are assumed recoverable." Recovery is done through startup terminal cleanup, a fresh poll, and re-dispatch. — [SPEC §14.3](https://github.com/openai/symphony/blob/main/SPEC.md)
- Concurrency: `available_slots = max(max_concurrent_agents - running_count, 0)`. Per-state caps come from `max_concurrent_agents_by_state`. The SSH extension adds `max_concurrent_agents_per_host`, and "When all SSH hosts are at capacity, dispatch SHOULD wait rather than silently falling back". — [SPEC §8.3, App. A](https://github.com/openai/symphony/blob/main/SPEC.md)
- Recovery matrix:
  - dispatch validation failure → skip dispatch, keep reconciling;
  - worker failure → backoff retry;
  - candidate-fetch failure → skip the tick;
  - dashboard failure → never crash.
  - Source: [SPEC §14.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- Workspaces: deterministic `<root>/<sanitized identifier>`, "reused across runs for the same issue. Successful runs do not auto-delete workspaces." Safety invariants: agent cwd == workspace path; the path must stay under the root; keys are sanitized to `[A-Za-z0-9._-]`. — [SPEC §9](https://github.com/openai/symphony/blob/main/SPEC.md)
- Blog: "If an agent crashes or stalls, Symphony restarts it." — [Blog via Help Net Security](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)
- Merge conflicts are handled by agent policy (the `pull` skill before edits; "Merge latest `origin/main` into branch, resolve conflicts, and rerun checks"; the `land` loop). Symphony itself provides no merge queue or cross-ticket conflict avoidance. — [elixir/WORKFLOW.md](https://github.com/openai/symphony/blob/main/elixir/WORKFLOW.md)

### Inferences
- There is no maximum-attempts cap and no dead-letter state in the SPEC. A persistently failing issue retries every ≤5 min forever, until a human changes its tracker state. Cost exposure is bounded only by concurrency.
- Idempotency of agent side effects is left to the policy. Examples: "reuse the single workpad"; "if the branch PR is closed/merged, start fresh".

### Gaps
- None.

## Explicit non-goals, limitations, and OpenAI's stated purpose

### Takeaway
OpenAI positions Symphony as a reference spec and engineering preview, not a product. Its purpose is to move humans "from managing coding agents to managing work". It explicitly disclaims being a workflow engine, sandbox, or UI. It names its own limits: ambiguous work, loss of mid-flight steering, and dependence on harness engineering.

### Cited Findings
- Non-goals (verbatim list):
  - "Rich web UI or multi-tenant control plane."
  - "Prescribing a specific dashboard or terminal UI implementation."
  - "General-purpose workflow engine or distributed job scheduler."
  - "Built-in business logic for how to edit tickets, PRs, or comments."
  - "Mandating strong sandbox controls beyond what the coding agent and host OS provide."
  - "Mandating a single default approval, sandbox, or operator-confirmation posture".
  - Source: [SPEC §2.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- The README tagline: "Symphony turns project work into isolated, autonomous implementation runs, allowing teams to manage work instead of supervising coding agents." "Symphony is a low-key engineering preview for testing in trusted environments." "Symphony works best in codebases that have adopted harness engineering." — [README](https://github.com/openai/symphony)
- Elixir: "prototype software intended for evaluation only... We recommend implementing your own hardened version based on `SPEC.md`." — [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- Security: "A permissive deployment can lead to data leaks, destructive mutations, or full machine compromise". Implementations "SHOULD NOT assume that tracker data, repository contents, prompt inputs, or tool arguments are fully trustworthy". — [SPEC §15.5](https://github.com/openai/symphony/blob/main/SPEC.md)
- Blog, on motivation: "most people could comfortably manage three to five sessions at a time before context switching became painful". Results: "Among some teams at OpenAI, we saw the number of landed PRs increase by 500% in the first three weeks." Speculative work: "It's become trivial to spin up speculative tasks". Non-engineers: "Our product manager and designer can now file feature requests directly into Symphony." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Blog limits: some problems still need "interactive Codex sessions, especially ambiguous problems"; the rigid-state-machine lesson; lost course-correction. Maintenance: "Think of it as a reference implementation... we hope you point your favorite coding agent at the Symphony spec and repository to build your own versions". On implementations: "Codex built the Elixir implementation in one shot" and was re-implemented in other languages, "It succeeded in every language." — [Blog](https://openai.com/index/open-source-codex-orchestration-symphony/)
- The blog says the origin was a repo with "no human-written code". — [noqta.tn summary](https://noqta.tn/en/news/openai-symphony-codex-autonomous-orchestrator-linear-2026) (secondary, consistent with the blog)

### Inferences
- The 500% figure counts landed PRs (output volume) for "some teams" over three weeks. No quality, defect or review-time data was published.

### Gaps
- No OpenAI data on rework rate, review time, cost per ticket, or failure rates.

## Community reception, ports, and observed problems

### Takeaway
Reception is broadly interested but skeptical on several points: the 500% metric (validation does not scale like generation), token cost, review burden, spec quality ("agent slop"), and Linear lock-in. The lock-in point is now partly addressed by five adapters. Community ports substitute Claude Code and GitHub Issues. Commenters see Symphony as an *outer loop* (ticket → workspace) that lacks an inner quality harness.

### Cited Findings
- Analysts in InfoWorld (2026-04-28):
  - Sanchit Vir Gogia (Greyhound): the 500% figure "should prompt caution rather than comfort... generation scales effortlessly, validation does not."
  - Forrester's Biswajeet Mahapatra: measure lead time, defect rates, rework and cognitive load instead of output volume.
  - Counterpoint's Neil Shah: consistent security policies and audit trails across agents are hard.
  - Source: [InfoWorld](https://www.infoworld.com/article/4164173/openais-symphony-spec-pushes-coding-agents-from-prompts-to-orchestration.html)
- Token cost: Dan McAteer: "Only downside I found: it's *VERY* token hungry. Closed 30 Linear issues with Symphony + Codex in a week and it was the closest I came to my weekly Codex limit." — [X post](https://x.com/daniel_mac8/status/2048845594756522365). Tessl also notes "the system consumes a large number of tokens". — [Tessl](https://tessl.io/blog/openai-open-sources-symphony-a-spec-for-orchestrating-codex-agents)
- Maturity requirement: "depends on well-structured inputs... assumes a certain level of engineering maturity". Tessl also reports Linear's CEO arguing that issue tracking itself is becoming obsolete, which would make a tracker-centric model potentially dated. — [Tessl](https://tessl.io/blog/openai-open-sources-symphony-a-spec-for-orchestrating-codex-agents)
- Hacker News thread (posted around the March 2026 repo release, ~25 points):
  - exclipy: "The specs are inscrutable agent slop... it just lists database fields" and fail to describe the promised state machine.
  - MarkMarine: Symphony "doesn't deliver the harness you need to make working software". He pairs it with StrongDM's Attractor plus property testing and fuzzing.
  - hrpnk: doubts that cross-language regeneration is easy.
  - Source: [HN 47252045](https://news.ycombinator.com/item?id=47252045)
- Outer/inner loop framing: Symphony as the outer loop (ticket to workspace) and Attractor as the inner deterministic workflow inside each run. This is a search-result summary of the HN discussion and is secondary. — [HN 47252045](https://news.ycombinator.com/item?id=47252045)
- Ry Walker's analysis (June 2026):
  - strengths: in-repo governance, isolation, no DB;
  - weaknesses: "Linear-only in v1 spec" (since superseded), one agent per issue, "No quality gates, cross-model review, coverage enforcement, or approval gates", no built-in sandboxing;
  - ~25K stars by June 2026;
  - strategic read: OpenAI wants to "commoditize the orchestration layer so the agent runtime is where the money is."
  - Source: [rywalker.com](https://rywalker.com/research/symphony)
- Ports:
  - `@ghostlygawd/symphony` is "an independent, Claude-native implementation of the open-source Symphony spec". It drives the `claude` CLI on a Pro/Max subscription. — [socket.dev](https://socket.dev/npm/package/@ghostlygawd/symphony)
  - Contrabass appeared as a Show HN reimplementation. — [HN 47284926](https://news.ycombinator.com/item?id=47284926)
  - Verdent reports community reimplementations that swap in Claude Code for Codex and GitHub Issues for Linear. — [Verdent](https://www.verdent.ai/guides/what-is-symphony-open-source)
- Coordination gap (secondary summary): Linear/GitHub task state "doesn't capture the full coordination layer" for multi-repo or long-running team context. — [search summary of community commentary; origin not pinned to one source](https://rywalker.com/research/symphony)
- Practitioner advice: "Treat WORKFLOW.md with the same care as any CI/CD pipeline definition — it is executable policy." — [MindStudio / Verdent guides via search](https://www.mindstudio.ai/blog/500-percent-more-merged-prs-4-lessons-openai-symphony-agentic-coding)

### Inferences
- Several observed problems are structural:
  - review burden, because humans remain the only quality gate beyond CI and agent self-review;
  - token cost, because of continuation loops, xhigh reasoning, and full Rework resets;
  - merge conflicts, which are resolved per-agent at land time with no cross-ticket coordination.
- The SPEC openly delegates all three to the policy prompt and the "harness".

### Gaps
- I found no rigorous practitioner postmortem with numbers (cost per ticket, rework rate). The Reddit discussion was not reached in this pass. The Better Stack guide was not fetched.

## Tracker requirement and swappability; dependency modelling

### Takeaway
The SPEC **requires exactly one issue tracker** ("One configured issue tracker API"). Since July 2026, however, the tracker is a deliberately thin **read-only adapter**. Its two required operations are `fetch_issues_by_states` and `fetch_issues_by_ids`. It also has a normalized `Issue` with an adapter-computed `dispatchable` flag. Any task store that can answer "list items in states S" and "refresh items by ID", and that can expose its own write tools to the agent, could stand in. That includes a local task DAG. Dependencies are not modelled by the scheduler. They exist only as best-effort `blocked_by` metadata, and as the adapter folding blocker semantics into `dispatchable`.

### Cited Findings
- "The issue tracker boundary is deliberately small: a portable read kernel for scheduling plus OPTIONAL provider-native agent tools. Do not add generic comment/state/attachment CRUD merely to make providers look alike". — [SPEC §11](https://github.com/openai/symphony/blob/main/SPEC.md)
- Required ops: `fetch_issues_by_states(state_names)` and `fetch_issues_by_ids(issue_ids)`. "IDs no longer visible in the configured scope are omitted; the orchestrator treats omission as 'no longer visible'." "An ID-refresh call MUST fail instead of silently omitting a malformed requested record". — [SPEC §11.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Optional write side: `agent_tool_specs()`, `secret_environment_names()`, `execute_agent_tool(name, arguments, context={issue})`. "Tool names, schemas, and result payloads are adapter-owned. Symphony does not standardize a lowest-common-denominator CRUD API." Tools run host-side so that "the child receives tool results, not a raw token." — [SPEC §10.5, §11.5](https://github.com/openai/symphony/blob/main/SPEC.md)
- External dependency: "One configured issue tracker API." — [SPEC §3.3](https://github.com/openai/symphony/blob/main/SPEC.md)
- Restart recovery depends on the tracker as the durable store: "Support tracker/filesystem-driven restart recovery without requiring a persistent database". — [SPEC §2.1](https://github.com/openai/symphony/blob/main/SPEC.md)
- Shipped adapters: "Linear, GitHub Issues, Jira Cloud, Asana, and GitLab", with tools `linear_graphql`, `github_api`, `jira_rest`, `asana_api` and `gitlab_api`. The GitHub adapter is restricted: "pull requests returned by the Issues API are not dispatchable." — [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- The original March spec was Linear-specific: default active states `Todo, In Progress`, blockers "normalized from inverse relations of type `blocks`", and the `Todo` blocker rule in core scheduling. — [SPEC @ fa75ec6](https://github.com/openai/symphony/blob/fa75ec6/SPEC.md)
- Dependency fields: `blocked_by` "Best-effort provider metadata"; `dispatchable` covers "blocker semantics"; "The orchestrator MUST NOT... branch on provider-specific blocker... semantics." — [SPEC §4.1.1, §11.2](https://github.com/openai/symphony/blob/main/SPEC.md)
- The agent is still bound to Codex: the spec targets "Codex app-server mode", and `codex.command` must "speak a compatible app-server protocol over stdio". — [SPEC §3.3, §5.3.6](https://github.com/openai/symphony/blob/main/SPEC.md)

### Inferences
- A task-DAG store with dependencies fits the adapter contract directly:
  - map nodes to `Issue`;
  - compute `dispatchable = all deps satisfied`;
  - expose create/transition tools to the agent.
- The scheduler would remain DAG-unaware: no topological prioritization, and no awareness that finishing X unblocks Y beyond the next poll. Priority is a 1–4 integer plus age.
- The tracker doubles as the **durable state, the human UI and the audit log**. Swapping it for a local store means also providing human visibility and transition controls, which the tracker gives for free.
- The agent-side coupling (Codex app-server protocol, approval/sandbox pass-through) is tighter than the tracker coupling. Ports to Claude Code have to re-map the app-server's thread/turn/continuation model.

### Gaps
- I did not verify whether any community port has implemented a non-tracker (local file or DAG) adapter.
