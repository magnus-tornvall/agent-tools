# Handover: brainstorm skill + plan skill

Contract for two skills I am authoring myself. This document is the spec; the skills
are the implementation. Read this file in full before writing either skill.

**Scope of this document.** It defines two skills and the two artifacts they produce.
It does not define the implement/review/eval loop itself — that is downstream and
partly already covered by existing tooling.

---

## 0. Decisions register

Settled. Do not relitigate; do not propose alternatives to these.

| Decision | Rationale |
|---|---|
| I author both skills by hand, first version | The point is to calibrate difficulty, not to obtain a skill |
| Two artifacts: **spec contract** → **plan contract** | Separates "what problem / what's needed" from "how, in what order" |
| The plan contract is the handover boundary to the automated loop | Everything upstream is judgment; everything downstream is mechanical |
| Provenance labelling over assumption-elimination | Assumptions can't be eliminated, only surfaced and signed off |
| One state transition per agent invocation, fresh context | A model that wrote the code is the worst reviewer of it |
| Postconditions a validator can check, over prose guidance | Prose is advisory and degrades with volume |
| Machine checks beat written rules | If a linter/CI/validator can enforce it, it does not belong in prose |

Rejected:

- Adopting a framework before the loop closes end-to-end once
- A central/shared spec repo across my repos — per-repo, references only for genuine cross-repo contracts
- A separate standards layer/tool — stacked instruction files plus path-scoped rules already cover this
- Borrowing an existing plan template for v1 — read others *after* writing mine, then diff
- Personas, agent rosters, role-play framing
- Parallel lanes before one lane is reliable

---

## 1. Must-haves and nice-to-haves

### 1.1 Shared — apply to both skills

Must:

1. **Self-contained output.** Artifact + repo = complete input for the next stage. No
   reference to the session that produced it, no "as discussed", no pronouns pointing
   outside the document.
2. **Provenance on every claim.** `stated` (I said it) / `observed` (read from the repo,
   with `path:line`) / `inferred`. Inferred claims collect in a separate list and each
   needs my explicit sign-off before anything downstream may rely on it.
3. **Read before asking.** Explore the relevant code and cite findings before the first
   question. Questions asked from zero context are generic.
4. **Question budget, gated on consequence.** Hard cap, themed rounds, narrowing. Test
   for inclusion: if both answers lead to the same output, don't ask.
5. **Restate-back before writing.** State the problem/plan back in its own words,
   including what it thinks I *don't* want. I confirm or correct.
6. **No vague language.** Banned in criteria and goals: properly, gracefully, correctly,
   efficiently, robustly, appropriately, as needed, if necessary, etc.
7. **`unresolved` list; non-empty blocks approval.** On hitting a gap: record and stop,
   never decide.
8. **May not mark itself approved.**
9. **Stays in its lane.** Brainstorm writes no design and no code. Plan writes no code
   and no test bodies.

Nice:

- Traceability links between artifacts (plan task → spec requirement → outcome)
- Known-traps section fed by accumulated learnings
- Human-checkpoint flags on items that are taste rather than correctness

### 1.2 Spec contract — must

1. Problem statement in my terms, not restated feature request
2. Explicit non-goals
3. Inference list, each item awaiting sign-off
4. Load-bearing unknowns, each resolved into a research task or a declared risk
5. **Outcome**: one observable statement that makes this done
6. **Kill criterion**: what would tell me to abandon or re-scope
7. Behaviour-first requirements — observable, at a boundary, testable
8. Alternatives considered *with rejection reasons* (the rejection reasons are the
   durable artifact)
9. No implementation detail: no class names, library choices, control flow

Nice: rigour tier (lite / full) so small changes stay cheap; scenario examples in
given/when/then form for anything with branching behaviour.

### 1.3 Plan contract — must

1. **Recorded green baseline.** Actually run the verify command on a clean tree; record
   result and duration. Not describe — run. *Highest-value single item: without it the
   implementer cannot distinguish pre-existing failures from ones it caused.*
2. **Literal verify commands**, per task and whole-plan. Copy-pasteable. No placeholders,
   no `<...>`, no "your".
3. **Every referenced path resolves** in the repo or is marked `new: true`.
4. **Task type declared**, with matching proof obligation:
   - `behavior-change` → new named test with concrete assertions
   - `behavior-preserving` → named existing tests that must keep passing
5. **Acceptance criteria as assertions**, with concrete values and identifiers.
6. **Shared decisions pinned** before the tasks that consume them: names, signatures,
   data shapes, error contracts, boundaries touched by more than one task.
7. **`scope` and `forbidden` per task**, forbidden entries traceable to a reason.
8. **Budgets at plan level**: new dependencies, new abstractions, new public surface —
   default 0, any non-zero justified inline.
