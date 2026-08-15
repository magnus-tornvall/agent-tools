# The implementation loop: research, analysis, three designs

What the downstream half of `mise-en-place` should look like. Three designs, not one, because
the loop's organising principle is a genuine choice and the three choices below are not
variations of each other.

**Scope.** This document is research and design. It implements nothing. Sections 1–5 propose no
change to `mise-en-place` or `HANDOFF.md` — every design there is built so it does not need one,
and §2.3 names what a loop would want that the handoff does not give it. Section 6 is the one
exception and says so: a budget is a judgement only the user can make, at a gate only
`mise-en-place` owns, so it adds one optional field. A loop reading an artifact without it falls
back to a declared default.

**On the citations.** External sources were reached through search. The network in this
session blocks direct fetches of arxiv.org and anthropic.com, so the numbers below are as
reported in search summaries of abstracts, not read out of full papers. Treat them as
directionally load-bearing, not as figures to quote onward. Sources are listed at the end.

---

## 1. What makes an implementation loop succeed

Ten findings. Each one is a constraint on any design in section 4.

### F1. Truth comes from execution, never from narration

The dominant failure of autonomous loops is not writing bad code. It is reporting that work
succeeded when it did not. Characterisations of "false success" put it at 45–48% of failures in
single-control τ²-bench domains and 75.8% among AppWorld self-assessing coding-agent
trajectories that make an explicit status claim. The mechanism is not deception: completion
language is part of the output distribution regardless of repository state.

The consequence is structural, not a prompting problem. **Any loop that advances on the
implementer's word has no gate.** A verifier that reads the transcript for "tests passing" is
reading the same distribution that produced the error. The gate has to be an exit status, or a
read of the world by something that did not write the diff.

`mise-en-place` already encodes this: `verify` decides "truth by exit status", and the reason
it is a literal copy-pasteable command with no placeholders is that a command with a `<...>` in
it cannot be run by a gate.

### F2. A recorded baseline is what separates "I broke it" from "it was broken"

Without a baseline captured on a clean tree immediately before work starts, the loop cannot
attribute a red suite. It then either fixes pre-existing failures it was never asked to fix, or
concludes its own breakage is ambient. This repository's own earlier design doc called it "the
highest-value single item" in the plan contract, and `HANDOFF.md` correctly moved it from
design time to loop startup — a baseline taken when the change was planned is stale by the time
the loop runs.

### F3. Red-before-green is forgery-resistant; "did it write tests" is not

An empirical study across six models on SWE-bench Verified found that resolved and unresolved
tasks show *similar* test-writing frequencies; that agent-written tests skew to
value-revealing print statements rather than assertions; and that prompt-induced changes in
test volume do not significantly change outcomes. One high-scoring model writes almost no
tests.

So test *production* is a process style, not a signal. What carries signal is a named check
**observed failing before the change and passing after**. `mise-en-place` gets this exactly
right in an unusual way: `verify_result` is recorded at design time, before any code exists, and
a `pass` there is treated as suspicious — either the task is a no-op or the check does not test
the change. That is the cheapest forgery detector in the system, and it fires before the loop
burns a run.

### F4. State must live outside the model's trace

Long-horizon failure taxonomies converge on the same three: goal drift, compounding per-step
error, and context-limit pressure — where an agent either degrades sharply past a context
utilisation threshold or terminates early and reports partial progress as success. The
architectural answer in the literature is not a larger window: it is a persistent, resumable
memory substrate outside the autoregressive trace, plus compaction, structured note-taking, and
sub-agent isolation.

`mise-en-place`'s "state lives in the artifact, never in the conversation" is this finding,
stated as a design rule. A loop that keeps its position in the conversation inherits every
failure the artifact was built to avoid.

### F5. Position must be *discovered*, not *remembered*

The corollary of F4, and the one most often missed. It is not enough that state is on disk; the
loop must derive where it is by reading the world, every time. `mise-en-place` step 1 —
argument, then match on disk, then create, never derive a fresh identity first — exists to stop
the same intent silently opening a second change. The loop has the same hazard one level down:
a loop that assumes it is on task T3 because it remembers finishing T2 will redo or skip work
after any interruption.

### F6. The unit of progress is a bounded, reversible, green step

Error cascades are the failure that makes long runs worse than short ones: one bad step distorts
every subsequent judgement, and recovery gets harder the further it propagates. The mitigation
is a ratchet — bounded steps, a green tree at each boundary, and one revertible commit per step,
so the blast radius of any single bad decision is one revert. `HANDOFF.md`'s "every task leaves
the tree green" is this.

