# Multi-agent vs single-agent and role-based vs objective-based design for coding agents

Source strength key used below: **[Strong]** peer-reviewed or large controlled study with numbers; **[Medium]** arXiv preprint with controlled experiments, or a first-party engineering report with internal numbers; **[Weak]** practitioner opinion, vendor docs, or secondary blog. "Verified" means the text was fetched in this session; "not re-verified" means it comes from a known published source whose text was not extracted this session.

## 1. What do failure-taxonomy studies find about inter-agent misalignment, role specification and coordination?

### Takeaway
MAST (Cemri et al., 2025) finds that multi-agent systems (MAS) fail 41–86.7% of the time across 7 open-source frameworks. Most failures come from system design (about 44%) and inter-agent misalignment (about 31%), not from the base model. Prompt-level fixes such as better role specs help only modestly (about +9–16 points on ChatDev). The authors also note that MAS gains over single-agent or best-of-N baselines are often minimal.

### Cited Findings
- **[Medium-Strong, NeurIPS 2025 D&B track / arXiv]** MAST: 1,600+ annotated traces across 7 MAS frameworks, 14 failure modes in 3 categories, inter-annotator kappa = 0.88. Models covered include GPT-4 family, Claude 3, Qwen2.5 and CodeLlama. — [Cemri et al., arXiv 2503.13657](https://arxiv.org/abs/2503.13657)
- MAS failure rates range from 41% to 86.7% across the 7 state-of-the-art open-source systems studied. — [MAST HTML](https://arxiv.org/html/2503.13657)
- Category shares: **System design issues ~44%**, **inter-agent misalignment ~31%**, **task verification ~23.5%**. — [MAST HTML](https://arxiv.org/html/2503.13657)
- Largest individual modes:
  - Step repetition: 15.7%
  - Reasoning-action mismatch: 13.2%
  - Unaware of stopping conditions: 12.4%
  - Disobey task specification: 11.8%
  - Incorrect verification: 9.1%
  - No/incomplete verification: 8.2%
  - Task derailment: 7.4%
  - Fail to ask for clarification: 6.8%
  - Premature termination: 6.2%
  - Disobey *role* specification: only 1.5%
  - Information withholding: 0.85%
  
  Figures were read from the paper's Figure 1 by the fetch tool, so treat them as ±1 point. — [MAST HTML](https://arxiv.org/html/2503.13657)
- Intervention case study on ChatDev (ProgramDev benchmark): improved role specification gave **+9.4%** success. Adding a high-level task-objective verification step gave **+15.6%**. The authors conclude the identified failures "require more sophisticated solutions" than prompt tweaks. — [MAST HTML](https://arxiv.org/html/2503.13657); [abstract](https://arxiv.org/abs/2503.13657)
- MAST states that MAS "performance gains often remain minimal compared to single-agent frameworks or simple baselines like best-of-N sampling." — [MAST HTML](https://arxiv.org/html/2503.13657)
- **[Medium, arXiv Dec 2025]** "Towards a Science of Scaling Agent Systems" ran 260 configurations. Architectures without centralized verification propagate errors more than centrally coordinated ones. — [arXiv 2512.08296](https://arxiv.org/abs/2512.08296)

### Inferences
- The dominant failure modes are spec, termination and verification problems plus inter-agent handoff drift, not agents "playing the wrong role." Disobeying role spec is rare (1.5%). Assigning personas does not address what actually breaks. Clear task objectives, stop conditions and an explicit verification step address more failure mass.
- Verification is a quarter of failures. Clean-context review (see section 3, Cognition 2026) is the multi-agent pattern that targets the largest fixable category.

### Gaps
- MAST traces mostly come from 2024-era models (GPT-4o, Claude 3). I found no published re-run of MAST failure rates on 2025–2026 frontier models (Claude 4.x, GPT-5).
- The exact per-framework failure rate for ChatDev and MetaGPT on ProgramDev was not extracted in this session.

## 2. Do role-play frameworks (ChatDev, MetaGPT, AgentVerse) beat strong single agents on coding once the base model is strong? Any ablations?

### Takeaway
No, not under controlled comparisons. Recent controlled studies (2025–2026) find that a single agent using the same model matches homogeneous multi-agent workflows on coding benchmarks at lower cost. The gains that do appear come mostly from extra sampling/compute (voting, best-of-N) rather than from role structure, and they shrink as the base model gets stronger.

### Cited Findings
- **[Medium, arXiv Jan 2026]** "Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline" (Xu et al.) covers 7 benchmarks, including HumanEval, MBPP and LiveCodeBench. A single agent reaches the performance of homogeneous multi-agent workflows (same base LLM, different prompts/roles) and gains efficiency from KV-cache reuse. Their OneFlow method compiles a workflow into single-agent execution with lower inference cost and no accuracy loss. — [arXiv 2601.12307](https://www.arxiv.org/pdf/2601.12307); [DAIR summary](https://academy.dair.ai/papers/rethinking-multi-agent-workflows)
- **[Medium, arXiv 2026, secondary summary only]** BenchAgent puts single-agent, fixed MAS and evolving MAS workflows under one normalized protocol: 10 reasoning/coding/tool-use benchmarks, GPT-4.1. "At most one of six tested MAS exceeds the matched single-agent anchor." — [search summary via awesomepapers 2606.05670](https://awesomepapers.io/papers/2606.05670) (primary not fetched; treat as unverified)
- **[Medium, arXiv Dec 2025]** Scaling Agent Systems:
  - Multi-agent vs single-agent change ranges from **+80.8%** (decomposable financial reasoning) to **−70.0%** (sequential planning).
  - There is a "robust capability-saturation effect": coordination yields diminishing returns once the single-agent baseline exceeds a threshold.
  - Tool-heavy tasks incur multi-agent overhead.
  
  — [arXiv 2512.08296](https://arxiv.org/abs/2512.08296)
- **[Medium, arXiv Nov 2025]** Empirical evaluation of 7 agent frameworks (single: OpenHands, SWE-agent; multi: OWL, SE-Agent, TRAE, GPTSwarm, AgentOrchestra/DeepResearchAgent) on software development, vulnerability detection and program repair. Agents reach "moderate overall performance." AgentOrchestra has the longest trajectories and most correction attempts "due to coordination overhead," while OpenHands (single agent) shows stronger reflective reasoning. — [Yin et al., arXiv 2511.00872](https://arxiv.org/abs/2511.00872)
- **[Medium, 2024 — older]** "More Agents Is All You Need" (Li et al.): plain sampling-and-voting (Agent Forest) makes performance scale with the number of instances. It is orthogonal to complex multi-agent frameworks, and gains grow with task difficulty. Implication: much of the "multi-agent" lift is just more samples plus aggregation. — [arXiv 2402.05120](https://arxiv.org/abs/2402.05120)
- **[Medium, 2024 — older]** Agentless: a fixed three-phase pipeline (localize → repair → validate) with no autonomous agent scaffold reached **32.00% on SWE-bench Lite at ~$0.70/issue**, beating all open-source agents at the time. — [arXiv 2407.01489](https://arxiv.org/abs/2407.01489)
- **[Medium, practitioner/academic tool]** mini-swe-agent (from the SWE-agent team) is ~100 lines of Python, uses only bash, keeps a linear message history and has no roles or subagents. It scores **>74% on SWE-bench Verified** with frontier models. — [GitHub SWE-agent/mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)
- **[Medium, distillation evidence]** MapCoder-Lite distills a multi-agent coding pipeline into a single small LLM. The role structure can be absorbed into one model. — [arXiv 2509.17489](https://arxiv.org/pdf/2509.17489)
- **[Weak, practitioner series]** Meiklejohn's MAS benchmark review discusses what MAS benchmarks miss, such as unmatched compute and missing single-agent baselines. — [christophermeiklejohn.com](https://christophermeiklejohn.com/ai/agents/mas-series/2026/04/30/mas-series-07-benchmarks.html)

### Inferences
- **2023-era caveat:** ChatDev, MetaGPT and AgentVerse results were reported mostly on GPT-3.5/GPT-4 with toy app generation or HumanEval/MBPP. Those comparisons usually did not give the single agent equal compute. They should not be assumed to hold for 2025–2026 frontier models.
- Top SWE-bench Verified results are now dominated by simple single-loop agents. Together with the saturation finding, this makes the burden of proof sit with role decomposition.
- Where multi-agent helps, the mechanism is usually one of three things:
  - more compute (sampling or voting)
  - context isolation (fresh context for a reviewer or searcher)
  - true parallelism on decomposable work
  
  Role-play personas are not one of the mechanisms.

### Gaps
- I found no head-to-head on SWE-bench Verified of ChatDev or MetaGPT vs a single agent on the same frontier model. Those frameworks are rarely evaluated on SWE-bench at all.
- The BenchAgent primary paper was not fetched.

## 3. Practitioner positions (Cognition, Anthropic, OpenAI, others)

### Takeaway
Practitioners have converged on these points:
- Start with one agent.
- Keep writes single-threaded.
- Use subagents only for read-heavy, parallelizable investigation or a clean-context review, returning compressed summaries to one owner.
- Avoid peer "group chat" swarms of writers.

Anthropic's research system shows big gains for breadth-first research but at ~15x chat tokens, and it explicitly says coding is a poorer fit.

### Cited Findings
- **[Weak-Medium, Cognition, Walden Yan, 12 Jun 2025]** "Don't Build Multi-Agents" has two principles: (1) share full context and full agent traces, not just individual messages; (2) "actions carry implicit decisions, and conflicting decisions carry bad results."
  - Flappy Bird example: one subagent builds a Mario-style background and another builds an incompatible bird.
  - Recommends single-threaded linear agents, with a compression model for long tasks.
  - Notes that Claude Code (at the time) used subagents only to answer questions, never for parallel writing.
  - Notes that edit/apply model splits caused misinterpretation.
  
  — [cognition.com/blog/dont-build-multi-agents](https://cognition.com/blog/dont-build-multi-agents)
- **[Medium, Cognition, 22 Apr 2026]** "Multi-Agents: What's Actually Working" says multi-agent works "when writes stay single-threaded and the additional agents contribute intelligence rather than actions."
  - **Clean-context code review loop:** the reviewer catches on average ~2 bugs per PR, ~58% of them severe (logic, edge cases, security). Reviewers do better *without* the coder's context because they re-derive it from the code with shorter context.
  - **"Smart friend":** a primary model consults a stronger model. This needs a capable primary; SWE-1.5 "was not good enough" because it failed to recognize when to escalate.
  - **Manager delegation** is still hard: "Managers trained on small-scoped delegation default to being overly prescriptive."
  - **Parallel-writer swarms** still fail due to conflicting implicit choices. Open problem: how a child surfaces discoveries that should change its siblings' work.
  
  — [cognition.com/blog/multi-agents-working](https://cognition.com/blog/multi-agents-working)
- **[Medium, Anthropic, Dec 2024]** "Building effective agents":
  - "find the simplest solution possible, and only increasing complexity when needed."
  - Workflows are "predefined code paths"; agents are LLMs that "dynamically direct their own processes."
  - Orchestrator-workers suits tasks with unpredictable subtasks, e.g., the number of files to change in coding.
  - Evaluator-optimizer works when evaluation criteria are clear.
  - Frameworks add abstraction that obscures prompts.
  - For SWE-bench they spent more time on tools (ACI, e.g., absolute file paths) than on the prompt.
  
  — [anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents)
- **[Medium, Anthropic, Jun 2025]** Multi-agent research system:
  - Opus 4 lead with Sonnet 4 subagents beat single-agent Opus 4 by **90.2%** on an internal research eval, mainly on breadth-first queries.
  - Agents use ~**4x** the tokens of chat; multi-agent uses ~**15x**.
  - Token usage alone explains **80%** of performance variance on BrowseComp; tokens, tool calls and model choice explain 95%.
  - Poor fit for tasks needing shared context or with many interdependencies. "most coding tasks involve fewer truly parallelizable tasks than research."
  - LLM agents "are not yet great at coordinating and delegating to other agents in real time."
  - Synchronous lead waits on subagents, can't steer them, and subagents can't coordinate.
  - Delegation needs objective, output format, tool guidance and explicit boundaries. Vague delegation caused duplicated or missed work.
  
  — [anthropic.com/engineering/multi-agent-research-system](https://www.anthropic.com/engineering/multi-agent-research-system)
- **[Medium, Anthropic, Sep 2025]** Context engineering: subagents return condensed summaries of "often 1,000–2,000 tokens" so the lead keeps a clean context. — [anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **[Weak-Medium, OpenAI, Apr 2025; PDF text not extractable this session, not re-verified]** "A practical guide to building agents":
  - Recommends maximizing a single agent's capabilities first and an incremental approach.
  - Split into multiple agents mainly for (a) complex logic, i.e., prompts with many conditionals, or (b) tool overload, which is about overlapping or similar tools rather than raw count.
  - Describes the manager (agents-as-tools) and decentralized (handoff) patterns.
  
  — [OpenAI guide PDF](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- **[Weak, secondary]** Industry convergence by 2026: a single orchestrator owns the context and spawns ephemeral isolated subagents that return compressed summaries. Peer "GroupChat" designs have lost ground. — [flowhunt summary](https://www.flowhunt.io/es/blog/multi-agent-ai-system/) (secondary aggregator; low weight)
- **[Weak, counter-position]** Cosine argues "You Should Build Multi-Agents." — [cosine.sh](https://cosine.sh/blog/why-you-should-build-multi-agent-ai) (vendor; not analysed in detail)

### Inferences
- Cognition's 2025 and 2026 posts and Anthropic's two posts agree on several points:
  - The useful split is by **context** (isolate noisy reading, get a fresh-eyes reviewer), not by **persona**.
  - The write path should have one owner.
  - LLM managers tend either to under-specify (Anthropic: duplicated work) or over-prescribe (Cognition: overly prescriptive managers).
- The 15x token multiplier, plus "tokens explain 80% of variance," suggests much of the multi-agent win in research is bought compute. For coding, compute can usually be spent more cheaply inside one agent's loop or through best-of-N.

### Gaps
- Anthropic's 90.2% is an internal eval with no public breakdown. There are no published numbers for a multi-agent coding setup from Anthropic.
- The OpenAI guide's exact wording could not be re-extracted. The quotes above are paraphrased from the published guide.

## 4. Where does parallelism help in coding: independent tickets vs slices of one change; merge conflicts; cost of decomposition and integration

### Takeaway
Parallelism pays off when units are truly independent: separate tickets, read-only exploration, or candidate attempts with a judge. It hurts when one coherent change is sliced across concurrent writers, because implicit design decisions conflict and integration cost rises. Field data shows agents already produce lots of concurrent PRs. The standard mitigations are worktree isolation, explicit boundaries, automated gates and sequential merge.

### Cited Findings
- **[Medium, arXiv Jul 2026]** Xu, Subramanian & Karthik analysed 33,596 agent-authored PRs across 2,807 repos (AIDev-pop: Codex, Copilot, Devin, Cursor, Claude Code; Dec 2024–Jul 2025).
  - 40.2% of repos have agent PR pairs with exact temporal overlap, covering 79.4% of agent PRs. Within a 1-week window this rises to 53.4% of repos and 95.0% of PRs.
  - Most co-active pairs come from the same agent; only 0.5% are cross-agent, in 122 repos (~4.3%).
  - The authors replayed three-way merges on 747 co-active pairs to measure textual conflicts.
  
  — [arXiv 2607.04697](https://arxiv.org/abs/2607.04697)
- **[Medium]** Anthropic: "most coding tasks involve fewer truly parallelizable tasks than research." Tasks with shared context or heavy interdependencies are a poor fit. — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)
- **[Weak-Medium]** Cognition: parallel-writer swarms make conflicting implicit choices about style and patterns. Open problem: propagating one child's discoveries to its siblings. — [Cognition 2026](https://cognition.com/blog/multi-agents-working); [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents)
- **[Medium]** Scaling Agent Systems: −70% for multi-agent on sequential planning vs +80.8% on decomposable tasks. Task decomposability is the deciding variable. — [arXiv 2512.08296](https://arxiv.org/abs/2512.08296)
- **[Weak, practitioner case report]** Ten coding agents ran in parallel, each in its own worktree and PR, unaware of each other, then merged in dependency order. Three conflicts surfaced. — [Bernstein "ten agents one release"](https://bernstein.readthedocs.io/en/latest/blog/ten-agents-one-release/)
- **[Weak, practitioner blogs]** Recommended patterns: spec-driven decomposition into testable tasks with explicit boundaries, one git worktree per agent, automated verification before merge, and sequential merges. — [Augment Code guide](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace); [D. Vaughan on semantic conflicts](https://codex.danielvaughan.com/2026/06/06/multi-agent-coordination-problem-concurrent-agents-semantic-conflicts-codex-cli/)

### Inferences
- Treat independent tickets as the unit of parallelism, one owner per ticket. Don't treat slices of one change as parallel units.
- Decomposition has costs on both ends: up-front (writing boundaries and specs precise enough to avoid overlap) and back-end (merge, semantic-conflict resolution, re-verification). Textual conflicts are the visible part; semantic conflicts (incompatible assumptions that merge cleanly) are the more dangerous part per Cognition, and are unmeasured.

### Gaps
- The actual textual conflict rate from the 747 replayed merges was not extracted.
- I found no controlled study comparing "N agents on slices of one feature" vs "one agent on the whole feature" for end-to-end quality and cost.

## 5. LLM as orchestrator/coordinator vs deterministic code orchestration

### Takeaway
Evidence is thinner here and mostly from 2026 preprints and practitioner design docs. It consistently favors deterministic code for control flow (scheduling, state, retries, termination) with LLMs at bounded decision points. LLM coordinators show control-flow hallucination, missed stop conditions and loops (MAST), and under- or over-specification of delegation.

### Cited Findings
- **[Medium, arXiv Jun 2026]** "LLM-as-Code" (Qi et al.): "token explosion, control-flow hallucination, and unreliable completion are not implementation bugs but architectural consequences of assigning the deterministic work of looping, branching, and sequencing to a probabilistic system." It proposes that the program owns control flow and the LLM is a component. This improved stability of long computer-use sequences; no numeric comparisons appear in the abstract. — [arXiv 2606.15874](https://arxiv.org/abs/2606.15874)
- **[Medium-Strong]** MAST failure modes relevant to an LLM coordinator: unaware of stopping conditions 12.4%, step repetition 15.7%, premature termination 6.2%, loss of conversation history 2.8%, conversation reset 2.2%. — [MAST HTML](https://arxiv.org/html/2503.13657)
- **[Medium]** Anthropic: LLM agents "are not yet great at coordinating and delegating to other agents in real time." The synchronous lead creates bottlenecks, and asynchronous execution adds state-management complexity. — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)
- **[Weak-Medium]** Cognition 2026: LLM managers "default to being overly prescriptive." — [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- **[Medium]** Anthropic distinguishes workflows (predefined code paths) from agents and recommends the simplest option. Workflows give predictability for well-defined tasks. — [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- **[Weak, practitioner design docs]** The Bernstein orchestrator chose a deterministic, no-LLM scheduler: same queue and state always give the same decision, and it is unit-testable. The doc argues that an LLM manager hallucinating an assignment or exhausting its context blocks downstream agents, and that long-running agents lose track of which tasks they or others did. — [Bernstein: Why deterministic](https://bernstein.readthedocs.io/en/latest/architecture/WHY_DETERMINISTIC/); [ADR 006 no embedded LLM](https://bernstein.readthedocs.io/en/latest/decisions/006-no-embedded-llm/)
- **[Weak, blog]** "Deterministic skeleton, LLM at bounded decision points" is described as the production-hardened hybrid. — [tianpan.co, Apr 2026](https://tianpan.co/blog/2026/04/20/workflow-engines-beat-llm-agents)

### Inferences
- For a coordinator whose job is bookkeeping (who owns which ticket, status, retries, merge order), deterministic code wins on reliability, cost, testability and auditability. Use an LLM only where judgment is needed: decomposition, triage, reviewing a result.
- Task-status hallucination is reported anecdotally and is consistent with the MAST modes, but no study I found measures it directly.

### Gaps
- No controlled benchmark found that directly compares LLM coordinator vs code coordinator on the same coding workload (success rate, cost, status-accuracy).

## 6. Objective/goal-oriented prompting vs prescriptive step-by-step process for strong models

### Takeaway
First-party guidance from 2025–2026 says that as models improve, prompts should state goals, constraints, context and success criteria rather than brittle step-by-step logic. Both extremes fail: brittle hardcoded procedure, and vague goals without concrete signals. Delegation still needs explicit objective, output format and boundaries. Evidence is mostly practitioner guidance plus indirect benchmark results; I found no rigorous ablation.

### Cited Findings
- **[Medium, Anthropic, Sep 2025]** On system-prompt "altitude": avoid "hardcoding complex, brittle logic in their prompts to elicit exact agentic behavior," but also avoid vague guidance that "fails to give the LLM concrete signals."
  - Aim for "the minimal set of information that fully outlines your expected behavior."
  - "Smarter models require less prescriptive engineering, allowing agents to operate with more autonomy."
  - "Do the simplest thing that works."
  
  — [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **[Medium, Anthropic]** Effective delegation to subagents needs a clear objective, output format, tool/source guidance and explicit task boundaries. Objective-based does not mean under-specified. — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)
- **[Weak-Medium, Cognition 2026]** Prescriptive managers are a known failure: delegations that over-specify the "how" make outcomes worse. Cognition favors "context engineering" over "prompt engineering" and assumes models keep improving. — [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- **[Medium]** Indirect "bitter lesson" evidence: a 100-line bash-only agent with a linear history (mini-swe-agent) scores >74% on SWE-bench Verified. Heavy process scaffolding is not needed for frontier models. — [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)
- **[Medium]** Anthropic's own SWE-bench work found tool/interface design mattered more than prompt process. — [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- **[Medium-Strong]** MAST's ChatDev intervention: adding *task-objective verification* (+15.6%) helped more than refining roles (+9.4%). This is weak but direct evidence that anchoring on the objective outperforms elaborating roles. — [MAST HTML](https://arxiv.org/html/2503.13657)

### Inferences
- For strong models the evidence points to an objective-based design:
  - Give one agent the end-to-end goal, constraints, acceptance criteria and a verifier (tests or a clean-context reviewer).
  - Don't prescribe a role-by-role procedure.
  - Use code to enforce the few invariants that must hold, such as gates and stop conditions.
- Role-based pipelines (planner → coder → reviewer) are mainly justified where a role buys **context isolation** or **independent verification**. The reviewer is the clearest case. The persona itself is not the justification.

### Gaps
- No controlled ablation found of goal-only vs step-by-step prompting on SWE-bench-class tasks with current frontier models. The claim rests on vendor guidance and indirect evidence.
- "Bitter lesson for harnesses" arguments (e.g., Latent Space, Simon Willison) were not fetched in this session.