9. **Independently revertable tasks**, green at every boundary, dependencies form a DAG.
10. **Size cap enforced** — split rather than exceed.
11. **Escalation conditions** — named circumstances where the implementer stops rather
    than adapts. Pinning without an escape hatch turns "improvises badly" into
    "proceeds confidently off a cliff".
12. **Amendment mechanism** — append-only, with reason. Without it I cannot tell whether
    the plan was wrong or the implementation deviated.
13. **Evaluation input that is not the diff** — a command, endpoint, log line, or UI state.
14. **Per-task review focus**, derived not invented: the budgets, forbidden paths, and
    pinned decisions this task consumes.
15. **Decisions, not mechanics.** If it's a decision the agent would otherwise make
    silently and inconsistently, it goes in. If it's code, it doesn't.

Nice: risk-first ordering (put the task most likely to invalidate the plan first, so the
kill criterion fires early); per-task attempt budget; parallelisable flags; rollback note
where it isn't just "revert the commit"; prerequisite/setup task where the environment
needs something the implementer would otherwise discover by failing.

---

## 2. Brainstorm skill

**Input:** a short prompt naming a topic or itch. Assume one or two sentences, possibly
vague. Assume no prior context.

**Output:** a spec contract at `docs/specs/<slug>.md`.

### Obligations

1. Explore the repo for the named area. Cite what was found, with paths.
2. Restate what it believes I'm asking, plus what it believes I don't want. Wait.
3. Ask questions in themed rounds, within budget, only where the answer changes the
   output. Scope-check first: if the prompt describes several independent subsystems,
   say so immediately and help split rather than spending the budget refining something
   that needs decomposing.
4. Produce at least three approaches, with a mandatory floor:
   - one requiring no new code
   - one changing no data model
   - one solving ~60% of it
   Record why each rejected option was rejected.
5. Write the spec contract. Self-review before presenting: placeholders, contradictions,
   vague language, unlabelled inferences.

### Prohibitions

- No design, no file layout, no code, no task breakdown
- Does not hand off to anything except the plan skill
- Does not accept "this is too simple to spec" as a reason to skip — either it's below
  the ceremony threshold (say so and exit) or it gets a spec
- Does not invent requirements to fill a gap

### Exit condition

It can answer: *what would make this the wrong problem to solve?* If it can't, it isn't
finished.

### Spec contract shape

```yaml
id: 2026-08-08-batch-retry
state: drafted            # drafted | signed-off | killed
outcome: "Failed batches retry automatically; no duplicate side effects."
kill_criterion: "If retry requires changing the job store schema, stop and re-scope."
rigour: lite              # lite | full
non_goals:
  - "Not changing dead-letter alerting."
inferences:               # each needs sign-off before the plan skill may rely on it
  - claim: "Batches are idempotent by batch_id."
    basis: observed
    evidence: src/Jobs/JobRunner.cs:88
    signed_off: false
unresolved: []            # non-empty blocks sign-off
requirements:
  - id: R1
    text: "A batch that fails twice is retried once, then dead-lettered."
    provenance: stated
alternatives_rejected:
  - approach: "Rely on the queue's native redelivery."
    reason: "No cap on attempts; cannot express dead-letter after N."
```

---

## 3. Plan skill

**Input:** a signed-off spec contract. Refuses to run on one that is unsigned or has a
non-empty `unresolved` list.

**Output:** a plan contract at `docs/plans/<slug>.md`.

### Obligations

1. Read the spec contract and the repo. Nothing else.
2. Run the verify command on a clean tree; record the baseline.
3. Pin shared decisions before writing tasks.
4. Decompose into tasks satisfying §1.3.
5. Self-validate against the checklist and report which items it could not satisfy and
   why. Silence is not a pass.

### Prohibitions

- **May not invent requirements.** If it needs something the spec contract lacks, it stops
  and asks. Non-empty `unresolved` blocks approval.
- No implementation code, no test bodies (assertions and test names, yes)
- No architecture rationale (belongs in the spec contract or an ADR)
- No alternatives considered (that decision was made upstream)
- No estimates presented as commitments
- Does not mark itself approved

### Plan contract shape