### F7. Stopping correctly is a feature, and it is the hard one

The recurring conclusion across the practitioner writing is that autonomy is not the hard part;
verification, stopping conditions, and escalation are. A loop's quality is mostly determined by
what it refuses to do.

`plan.escalate_if` is the best-designed hook in the whole artifact, because it is the mechanism
that carries *design-time* uncertainty into *runtime* stopping. The `open_questions` rule makes
this explicit: a question that cannot be answered until code is touched converts into an
`escalate_if` entry. That is a genuinely good idea and every design below leans on it.

### F8. The writer is the worst reviewer of its own work

The decisions register in the earlier research doc states it flatly: "a model that wrote the
code is the worst reviewer of it", and mandates one state transition per invocation with fresh
context. The independent-auditor pattern shows up in the long-horizon literature the same way —
a Manage/Execute/Audit split where the auditor verifies environment changes with read-only
tools rather than reading the executor's account of them.

### F9. The scaffold matters; the toolkit mostly does not

Ablations on SWE-bench Verified found that restricting an agent to basic bash/read/write/edit
changed performance surprisingly little, while context management and error guardrails produced
substantial, quantifiable gains. Practical reading: **spend the design budget on what the loop
reads, when it stops, and how it recovers — not on inventing tools.**

### F10. All tasks done is not the change works

