# Context management for long-running coding agents and orchestration infrastructure

## Context degradation ("context rot") and how to keep a long-running agent effective

### Takeaway
Model accuracy measurably degrades as input length grows, well before advertised window limits, and distractors make it worse. Vendors (Anthropic) treat context as a scarce "attention budget". Their recommended mitigations are compaction, structured notes kept outside the context, just-in-time retrieval, subagents with clean windows, and fresh sessions that rebuild state from repo artifacts (progress file, feature list, git log). This favours bounded, single-feature work units over one agent carrying a whole feature in one long context.

### Cited Findings
- Chroma's "Context Rot" study (July 14, 2025) evaluated 18 LLMs, including Claude 4, GPT-4.1, Gemini 2.5 and Qwen3. Performance "consistently deteriorated" as input grew, which contradicts the assumption that the model handles "the 10,000th token just as reliably as the 100th." — [Chroma Research](https://www.trychroma.com/research/context-rot)
- Chroma: even a single distractor reduced accuracy, and the effect grew with context length. Distractors did not all have the same impact. — [Chroma Research](https://www.trychroma.com/research/context-rot)
- Chroma: models did better on shuffled, incoherent haystacks than on logically structured ones, which suggests that input structure affects how attention is applied. — [Chroma Research](https://www.trychroma.com/research/context-rot)
- Chroma LongMemEval: there was a large gap between focused prompts (~300 tokens) and full prompts (~113k tokens) holding the same answer. Claude models showed the largest degradation, attributed to more conservative abstention under ambiguity. — [Chroma Research](https://www.trychroma.com/research/context-rot)
- NoLiMa (ICML 2025) is a needle-in-a-haystack test with minimal lexical overlap between question and needle. At 32K tokens, 11 models fell below 50% of their short-context baselines, and GPT-4o dropped from 99.3% to 69.7%. Reasoning and chain-of-thought (CoT) prompting did not remove the decline. — [NoLiMa, PMLR](https://proceedings.mlr.press/v267/modarressi25a.html); [HF paper page](https://huggingface.co/papers/2502.05167)
- Anthropic, "Effective context engineering for AI agents": "as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases". Context is framed as a finite "attention budget" that every token depletes. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Same post: compaction summarizes the history near the limit and reinitializes. The risk is that aggressive compression loses subtle details. Tool-result clearing is described as one of the "safest lightest touch forms of compaction". — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Same post: structured note-taking (external memory files that are reloaded later) "provides persistent memory with minimal overhead". Just-in-time retrieval keeps lightweight references (paths, queries) and loads content on demand. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Same post: subagents explore in clean windows and return a "condensed, distilled summary of its work (often 1,000-2,000 tokens)", which separates concerns. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic, "Effective harnesses for long-running agents": each new session "begins with no memory of what came before". Even Opus 4.5 failed to build production-quality apps from a high-level prompt without harness structure. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Harness design: an initializer agent sets up `init.sh`, a `claude-progress.txt` and an initial git commit. Each later coding session reads the progress file and git log, runs a basic end-to-end check, works on one feature, commits with a descriptive message and updates the progress file. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- The feature list has 200+ features, each initially marked "failing", and is stored in JSON because "the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files." — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Observed failure modes: declaring victory prematurely; leaving bugs undocumented; marking features done that did not work end-to-end (fixed with browser automation via Puppeteer MCP); and time spent re-learning app state (fixed with `init.sh`). Working on "only one feature at a time" was described as essential against premature completion and context exhaustion. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic says it is unclear whether single-agent or multi-agent harnesses perform better here, and whether the findings generalize beyond web development. — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Cognition, "Don't Build Multi-Agents" (June 12, 2025): "Share context, and share full agent traces". Because "actions carry implicit decisions", parallel subagents with partial context produce conflicting outputs (their Flappy Bird example: a Mario-style background next to a mismatched bird). They recommend a single-threaded linear agent, plus a compression model to distill history into key decisions once tasks exceed the window. — [Cognition](https://cognition.com/blog/dont-build-multi-agents)
- Anthropic's multi-agent research system used external memory: agents summarize completed phases and store essentials before the context fills. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)

### Inferences
- Rebuilding state at session start from durable artifacts is the pattern Anthropic's own harness uses for multi-window work. Those artifacts are a progress file, a machine-readable feature or task list, git history and an init script. It is preferred to relying on ever-longer contexts or repeated compaction, because compaction is lossy and long contexts degrade.
- "One agent owns a whole feature" works only if the feature fits comfortably in one window, or if the agent works through it slice by slice with state persisted in files and git between sessions. In effect, the harness turns a feature into slices anyway: one feature-list item per session.
- Cognition and Anthropic do not actually conflict. Cognition warns against parallel writers that each hold partial context. Anthropic uses subagents for read-heavy exploration that returns summaries. The shared rule is: keep one writer per coherent unit of decisions, and use isolated contexts for exploration and verification.
- Storing task state as JSON or another structured format, not prose, reduces agent tampering with the source of truth. This supports keeping task state in a tracker or structured file that the orchestrator owns.

### Gaps
- I found no controlled study that directly compares compaction with a fresh-context restart on coding-agent task success. The evidence is vendor practice and qualitative reports.
- Chroma and NoLiMa measure retrieval and recall, not multi-step agentic coding. How these degradation curves carry over to SWE tasks is not quantified in the sources I read.

## Repo-resident policy (AGENTS.md, CLAUDE.md, WORKFLOW.md)

### Takeaway
The only rigorous study I found (ETH Zurich and collaborators, Feb 2026) shows that repository context files mostly add cost. LLM-generated ones slightly reduce success, and developer-written ones give only a small (~4%) gain. Agents follow the instructions faithfully, so extra requirements make tasks harder. Keep repo policy minimal and specific. OpenAI's Symphony moves orchestration policy into a repo-owned WORKFLOW.md (config plus prompt template).

### Cited Findings
- "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" (Gloaguen, Mündler, Müller, Raychev, Vechev; arXiv 2602.11988, Feb 2026; listed at ICLR 2026). Benchmarks: SWE-bench Lite (300 tasks) and a new AGENTbench (138 instances from 12 niche repos that have developer-written context files). — [arXiv](https://arxiv.org/html/2602.11988v1); [ICLR](https://iclr.cc/virtual/2026/10021142)
- LLM-generated context files: success fell 0.5% (SWE-bench Lite) and 2% (AGENTbench), cost rose 20% and 23%, and runs took +2.45 and +3.92 steps. — [arXiv](https://arxiv.org/html/2602.11988v1)
- Developer-written context files: success rose ~4% on average, cost rose by up to 19%, and runs took +3.34 steps. The paper reports that Claude Code did not improve with developer files. — [arXiv](https://arxiv.org/html/2602.11988v1)
- Agents follow context-file instructions: tools named in the file were used 1.6–2.5× more often. Reasoning tokens rose 14–22%. Authors' recommendation: omit LLM-generated context files and limit human-written ones to minimal requirements, such as repo-specific tooling. — [arXiv](https://arxiv.org/html/2602.11988v1)
- The results held across Claude Sonnet 4.5, GPT-5.2, GPT-5.1 mini and Qwen3-30B-coder. — [AI Weekly summary](https://aiweekly.co/alerts/paper-finds-agentsmd-files-hurt-coding-agent-task-success) (secondary source)
- Claude Code teammates and subagents load CLAUDE.md, MCP servers and skills automatically, but do not inherit the lead's conversation history. Task-specific context must go in the spawn prompt. — [Claude Code docs: agent teams](https://code.claude.com/docs/en/agent-teams)
- Symphony's `WORKFLOW.md` is "the authoritative contract". YAML front matter configures the tracker, polling, workspace, hooks, agent and Codex. The Markdown body is the per-issue prompt template, rendered strictly so that unknown variables are rejected. Changes are hot-reloaded: the service "MUST re-read and re-apply workflow config and prompt template without restart." — [openai/symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)

### Inferences
- The evidence supports short, high-signal repo policy: build and test commands, hard constraints and tool names. It does not support long style guides. Every instruction is obeyed and costs tokens and steps.
- Splitting policy into a stable layer (AGENTS.md/CLAUDE.md for how to work in this repo) and an orchestration layer (WORKFLOW.md for how tickets become runs) puts both under version control and review. The AGENTS.md study suggests that whatever gets injected into every run should be kept lean.

### Gaps
- The study covers Python issue-resolution tasks. I found no evidence on context files for long multi-session feature work, where conventions may matter more.
- I found no empirical evaluation of the WORKFLOW.md-style pattern itself.

## Orchestration infrastructure patterns (Codex/Symphony, Claude Code, Copilot, durable execution) and DAG vs flat tickets

### Takeaway
Production orchestrators are deterministic control loops around non-deterministic agent runs. Their common features: a single state authority, claim-before-dispatch, an isolated workspace per task, exponential backoff, stall timeouts and reconciliation against an external source of truth (the tracker). Symphony deliberately has no durable orchestrator DB and recovers from the tracker and filesystem. Symphony keeps dependencies (`blocked_by`) as metadata only and does not use them to gate dispatch (flat tickets). Claude Code agent teams do gate claims on task dependencies (a lightweight DAG). Dependent code changes are increasingly handled with stacked PRs and stack-aware merge queues.

### Cited Findings
**OpenAI Symphony (spec):**
- It turns a Linear board into a control plane for Codex. Each open issue gets a dedicated workspace, and the service monitors progress, restarts stalled agents and keeps work going until the issue is complete. — [IT Brief](https://itbrief.com.au/story/openai-launches-symphony-for-coding-agent-workflows); [Better Stack guide](https://betterstack.com/community/guides/ai/openai-symphony/)
- Fixed polling loop (`polling.interval_ms`, default 30000). Each tick reconciles running issues, validates config, fetches candidates, sorts them by priority and creation time, and dispatches while slots remain. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Claim states: Unclaimed → Claimed (Running | RetryQueued) → Released. "The orchestrator serializes state mutations through one authority to avoid duplicate dispatch. `claimed` and `running` checks are REQUIRED before launching any worker." — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Concurrency: a global `max_concurrent_agents` plus per-state caps (`max_concurrent_agents_by_state`). — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Retries: continuation after a normal exit waits a fixed 1000 ms. Failure retries use `min(10000 * 2^(attempt-1), max_retry_backoff_ms)`, with a default cap of 300000 ms. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Stall detection: if the time since the last agent event exceeds `codex.stall_timeout_ms` (default 300000), the worker is killed and a retry is queued. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Reconciliation each tick re-fetches the tracker state of running issues. Terminal → stop and clean the workspace. Non-active or missing → stop without cleanup. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- No durable orchestrator DB: "Restart recovery is tracker-driven and filesystem-driven". Retry timers and live sessions do not survive a restart. Workspaces persist per issue and are removed only once the issue is terminal. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Safety invariants: the agent runs only with `cwd == workspace_path`, the workspace must sit under the workspace root, and workspace keys are sanitized to `[A-Za-z0-9._-]`. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Dependencies: "`blocked_by` is best-effort metadata; adapters MUST NOT invent blocker semantics they cannot represent reliably". The field is not used to gate dispatch. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)

**Claude Code agent teams and subagents:**
- Architecture: lead, teammates (separate instances), a shared task list and per-agent JSON mailboxes. Tasks are pending, in progress or completed. "A pending task with unresolved dependencies cannot be claimed until those dependencies are completed". Claiming uses file locking to avoid races. Completed tasks automatically unblock their dependents. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Recommended size is 3–5 teammates and 5–6 tasks per teammate. "Three focused teammates often outperform five scattered ones." Token cost scales linearly with team size. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- For "sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are more effective". "Two teammates editing the same file leads to overwrites." — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Known limitations: "Task status can lag: teammates sometimes fail to mark tasks as completed, which blocks dependent tasks." The lead may decide the team is finished before all tasks are done. In-process teammates are not restored on `/resume`. Hooks such as `TaskCompleted` and `TeammateIdle` can enforce quality gates (exit 2 to block). — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)

**GitHub Copilot coding agent:**
- You assign it an issue. It works in an ephemeral environment powered by GitHub Actions, creates a branch, runs tests and linters, opens a PR and iterates on review comments. Public preview began May 19, 2025. — [GitHub changelog](https://github.blog/changelog/2025-05-19-github-copilot-coding-agent-in-public-preview/); [GitHub blog](https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/)
- One secondary source claims general availability in March 2026 and says it is best for low-to-medium complexity tasks in well-tested codebases. — [noqta.tn](https://noqta.tn/en/blog/github-copilot-coding-agent-autonomous-pr-issues-2026) (unverified against GitHub primary sources)

**Durable execution (Temporal):**
- Temporal (July 2025, Cornelia Davis) presents Durable Execution as the foundation for agents. Workflows survive crashes, restarts and infrastructure failures without losing state. — [Temporal blog](https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai)
- Temporal and OpenAI launched a public-preview integration with the OpenAI Agents SDK (2025). It covers LLM rate limits, network failures and crashes. — [InfoQ](https://www.infoq.com/news/2025/09/temporal-aiagent)
- Anthropic's production multi-agent system resumes from checkpoints instead of restarting, and uses "rainbow deployments" so that running long-lived agents are not broken by deploys. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)

**Dependent tasks, stacked PRs and merge queues:**
- In a stacked PR, the branch is cut from the previous PR rather than main. Graphite auto-rebases dependent PRs when a base merges, and runs a stack-aware merge queue so PRs land in order. — [Graphite guide](https://graphite.com/guides/graphite); [Contrary Research](https://research.contrary.com/company/graphite)
- A practitioner blog (April 2026) reports that GitHub shipped native stacked PRs in private preview and that OpenAI's repo added a skill for writing stacked-PR-aware descriptions, calling stacked PRs "an agent-native primitive". — [Daniel Vaughan blog](https://codex.danielvaughan.com/2026/04/16/stacked-prs-coding-agents-gh-stack-sapling-codex-skill/) (secondary source; GitHub announcement not verified)

### Inferences
- Two dependency models are in use. In flat tickets (Symphony, Copilot, Codex cloud: one issue, one workspace, one PR), dependencies are left to humans or tracker state: a blocked issue is simply not moved into an active state. In a DAG-gated task list (Claude Code teams), the scheduler enforces claimability. Symphony's refusal to "invent blocker semantics" suggests DAG gating should live where it can be represented reliably, ideally in deterministic orchestrator code rather than in agent-maintained status.
- The Claude Code limitation "task status can lag … blocks dependent tasks" shows the risk of letting agents own DAG state. A deterministic loop should derive completion from verifiable signals such as a PR merged, a CI result or a tracker transition.
- Durability can come either from a workflow engine (Temporal) or, as in Symphony, from an external source of truth (tracker plus filesystem) with idempotent reconciliation. The second is simpler and is enough when the per-tick reconciliation is idempotent.
- For a dependent chain, the options are: (1) dispatch serially, with each task branching from the previous task's merged result; (2) stack branches and use a stack-aware merge queue; (3) hold back dependents until the parent merges. Option 3 gives the cleanest context but the least parallelism.

### Gaps
- I did not get primary documentation on internal orchestration for Codex cloud, Devin, Factory, Sweep or OpenHands (task queues, retries, DAG support) within the tool budget. Their dependency handling is not covered here.
- I found no published data comparing DAG-gated with flat-ticket dispatch on throughput or rework.

## Parallel agents in git worktrees: practical caps and bottlenecks

### Takeaway
Worktrees (or per-task sandboxes) are the standard isolation unit. Practitioner consensus puts useful parallelism at about 3–6 concurrent agents per human. The limit is review and merge bandwidth, not compute. Anthropic's own guidance for agent teams is 3–5.

### Cited Findings
- Worktrees share one `.git` and give each agent its own working directory. Two agents in one folder produce race conditions that are hard to diagnose. — [Medium (mabd.dev)](https://medium.com/@mabd.dev/git-worktrees-the-secret-weapon-for-running-multiple-ai-coding-agents-in-parallel-e9046451eb96); [Superset guide](https://superset.sh/blog/parallel-coding-agents-guide)
- Reported ceilings: about 5–6 before review and merge overhead outweighs the gains; 4–8 run reliably in some team guides; 5–7 concurrent agents are comfortable on a modern laptop. — [Superset guide](https://superset.sh/blog/parallel-coding-agents-guide); [Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/7951/git-worktrees-ai-agents-claude-code-parallel) (practitioner blogs; the MindStudio and Claude Directory figures are quoted second-hand via search snippets)
- "Review is your real bottleneck": every parallel agent produces a branch to read, judge and merge. Past about five sessions, context-switching eats the gain. — [Context Studios](https://www.contextstudios.ai/blog/run-10-claude-code-agents-review-is-your-real-bottleneck)
- Claude Code docs recommend 3–5 teammates and file-ownership partitioning to avoid overwrites. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)

### Inferences
- With unattended orchestration, merge conflicts and review capacity become the binding constraints. Concurrency caps should be set by downstream review throughput, and partitioning by file or module ownership reduces conflicts.
- Automated gates before human review (CI, end-to-end tests, agent self-verification as in Anthropic's harness) are what make higher parallelism workable.

### Gaps
- The cap numbers are practitioner opinion. I found no controlled study of agent parallelism against merged-PR throughput or conflict rate.

## Failure modes: LLM-as-coordinator vs deterministic loops ("workflows vs agents")

### Takeaway
Empirical failure analysis of multi-agent LLM systems attributes most failures to system design and inter-agent misalignment rather than to raw model capability. Multi-agent setups cost about 15× the tokens of chat. Anthropic, Cognition and the Claude Code docs all say multi-agent coordination fits poorly with tightly coupled, sequential work such as coding. A deterministic control plane (code) dispatching agentic workers is the safer split.

### Cited Findings
- Anthropic definitions: workflows are "systems where LLMs and tools are orchestrated through predefined code paths"; agents are "systems where LLMs dynamically direct their own processes and tool usage". Workflows are recommended for predictable, well-defined tasks. "Start with simple prompts … add multi-step agentic systems only when simpler solutions fall short." — [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- MAST, "Why Do Multi-Agent LLM Systems Fail?" (NeurIPS 2025): 14 failure modes in 3 categories (specification issues, inter-agent misalignment, task verification). It is built from 150 traces (κ = 0.88), and the MAST-Data set holds 1600+ traces across 7 frameworks. Failures stem mainly from system design and inter-agent misalignment, not only from model limits. — [arXiv 2503.13657](https://arxiv.org/html/2503.13657v3); [NeurIPS](https://neurips.cc/virtual/2025/poster/121528)
- Anthropic multi-agent research: agents use about 4× the tokens of chat and multi-agent systems about 15×. The Opus 4 lead with Sonnet 4 subagents scored 90.2% better than single Opus 4 on research evals. Token usage explains 80% of the variance. Domains needing shared context, heavy interdependencies or real-time coordination (coding is cited) are a poor fit. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- Cognition: multi-agent architectures are fragile because subagents act on conflicting implicit decisions. Prefer a single-threaded agent. — [Cognition](https://cognition.com/blog/dont-build-multi-agents)
- Claude Code agent-team failure modes, as documented: status lag that blocks dependents, a lead that stops early or implements tasks itself instead of waiting, no resumption of in-process teammates, and teammates stopping on errors instead of recovering. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Symphony's counter-design puts all state mutation through one authority (code, not an LLM), with claim checks, reconciliation each tick, stall timeouts and bounded backoff. — [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)

### Inferences
- The failure modes of LLM coordinators (state drift, premature completion, unmarked tasks, lost teammates after a restart) map directly onto the guarantees that deterministic loops provide (single state authority, reconciliation, timeouts, idempotent claims). That makes the case for a code-level scheduler with agentic workers, keeping LLM judgement inside the worker or in planning steps whose output is a reviewable artifact such as tickets or a plan.
- LLM coordination is still useful for decomposition and for read-heavy fan-out such as research or review, where outputs are summaries and conflicts are cheap.

### Gaps
- I found no head-to-head benchmark of an LLM coordinator against a deterministic scheduler on identical coding workloads. The comparison rests on failure taxonomies, vendor docs and design specs.
- I did not quantify lost-message rates or coordinator cost for LLM-led orchestration beyond Anthropic's 15× token figure.