```yaml
id: 2026-08-08-batch-retry
state: planned            # planned | in-progress | review | evaluating | done | killed
spec: docs/specs/batch-retry.md
outcome: "Failed batches retry automatically; no duplicate side effects."
kill_criterion: "If retry requires changing the job store schema, stop and re-plan."
baseline:
  command: "dotnet test"
  result: pass
  duration_s: 42
  commit: a1b2c3d
budget:
  new_dependencies: 0
  new_abstractions: 0
  new_public_surface: 0
unresolved: []
pinned_decisions:
  - "Policy type name: RetryPolicy. Namespace: App.Jobs."
  - "Dead-letter signalled by returning DeadLetter, not by throwing."
escalate_if:
  - "Retry requires a schema or migration change."
  - "Existing tests must be modified to pass."
amendments: []            # append-only, each with reason

tasks:
  - id: T1
    type: behavior-preserving
    goal: "Retry policy is a separate unit, callable without a live queue."
    satisfies: [R1]
    scope: [src/Jobs/RetryPolicy.cs, src/Jobs/JobRunner.cs]
    forbidden:
      - path: src/Data/**
        reason: "Strangler boundary; no data-layer change in this plan."
    proves: existing
    existing_tests: ["Jobs.JobRunnerTests"]
    verify: "dotnet test --filter Category=Jobs"
    review_focus: ["no new dependencies", "no writes under src/Data"]
    depends_on: []
    attempts: []

  - id: T2
    type: behavior-change
    goal: "A batch failing twice is retried once, then dead-lettered."
    satisfies: [R1]
    scope: [src/Jobs/RetryPolicy.cs, tests/Jobs/RetryPolicyTests.cs]
    criteria:
      - "Two consecutive failures → exactly one retry attempt."
      - "Third failure → returns DeadLetter; original not re-enqueued."
    proves: new
    test: "tests/Jobs/RetryPolicyTests.cs::RetriesOnceThenDeadLetters"
    verify: "dotnet test --filter RetryPolicyTests"
    evaluate_by: "Enqueue a failing batch via scripts/seed-failing-batch.sh; assert dead-letter table has one row."
    review_focus: ["criteria are asserted, not approximated"]
    depends_on: [T1]
    attempts: []
```

---

## 4. Why the plan contract looks like this

It exists to be consumed by **implement → review → evaluate**, where each stage runs in a
fresh context and none of them has seen the planning conversation.

- **Implement** takes one task. `scope` and `forbidden` bound it; `criteria` tell it what
  to assert; `verify` tells it exactly how to check itself; `baseline` lets it distinguish
  its own breakage from pre-existing breakage. It shows the test failing before
  implementing — "show me red first" is forgery-resistant in a way that "did you write
  tests" is not. On hitting anything in `escalate_if`, it stops.
- **Review** reads the diff and asks: correct, and inside the plan? `review_focus` gives
  it specific falsifiable checks instead of "is this good", which is the difference between
  signal and noise.
- **Evaluate** asks a different question: did `outcome` actually happen? It reads
  `evaluate_by` and the running system — **not the diff**. If it reads the implementation
  it grades the work against the plan rather than against reality.
- **Loop-back is bounded.** First failed evaluation → back to implement. Second → back to
  plan (the plan was wrong). Third → back to the spec contract (the premise was wrong).
  Three strikes and the item is closed, not fixed. `attempts` carries the count. This is
  the only mechanism in the system that can kill a bad idea after work has started.

Corollary: whoever writes the test controls the criterion. That's why criteria are
assertions with concrete values rather than statements of intent — otherwise the
implementer writes a test that passes rather than a test that proves.

---

## 5. Not in scope yet

Named so they are neither forgotten nor accidentally solved twice:

- The evaluate stage itself (a self-recording verify recipe is the intended primitive)
- The strike counter as enforcement rather than a field
- The validator script — target: mechanical checks for most of §1.3
- Learning capture: a written record after each item that the next brainstorm reads
- The ceremony threshold: which changes skip this entirely. **Decide before the first
  time I resent following it.**

---

## 6. Acceptance tests for the skills

The skills are done when these pass, not when they read well.

1. **Hostile handoff.** Fresh session, zero context, one task from a produced plan. Every
   question it asks and every place it improvises is a missing must-have. Run on the first
   three plans.
2. **Retrospective fit.** Generate a plan for work already completed; compare to what was
   actually done. Where the plan is silent is where an agent would have guessed.
3. **v1 exit criterion.** A fresh agent completes a `behavior-change` task from the plan
   alone, no questions, diff lands inside `scope`, `verify` green. Twice, on unrelated
   tasks.

---

## 7. Authoring constraints

- `SKILL.md` per skill, YAML frontmatter with `name` and `description`. The description is
  the trigger mechanism — state what it does *and* when to use it, and lean pushy, since
  under-triggering is the common failure.
- Keep each `SKILL.md` under ~500 lines. Past that, split into `references/` with explicit
  pointers on when to read each file.
- Put the checklist and banned-word list in `references/`, not inline — they're long and
  only needed at write time.
- Deterministic checks go in `scripts/`, not prose.
- Expect v1 to be too long. The tightening pass after the first hostile handoff is where
  most of the quality shows up.