Per-task checks grade the implementation against the plan. Something has to grade the change
against reality, and it must not read the diff to do it. `plan.acceptance` is that slot ("one
command deciding whether the change as a whole works, distinct from any task's `verify`"). The
earlier design had a stronger version — `evaluate_by`, non-diff evidence from a running system —
which did not survive. Where `acceptance` is empty, the loop has no outcome check at all, and
that is a state the loop should notice rather than shrug at.

---

## 2. `mise-en-place`, analysed

### 2.1 What it gets right

**One shape per invocation.** Find state → synthesize → validate → report → gate. The same five
steps whichever phase the change is in. This is what makes it re-enterable after total context
loss, and it is the property a loop must copy rather than admire.

**It forces the artifact and nothing else.** The refusal to interview is the single most
important architectural decision in the skill, and it is what makes the system composable at
all. By naming the gap and stopping, it leaves the gap-closing *mechanism* pluggable — a
conversation, a hand-edit, a `grilling` skill, another agent. Everything downstream inherits
this: the loop should likewise force an outcome and leave the method open.

**Evidence discipline is deliberately not machine-checked.** The rationale given — that a script
can verify a field is *filled* but never that it is *true*, and a checkable-but-meaningless slot
converts "I must be able to defend this" into "fill the slot" — is a correct and unusually
well-stated Goodhart argument. Most spec-driven toolchains lose exactly here, adding a
`provenance:` enum that becomes a formality. The compensating control is that provenance is
shown to the user at approval time, so the user's audit *is* the enforcement.

**The script/prose split has a stated criterion.** "A check earns a place in the script only when
a wrong answer is mechanically decidable", plus the explicit warning that the pull is always
toward making the script check more, and followed all the way it turns the gate into a
checklist. That paragraph is the reason `validate.ts` has stayed 350 lines instead of 530.

**Gate integrity is checked in both directions.** An approval standing under a revoked one, and
a `phase` set past a gate never given, are both exit 2. The fix for the second is specified as
"set `phase` back", never "supply the approval". A loop that inherits this posture will not
approve on the user's behalf either.

**Atomicity where interruption is plausible.** Approval and phase advance land in one edit
because the two halves are each a defect alone. This is the same reasoning a loop needs for
"task done" versus "commit made".

**Duplicate prevention before creation.** Step 1's ordering (F5) is the sort of thing that only
gets written after being bitten by it.

**The three exits for `open_questions`.** Answered, blocks, or becomes `escalate_if`. No fourth
exit, and the recent commit closes the "not stateable as a question" hole by routing it to the
report rather than inventing a fourth. This is the cleanest seam in the artifact and the loop's
most valuable inheritance.

### 2.2 The load-bearing commitments a loop must not break

Three, and they are philosophical, not mechanical:

1. **The artifact is the only memory.** Anything a future reader needs is on disk.
2. **The user is the only approver.** No component promotes its own work.
3. **A gap is reported, never filled.** Invention is the one failure the whole design exists to
   prevent.

A loop design that violates any of these is not a continuation of this system; it is a different
system stapled to it.

### 2.3 Where a loop hits friction

These are not defects in `mise-en-place`'s own job. They are the places where the handoff, read
as a loop specification, comes up short. Each design in section 4 says how it copes without
requiring a change here.

**G1. The loop has nowhere to write its own state.** `HANDOFF.md` allows exactly two writes:
`status: todo → done`, and one `baseline` block. But the same document says the loop stops
after "a task's `verify` fails twice in a row" — and there is nowhere on disk to record that it
failed once. So the strike counter lives in the conversation, which is precisely the thing the
whole architecture forbids (F4). A loop that crashes between attempt one and attempt two resumes
with a clean slate and will keep failing forever, or escalate too late. This is the sharpest
finding in this analysis: **the artifact demands that state be durable and then denies the loop
any durable place to put it.**

The earlier design had the missing fields — `attempts: []` per task, an append-only `amendments`
list — and they did not survive the rewrite. Their absence is what G1 is.

**G2. `status` has two values and a task has at least three states.** `todo | done` cannot express
"started, tree dirty, not finished" or "escalated, waiting on the user". An interrupted loop
sees `todo` and restarts a half-applied task; a stopped loop has to explain its position in
prose that nothing reads.

**G3. Nothing at design time flags "this change is not autonomously executable."** A change can
pass every gate with several tasks at `verify_result: unrun` — legitimate individually (a
booted service, a migration) — and then the loop's very first honest act under `HANDOFF.md` is
to stop on each of them. The approval gate would benefit from knowing that, but there is no
field where the answer lives, and no reason `mise-en-place` should acquire one. So the *loop*
should compute it up front rather than discovering it task by task.

**G4. Risk ordering is unspecified, so `kill_criterion` fires late.** Tasks execute in
`depends_on` order. Nothing says the task most likely to invalidate the plan should run first.
A kill criterion that only becomes observable after six of seven tasks is a kill criterion that
never fires. This was a "nice-to-have" in the earlier doc and disappeared; the DAG permits
risk-first ordering, nothing asks for it.

**G5. `acceptance` may be empty, and then nothing grades the outcome.** Legitimate — no single
command decides every change — but the loop then finishes with only the sum of the task checks,
which is exactly the "grades against the plan, not against reality" failure of F10. The script
warns; the loop should treat that warning as a stop-and-say, not a shrug.

**G6. `scope` is advisory; only `forbidden` is enforceable.** By design: the script resolves an
anchor's *path* and not the symbol or line after it, so an anchor can point at nothing and pass.
That is stated honestly. The implication for the loop is that scope enforcement can only ever be
path-level, and "the diff stayed inside `scope`" is a review question, not a check.

**G7. Re-entry requires a human edit, always.** The terminal state is absorbing; getting back to
planning means the user revoking `approvals.plan`. This is correct under commitment 2 and should
not change — but it means the loop has no self-healing path whatsoever, and every design below
must treat "stop and hand back" as the only failure exit that exists.

---

## 3. The composability problem

The brief is a loop that *works off* the `mise-en-place` artifact without *depending on* it. Those
pull in opposite directions unless the dependency is made explicit and thin. Three rules make it
tractable, and all three designs obey them:

**Rule 1 — Depend on a projection, not on a schema.** The loop never reads `change.md` directly.
It reads the output of an intake step whose job is to turn *whatever exists* into the loop's own
minimal shape. `mise-en-place` is then one adapter among several — the best one, because it
supplies every field the projection wants, but not a required one.

**Rule 2 — Degrade by escalating, never by inventing.** A thinner input must produce *more
questions to the user*, not more guesses by the loop. This inherits commitment 3 exactly: the
quality of the input controls the escalation rate, not the correctness of the loop. It also
gives a clean answer to "what happens with a GitHub issue instead of a change directory" —
the loop still runs; it just stops more.

**Rule 3 — Write to your own surface, not to someone else's.** The loop's durable state goes
somewhere the loop owns. Writing back into `change.md` is an *optional adapter*, not the
mechanism. This is what routes around G1 without proposing an edit to `HANDOFF.md`, and it
keeps the loop runnable against an artifact that is read-only, absent, or shaped differently.

The minimal projection every design shares:

```
item := { id, claim, check?, bounds?, stops? }
run  := { baseline, position, attempts, escalations }
```

Everything else — requirement ids, `satisfies`, `approach`, `non_goals`, prose — is *context the
loop may read to do better work*, and nothing the loop may require to run.

---

## 4. Three designs

They differ on one axis each: **what is authoritative.**

| | authority | truth is established by | loop's own state |
|---|---|---|---|
| **A** | the check | running a command | a ledger the loop owns |
| **B** | the repository | a legal state transition | git itself |
| **C** | the disagreement | failure to sustain an objection | a docket of objections |

---

### Design A — "The check is the contract"

**Organising idea.** The loop is a machine for producing evidence, not for producing code. Its
only real input is a queue of falsifiable claims each paired with a command. Every other field
in every upstream artifact is context: loaded opportunistically, never required, and never able
to break the loop by being absent or reshaped.

The invariant is one sentence: **the loop does not implement anything it cannot falsify.**

**Intake.** `loop-intake` projects any artifact into the item shape and reports what it could not
fill — the same synthesize/validate/report posture as `mise-en-place`, one level down. Adapters,
in descending order of how much they supply:

| source | claim | check | bounds | stops |
|---|---|---|---|---|
| `mise-en-place` `tasks/*.md` | `goal` | `verify` | `scope`, `forbidden` | `escalate_if` |
| Spec Kit / Kiro `tasks.md` | checkbox text | — synthesize | — | — |
| a GitHub issue | title + body | — synthesize | — | — |
| a sentence in the prompt | the sentence | — synthesize | — | — |

Where a check is missing, the intake step derives a candidate and **stops for approval** before
any implementation. That is the degradation ladder: thinner input, more approval round-trips,
identical loop.

**Skills.**

- `loop-intake` — project, report the gap, stop. Never implements.
- `loop-step` — one item: confirm the check is red, implement inside `bounds`, confirm green,
  commit. It never marks the item satisfied and never advances the queue.
- `loop-adjudicate` — fresh context, no sight of the implementer's reasoning. Runs the command,
  reads the tree, and is the *only* thing that may record an item as satisfied (F1, F8).
- `loop-accept` — the change-level outcome check, run once, distinct from every item check (F10).

The split between `loop-step` and `loop-adjudicate` is the whole design. Marking work done is
withheld from the party that did it.

**State.** An append-only `run.jsonl` beside the change directory, owned entirely by the loop:
baseline, per-item attempts, check output hashes, escalation records. `mise-en-place`'s files are
read-only to design A. A `--writeback` flag can set `status: done`, and that flag is the only
place the exact contract is touched — remove it and the loop still works.

**Cost of being wrong.** Item-level: one revert. Check-level: worse — a weak check passes and the
loop advances on nothing. Design A's defence is `verify_result: fail` recorded at design time
(F3), which is exactly what `mise-en-place` already provides and exactly what synthesised checks
from thinner sources lack. Against a GitHub issue, this design is only as good as the checks its
intake step got approved.

**Where it stalls.** Work whose value is not mechanically decidable — documentation, a
readability refactor, a UI judgement. Design A has no honest move there except to escalate, and
a change made mostly of such tasks will escalate constantly. That is the correct behaviour and
also an unusable one.

---

### Design B — "The repository is the state machine"

**Organising idea.** There is no loop. There is one skill that answers a single question —
*given the world exactly as it is, what is the one next legal transition?* — performs exactly
that transition, and exits. Running it repeatedly is somebody else's problem: a human typing it
again, a `/loop`, a cron, a CI job.

This is `mise-en-place`'s own architecture applied downstream. It composes **by symmetry rather
than by contract**: both halves of the system are stateless, idempotent, position-discovering
steppers, so the whole thing is one idea instead of two. That is a real and underrated benefit —
the mental model transfers, the failure modes transfer, and the operator learns one thing.

**Intake.** Design B does not parse a contract at all. It *observes*: `git status`, `git log`,
the exit status of the project's check command, and a small pluggable **resolver** whose entire
interface is two functions:

```
next()      -> item | none      # what is the next undone thing?
mark(item)  -> void             # record it as done, however this source records that
```

A resolver over `mise-en-place`'s `tasks/` directory is about fifteen lines. A resolver over a
markdown checklist is five. A resolver over "ask the user which is next" is the fallback, and
it is what a missing resolver degrades to — a question, not a crash (Rule 2).

**The ratchet.** Every transition ends in one of exactly two states: a green tree and exactly one
commit, or a revert. Nothing else is a legal exit. Blast radius is one commit (F6).

**State: git is the ledger.** This is the design's distinctive move and its answer to G1. Loop
state travels in commit trailers:

```
Loop-Item: T3
Loop-Attempt: 2
Loop-Check: npm test -- security.test.ts -t 'sets CSP header'
Loop-Result: pass
Loop-Baseline: a1b2c3d
```

Attempt counts, escalations, and the baseline are recoverable with `git log --grep`. Nothing to
corrupt, nothing to keep in sync with the code, no second source of truth, and `git revert`
rewinds loop state as a side effect of rewinding the work. It also stays trivially inside
`HANDOFF.md`'s "the loop may write exactly two things", because trailers are not fields in the
artifact.

The caveat is real and must be designed for: **squash-merge destroys the trailers.** Mitigations
are a `git notes` ref, or a `run/` directory that the merge keeps, or accepting that loop state
is branch-local and dies with the branch — which is defensible, since a merged change has no
loop state worth keeping.

**Skills.**

- `loop-step` — the single transition. Reads the world, picks the resolver, does one thing, commits.
- `loop-baseline` — the clean-tree measurement, once, at the start (F2).
- `loop-escalate` — the stop path: write the position where a human will find it, and end.
- resolvers live as reference files, loaded on demand.

Four skills, one of which is the whole loop. The surface is the smallest of the three.

**Cost of being wrong.** Low per step and self-limiting: each invocation is fresh, so a bad step
does not poison the next one's reasoning (F4, and the direct counter to error cascade).

**Where it stalls.** Re-deriving the world every invocation is not free — it is the price of
statelessness, paid once per task. Cross-task reasoning is weak by construction; the design has
no natural place to notice "these three tasks are all fighting the same abstraction". And
resolver plurality can become its own mess if resolvers start acquiring opinions instead of
answering two questions.

---

### Design C — "Two parties, one gate"

**Organising idea.** Nothing is done because an implementer says so. Something is done when a
second role, whose job is to want it to be wrong, fails to break it. The loop is an adversarial
proceeding, and progress is defined as *the absence of a sustained objection* rather than the
presence of a claim.

This is F1 and F8 taken to their conclusion, and it is the only one of the three designs whose
gate is not ultimately a command.

**Intake — the interesting part.** Design C does not read the artifact as instructions. It reads
it as **prior testimony**: the record of what was already decided and by whom. The implementer
cites it in defence of what it did; the challenger mines it for objections. What follows is the
property that makes this design composable in the strongest sense:

> A thinner artifact does not make the loop wrong. It makes the challenger's objections broader,
> so more of them escalate to the user. **The quality of the input controls the escalation rate,
> not the correctness of the loop.**

With a fully approved `mise-en-place` change directory, most objections are answerable from
`constraints`, `non_goals`, and `kill_criterion`, and the run is close to unattended. With a
one-line GitHub issue, the same loop becomes an interrogation. Same skills, same rules, no
adapters — the artifact is an input to *argument quality*, not to control flow. Nothing in this
design has a required field.

**Roles as skills.**

- `implement` — writes code, stays in scope, renders no verdict on its own work.
- `challenge` — fresh context; sees the diff, the repository, and the artifact, and never the
  implementer's reasoning. Its output is objections, and **every objection must carry a
  reproduction**: a command to run and the observation that follows. An objection without a
  reproduction is discarded unread. That rule is the entire defence against bikeshedding, and
  without it this design drowns.
- `referee` — cheap and near-deterministic. Counts sustained objections, applies the budget,
  and routes: advance, retry with the objection attached, escalate to the user, or hand back to
  planning.

**The ladder.** First sustained objection → retry, objection attached. Second → stop and ask the
user. An objection that impugns the *plan* rather than the diff → hand back to `mise-en-place`
by telling the user which approval to revoke (never revoking it, per commitment 2 and G7). This
is the three-strikes ladder from the earlier research doc, which is the only mechanism in the
whole system capable of killing a bad idea after work has started.

**State.** A docket: one file per item recording objections, reproductions, and dispositions.
Owned by the loop, adjacent to the change directory, and human-readable — because its real
consumer is the user at the escalation point, who needs to see *what was argued* and not just
that something stopped.

**Cost.** Two to three times the tokens of design A or B, and the challenger's value is
model-dependent in a way an exit status is not.

**What it buys that the others cannot.** It is the only design that handles work whose
correctness is not mechanically decidable — the exact class where design A stalls. And it is the
runtime expression of `mise-en-place`'s own philosophy: a doubt is raised, evidenced, and either
resolved or handed to the user, and it is never resolved by invention.

---

## 5. Surfaces, contracts, and lenses

Section 4 answers *what the loop does*. This section answers two questions it left open: is the
state one artifact all the way through, and how is the contract shared across many skills when
implementation is a broad and specialised skillset — frontend, backend, design, process,
accessibility, optimisation — each of which someone may want to tune separately at implement,
review, and evaluate.

### 5.1 One identity, three surfaces

The state is **not** one artifact with different parts consumed at different times. It is one
*change* written across three surfaces, separated by lifetime and by who may write. Conflating
them is what produces G1.

| surface | holds | written by | lifetime | during the loop |
|---|---|---|---|---|
| **decision** — `change.md`, `tasks/*.md` | outcome, requirements, approach, constraints, scope, checks | `mise-en-place`, gated by the user | the change | **read-only** |
| **run** — `<change dir>/runs/<branch>/`, or git trailers under design B | baseline, position, attempts, verdicts, escalations | the loop | one execution | append-only |
| **findings** — `<change dir>/findings/` | objections with reproductions, measurements, lens output | review and evaluate | outlives the run, may outlive the change | append-only |

What is genuinely constant is the **join key**: the change directory name, the `R` ids, the `T`
ids. Everything references those, and that is the "same throughout" the intuition is reaching
for. Everything else is a different document on a different clock.

The test for which surface something belongs on is **lifetime, not topic**. An attempt count
dies with the run. An accessibility measurement or a performance budget outlives it and should
feed the next change, which is why findings is a surface and not a section of the run log.

**Consequence: the loop can be a pure reader of the decision surface.** Once run state has a
home, `status: todo → done` is a convenience mirror of something the run ledger already knows,
and `baseline` was always run state parked in `change.md` for want of anywhere better. A loop
that writes neither is still inside `HANDOFF.md`, which grants two writes rather than requiring
them. The payoff is that the decision surface has exactly one writer, ever — so no agent output
is ever laundered as an approved user decision, and commitment 2 of §2.2 holds mechanically
rather than by good behaviour.

### 5.2 Sharing the contract across skills

Three layers, in increasing order of enforcement. The split is the one this repository already
believes in: `validate.ts` exists because prose is advisory and degrades with volume.

**Identity, by convention.** Directory name and id prefixes. Nothing enforces it; nothing needs
to.

**Shape, by CLI — not by import.** One `contract.ts` exposing `read | check | record`, invoked
as a command and returning JSON:

```
bun skills/_contract/contract.ts read <change dir>
→ { id, items: [{ id, claim, check, bounds, stops }], acceptance, context }
```

Every stage skill calls it instead of parsing YAML. A CLI rather than a shared module because it
gives no import coupling, no language coupling, and no installation-path fragility — a skill
written for a different agent runtime consumes the same JSON. This is §3's projection, made
executable.

It also versions without a version field: **tolerant reader, strict writer.** `read` ignores
unknown fields and returns null for missing ones; consumers escalate on null rather than
crashing. Reshape `change.md` and the loop degrades to asking more questions, which is Rule 2.

**Judgement, by prose, referenced once.** A single `SURFACES.md` that every `SKILL.md` points at
rather than restates, loaded at level 3 of progressive disclosure.

The guard is `mise-en-place`'s own posture: nothing can *prevent* a skill from writing the
decision surface directly, so the CLI is the sanctioned path and `validate.ts` exits 2 on a
result that violates it. The script catches what is mechanically decidable; the user catches the
rest.

### 5.3 Breadth: stage, lens, tuning

Six domains across three stages is eighteen skills, which is unmaintainable. The decomposition
that avoids it uses three orthogonal knobs:

- **Stage is the skill.** `implement`, `review`, `evaluate`. Each owns the protocol — what to
  read, what to write, when to stop — and the protocol is invariant across every domain. Three
  skills, and a new one is rare.
- **Lens is a reference file.** `lenses/accessibility.md`, `lenses/backend-performance.md`,
  loaded on demand. A lens contributes exactly three things and never touches the protocol:
  **checks** it adds to the projection, a **review checklist**, and an **evaluate probe**. Adding
  a domain is one markdown file.
- **Model and effort are agent-definition frontmatter.** Separate from both, so retuning which
  model reviews accessibility never means editing a protocol or a contract.

**Lens selection is derived, not declared.** Deriving it from the diff's paths and extensions
avoids adding a required field to the artifact — the moment a task must carry `lens: a11y`, the
loop depends on the exact contract again, against Rule 1. Allow an override, and bias toward
over-selecting: loading the a11y lens on a backend task costs a little context and yields
nothing, while missing it on a frontend task ships a real defect. The cost is asymmetric, so
over-select.

Where the domain knowledge actually earns its keep is worth naming, because it is not where
people expect. **Implementation is more uniform than it looks** — it is bounded by `scope` and
decided by a check. Review and evaluate are where a lens pays, because "did the outcome happen"
is domain-specific in a way that "write the code inside these paths" is not.

---

## 6. Budgets and the stop

Section 4 gives each design a stop condition and leaves two things unresolved: who *enforces*
the stop, and how many attempts the loop is entitled to before the change is abandoned rather
than retried. Both are settled here, and the second is a user decision made at the approval
gate.

### 6.1 Budget is decision state; spend is run state

They are different objects, and conflating them is what makes a budget leak.

- **The budget** — the allowance — is authored and approved by the user at the gate. Decision
  surface. It sits beside `escalate_if`, which is the same kind of thing: runtime control the
  user writes at design time.
- **The spend** — attempts consumed — is run state. Trailers under design B.

Two numbers, and reintroduction is the second:

```yaml
plan:
  budget:
    attempts_per_task: 2     # retries before this item escalates
    replans: 1               # times this change may return to plan before it is killed
```

Exhausting `attempts_per_task` escalates one item. Exhausting `replans` kills the change.

**This gives `kill_criterion` its first runtime trigger.** Today it is a field nobody evaluates —
a sentence written at spec time that no component ever checks. A replan budget makes the kill
procedural, and there are then two kill paths: substantive (the criterion is observed to hold)
and procedural (the change has been re-planned more times than the user was willing to fund).
`kill_criterion` is what the user reads when deciding whether to accept a procedural kill.

`mise-en-place` must not invent a budget any more than any other field. The clean route is a
declared default, shown at the approval presentation, which the user overrides or accepts —
approving *is* setting it.

**Approve time is the moment of least information about execution difficulty.** The user knows
how uncertain the design is, not how hard the code will be, so the budget is a bet on design
uncertainty and not an effort estimate. That is also what a derived default should key off: the
number of `escalate_if` entries and the number of `open_questions` that converted into them. A
change with five converted questions has earned more replans than one with none.

An `open_question` that keeps forcing replans is evidence it was misclassified — exit 3 when it
was really exit 2. Surface that at the kill. It is not a fourth exit.

### 6.2 The loop is not trusted to stop itself

Every stop condition in section 4 is evaluated by the loop, which means a drifting agent can
rationalise past it — and F1 says that is exactly what agents do at the moment of completion. So
the stop becomes a gate the loop passes through, not a decision it makes.

A validator runs at the top of every iteration, mirroring `validate.ts`:

| exit | meaning |
| --- | --- |
| 0 | proceed |
| 1 | nothing to advance — the queue is empty or blocked |
| 2 | stop. Not negotiable, and not repairable by the agent |

What belongs in it is decided by the criterion `mise-en-place` already applies: mechanically
decidable, or it is not a check.

| condition | decided by |
| --- | --- |
| budget exhausted | validator |
| a `forbidden` path appears in the diff | validator |
| tree not green at a task boundary | validator |
| `acceptance` failed with all items done | validator |
| an `escalate_if` prose condition holds | agent judgement |
| `kill_criterion` observed | agent judgement |

**The only way past a hard stop is a new approval** — the user raises the budget and re-approves.
Never the agent deciding it has earned one more attempt. This is the first point at which
commitment 2 of §2.2 is mechanical rather than conventional.

Two mechanics it needs. A forceful stop must finish its revert before stopping, or it breaks the
ratchet and leaves a dirty tree. And exit 2 here means something stronger than in `validate.ts`,
where exit 2 is "fix it and re-run" — the two should not share vocabulary.

### 6.3 When there is no git repository

Design B's ledger is commit trailers, but the reason to choose B was a property, not a
mechanism: state readable by agents and scripts, and no files left in the repo that nobody reads
once the change ships. The property survives without git. State lives where the work lives:

| environment | ledger | dies with |
| --- | --- | --- |
| git repository | commit trailers | the branch |
| no git | a run file beside the work | the work |
| no durable store | session only | the session |

`aos record attempt --item T2` picks the backend; no `SKILL.md` learns which. That is the payoff
of making the contract a command rather than a file format — swapping the ledger is not a
contract change.

The third row is the honest one. With no durable store the budget is best-effort within a
session and a crash resets the spend, so the validator must report that at startup rather than
let the user believe a budget is binding when it is not. A budget that silently does not bind is
worse than no budget.

---

## 7. Comparison

| | A — the check | B — the repository | C — the disagreement |
|---|---|---|---|
| gate | exit status | legal transition + green tree | no sustained objection |
| loop state (G1) | own `run.jsonl` | git trailers / notes | objection docket |
| needs `mise-en-place`? | no — one adapter of several | no — one resolver of several | no — artifact is evidence, not control flow |
| degrades by | asking for checks | asking which item is next | asking more questions |
| answers F1 (false success) | strongest | strong | strongest |
| answers F4/F5 (drift, position) | good | strongest | weak without B underneath |
| answers G2 (task states) | ledger carries it | trailers carry it | docket carries it |
| handles non-mechanical work | badly — stalls | as well as its checks | well |
| token cost | 1× | 1× | 2–3× |
| skills | 4 | 4 (one load-bearing) | 3 + budgets |
| main risk | check theatre | trailers lost on squash-merge | objection spam |

None of the three requires an edit to `mise-en-place` or `HANDOFF.md`, and none violates the
three commitments in 2.2.

---

## 8. Recommendation

**Build B as the chassis. Put A's adjudication inside its step. Hold C in reserve as a tier.**

The reasoning, in order:

1. **B first, because it removes G1 at zero cost to the contract.** Loop state in git trailers is
   durable, revertible, and requires no new field anywhere. It also keeps the whole system one
   idea — a stateless, position-discovering stepper at both levels — which is worth more over
   time than any single feature.
2. **A's split is not optional; fold it in.** Within B's single step, the thing that records a
   transition as complete must not be the thing that wrote the diff (F1, F8). That is one extra
   fresh-context invocation per task and it is where most of the reliability lives.
3. **C is a tier, not a default.** Invoke the challenger on the *second* attempt at an item, and
   on any item whose check is weak or absent. Paying 2–3× on every task buys little on tasks
   where a command already decides the answer; paying it exactly where the command cannot decide
   is the right trade.

Two things to build regardless of which design wins, both from section 2.3:

- **An executability pre-flight** (G3, G5): before the first task, report how many checks are
  `unrun`, whether `acceptance` is empty, and stop if the answer is "this change cannot be run
  unattended". Better to know at minute zero than at task six.
- **Risk-first ordering within the DAG** (G4): among tasks whose dependencies are satisfied,
  take the one most likely to invalidate the plan. It is free — the DAG already permits it — and
  it is the only thing that makes `kill_criterion` fire early enough to matter.

---

## 9. Not in scope here

Named so they are neither forgotten nor accidentally solved twice.

- The disposal question `mise-en-place` already flags: what happens to `<change dir>` when the
  change is done.
- Parallel task execution. Every design above is deliberately serial; the DAG permits fan-out
  and none of this reasoning has been checked against it.
- Learning capture — a written record the next `mise-en-place` invocation reads. It was listed as
  out of scope in the earlier research doc and still is.
- The ceremony threshold: which changes skip all of this. Still undecided, and still worth
  deciding before the first time it is resented.

---

## Sources

Reached by search; direct fetches of arxiv.org and anthropic.com were blocked by this
environment's egress proxy, so summaries were not verified against full texts.

- [From Confident Closing to Silent Failure: Characterizing False Success in LLM Agents](https://arxiv.org/html/2606.09863)
- [Self-Authored Verification Is Unreliable in Heuristic Self-Improving Agents](https://arxiv.org/html/2607.24300v1)
- [Rethinking the Value of Agent-Generated Tests for LLM-Based Software Engineering Agents](https://arxiv.org/html/2602.07900v2)
- [The Long-Horizon Task Mirage? Diagnosing Where and Why Agentic Systems Break](https://arxiv.org/html/2604.11978v1)
- [LongHorizon-Harness: Advancing Long-Horizon Agents for Real-World Tasks](https://arxiv.org/html/2608.01964v1)
- [Where LLM Agents Fail and How They Can Learn From Failures](https://arxiv.org/pdf/2509.25370)
- [Brilliant but Amnesiac: The Coherence Cliff in Long-Horizon AI Agents](https://www.sharadja.in/blog/long-horizon-agents-coherence-cliff)
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [SWE-bench Verified technical report — Verdent](https://www.verdent.ai/blog/swe-bench-verified-technical-report)
- [SWE-Agent scaffold overview — Emergent Mind](https://www.emergentmind.com/topics/swe-agent-scaffold)
- [Agentic Coding Workflow 2026: The End-to-End Loop](https://www.futureproofing.dev/resources/ai-native-team/agentic-coding-workflow-2026)
- [From Assisted to Autonomous: How Far Can the Engineering Loop Close? — Augment Code](https://www.augmentcode.com/guides/autonomous-engineering-loop)
- [Loop Engineering: How to Design Coding Agent Loops](https://explainx.ai/blog/loop-engineering-coding-agents-claude-code-guide-2026)
- [Skill authoring best practices — Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Spec-Driven Development: How Agentic Coding Actually Changes Your Repo](https://agentropic.ai/blog/spec-driven-development-explained/)
