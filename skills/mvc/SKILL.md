---
name: mvc
description: Initiate a minimal viable change by grilling the user down a design tree until its shape is settled - what ships, what does not and why, and what each decision ruled out. Writes the settled shape to one file on request, so it survives the conversation.
disable-model-invocation: true
---

# mvc

Grill the user down a design tree until the shape of a minimal viable change is settled: what
ships, what does not and why, and what each decision ruled out. Ask greedily by information gain -
the question whose answer prunes the most - then re-derive the frontier.

Touches no git. Writes no code, plan, or tasks. Writes one file, only on request - see
[Persisting the shape](#persisting-the-shape).

## Invariants

1. **No citation, no claim.** Every determination carries provenance: `file:line`, the user's
   answer, or a primary-source URL. General framework knowledge is not provenance, and a citation
   proving something adjacent is worse than none - it makes a guess look checked. A provisional
   entry satisfies this by citing the settled material it follows from.
2. **The grill proposes, the user decides.** It never settles the shape, admits an item, or rules
   on a risk on the user's behalf.
3. **Settled is closed.** Reopening requires new information. Idempotent: re-invoked on a settled
   shape, it asks nothing and goes straight to the report or the file.
4. **Hard timebox: three rounds** - so that "we'll decide later" costs something. The user may
   lower it; the grill never raises it. Unspent rounds are not owed. "The budget" below means
   whatever the timebox currently is.
5. **Append-only, stable IDs.** Questions keep their numbers; a retired number is never reused.
6. **Nothing leaves untyped.** Every open item exits as a boundary, a deferral, or the split
   signal.

## The grill

### Round 0 - discovery

Fill what the conversation and repo already determine before asking anything. A question the repo
answers wastes a round.

List candidate questions first, then dispatch one subagent to answer them. Candidates drive the
search - a fixed file list reads what doesn't bear on the change and misses the file that does.
Candidates span:

- what the repo settles;
- what only the user can decide: intent, priority between outcomes, constraints from outside the
  repo, direction the code cannot show;
- risks, prompted by these axes: architecture and mechanism, security, operations and
  maintenance, dependencies and integration. Requirements risk needs no prompt - it already shows
  up as dark.

Axes are prompts only. One that turns up nothing produces no candidate and no line.

Look first for: precedent for the thing being added (kills a branch, not a leaf), the touched code
and its callers, the repo's convention and decision docs, git history for the area, the dependency
manifest, the test setup.

The explorer returns, per candidate, the answer with `file:line` or **dark** - looked for, not
found. Absence is a finding. Split a candidate that is both: the constraint the repo imposes is
determined, the requirement it cannot know is dark. Stop when every candidate is answered or dark.

Classify each candidate:

- **Determined (fact)** - with provenance. A shape already settled in this conversation is
  determined, its provenance the user's answer: transfer it, never re-derive it.
- **Provisional (assumption)** - a stated assumption inferred from settled material (the outcome, a
  user answer, a cited determination), reported with what it follows from. Silence accepts it, a
  word corrects it. Use this instead of a question whenever the answer is predictable. One
  provisional entry is never provenance for another - that is a guess with a paper trail.
- **Dark (unknown)** - looked for, not found; it becomes a question.

Invent nothing. A guess must never be indistinguishable from a decision the user made.

Web: only for a verifiable external fact a candidate turns on - a platform capability, an API
shape, a version. Primary sources only: vendor docs, the package's own stated requirements, spec
text. Two searches per candidate; no primary source means dark. Never for approach comparison or
best practice - the user owns the stances.

Report the map before round 1: **determined**, **provisional**, **ruled out**, **dark**,
**risks**. Corrections are volunteered and off-budget.

**Risk register.** One line per risk: the risk, its provenance, what it would open. No stance, no
body, no likelihood/impact scoring. The user rules one of two dispositions on each:

- **pursue** - raises the ranking of every question hanging off it;
- **decline** - prunes them, and records the risk as a non-goal typed the way it was declined: a
  boundary when outside the change's shape, a deferral when real and parked.

A risk a stance creates mid-grill is appended to the same register and ruled the same way. One
register, never two.

Silence is not a ruling. An unruled risk is handled like an unanswered question (below): ask once
why, then it stays open. Still unruled at close, it takes exit 1 or 3 of
[Exhaustion](#exhaustion) - never a deferral, which would decline it on the user's behalf.

### Rounds 1 to 3 - ask, re-derive

Each round is one batch of up to **four** questions, asked together, answered together. Minimum
two - except a final single question, when it is all the frontier holds. A round is spent when
asked, however many answers come back.

**Orthogonal.** No answer may change whether another question in the same batch is worth asking.
When in doubt, hold it back.

**Ranking.** Greedy by information gain: branch-pruning beats leaf-closing, and a question
hanging off a pursued risk can win a slot it would not win on pruning alone. Zero-gain questions -
rule nothing out, or have a predictable answer - are never asked. A round that can only muster
those means the frontier is closed.

**Open, not asked.** A branch-pruning candidate the batch could not hold gets one title-only line
under the round. The user promotes or closes it; unaddressed, it stays listed. Leaf-closing
overflow is dropped silently. The list is never its own section in the report - at close, each
entry takes an exhaustion exit, usually a deferral.

**Unanswered is not accepted.** In the reply reporting the round, ask once why a question was
skipped: unclear means clarify and re-ask within the round (off-budget); premature means it stays
open; don't-care means the stance stands. Silence to that: carry it, move on, never withhold the
round's other answers. Re-ask verbatim - a reworded question is a different question.

**Withdrawn or standing, never replaced.** No `replaces Qn`. A withdrawal names its cause: an
answer in the same batch killed it (report it as an orthogonality failure); a new fact reframed it
(the frontier working); or it was worded badly. Withdrawal is free. A successor is a new question
with a fresh number, competing for a slot like any other.

### The question format

Plain text, one block per question, never a picker - "you are asking the wrong thing" must be as
easy to type as an answer.

```
❓ **Q1** — **Per-environment policy**: Does the CSP value need to differ between staging
and production?

➡️ **Stance**: No — one string from an env var, no code difference. Staging and production
serve the same routes from the same bundle.
   **Rules out**: per-env code branches, and any policy registry.
```

- **Stance** - a strong opinion, weakly held, reasoning inline. Never a recommendation: the cheap
  response to a recommendation is agreement, to a stance an argument - and the argument is what's
  wanted.
- **Rules out** - what agreeing costs.
- **Atomic** - one decision per question. A stance needing "and", or a Rules out covering half of
  it, is two questions. The ceiling counts decisions, not blocks.
- **Open-ended** - no option lists; options plus a stance is a ballot with a box pre-marked, and
  a freeform counter is what surfaces the option neither side listed. Enumerate only a genuinely
  closed answer set, and then the stance is a ranking.
- One short paragraph per body.

Clarification is off-budget and unlimited. Asked why a stance holds: the evidence, what it
assumes, what would make it wrong - never restate it louder. Asked what a question means: answer
plainly and drop the stance until it lands. A question back is not a vague answer.

### Pushing back

- **Reopened decision** - ask what changed. Nothing changed, it stays closed.
- **Contradicting answers** - name both, ask which wins. Never quietly take the later one.
  Off-budget.
- **Widening answer** - through change control ([Widening](#widening)), or a non-goal. Never
  quietly into what ships.
- **Better option** - disagree and commit: say which and why, once; then it's the user's call and
  a reaffirmed decision is closed. "Once" caps volunteering - pressed, explain fully.
- **Weasel words** ("probably", "some kind of", "we'll see") - ask the narrower question, or name
  what deferring blocks and let the user rule. An accepted defer is recorded then as a deferral.

### Exhaustion

No extra round. At close - frontier closed or budget spent - each surviving question, listed
candidate, or unruled risk takes one exit:

1. The user answers it off-budget - volunteered, not asked. For a risk, the answer is its ruling.
2. It becomes a deferral with its reason. Never for a risk: that is declining it for the user.
3. Neither: the change is too big to define within the budget. Report that and propose how to
   decompose it. The split signal is the most valuable output - never raise the ceiling to avoid
   it.

## Widening

Scope creep under change control. Anything entering the shipping set after round 1 is stated as a
widening: what it is, where it came from, why the outcome is unreachable without it (not "better
with it"), and what it rules out. The same statement flags if it competes with a pattern already
in the repo, adds a dependency, or challenges the architecture.

Argue it once; the user decides; a rejected proposal is closed. Never admit one on the grill's own
reasoning, and never withhold one because the idea wasn't the user's.

## What ships, what does not

- **Ships** - necessary conditions only. Deletion test: remove the item and the outcome no longer
  holds. Merely slower, uglier, or less pleasant without it makes it a non-goal.
- **Non-goals** - one list from the start, every entry typed:
  - **boundary** - never this change, and the line that separates them. Prunes the branch and
    every question hanging off it.
  - **deferral** - not now, and why. Parks the item; its subtree stays alive.

  Untyped is an omission, not a non-goal. The list stops relitigation - leave out what nobody
  would have asked for.
- **Rejected alternatives** - every decision names what it ruled out. One list, three places: a
  question's **Rules out**, the map's **ruled out**, and the decision log's rejected alternatives.
  A decision that rules nothing out is a description: "we will write tests" rules nothing out;
  "tests go in the existing suite, not a new harness" rules out a new harness.

## Reporting the shape

First, one check on the closed set: has any shipping item become redundant given the rest? Nothing
else is re-examined - everything else was settled on entry.

Then the shape, as spec-ready frontmatter plus body, so a consumer copies rather than translates:

```yaml
---
outcome: <one sentence - what is true once this ships>
requirements:
  - <something the outcome needs>
non_goals:
  - item: <what is not being built>
    type: boundary | deferral
    reason: <the line that separates it, or why not now>
approach:
  - <a mechanism chosen>
constraints:
  - <a limit the mechanism must respect>
touchpoints:
  - <path/to/file.ext:symbol>
---
```

The reported block has no comments and no unfilled placeholders - it is copied verbatim.

- `outcome` is the one scalar. Every other field is a collection; an empty one is a statement, not
  an omission.
- Problem space vs solution space. `outcome`, `requirements`, `non_goals` are the what;
  `approach` (mechanism chosen), `constraints` (limits on it), `touchpoints` (files and symbols it
  lands on) are the how. A stance naming a file, symbol, technology, or value is how - never a
  requirement.
- `type` is explicit on each non-goal: it decides whether reopening one is a question or a mistake.
- Risks have no field. A ruled risk lands as a constraint, a typed non-goal, or an accepted cost
  (tolerated, not mitigated) recorded in the decision log with what tolerating it costs. A pursued
  risk that changed nothing is dropped; a declined one is always recorded as its non-goal. An
  unruled risk is never carried.

The body under the frontmatter is the decision log, ADR-style but only three parts per decision:
the decision, its rejected alternatives, its provenance. Not optional, not a summary - it is the
only record of the pruned branches. A provisional entry that reached the close uncorrected keeps
its label: silence accepted it, the user did not decide it.

## Persisting the shape

Only on request, and only once the frontier is closed. Asked earlier: name the open questions and
write nothing.

Path, first match on the argument (read off the argument, not the filesystem):

- ends in `.md`, with a separator - that filepath
- ends in `.md`, no separator - that filename in `<dir>`
- anything else - a directory: `mvc-<slug>.md` in it
- nothing - `mvc-<slug>.md` in `<dir>`

`<dir>` is `.scratch` in the repo root when it exists, else the system temp directory. `<slug>` is
two to four kebab-case words from the outcome.

Then fail closed, in order. Each check that fails says so and stops - never falls through to
another case. Stopping is free: the shape is still in context and re-invocation asks nothing.

1. The resolved directory must exist. No `mkdir`: a missing path is a typo.
2. Never clobber. An existing file is replaced only if it is itself a shape file - frontmatter
   with the reported fields. Otherwise name it and stop.

Report the absolute path written.

The file is the report, verbatim - no approval, round count, frontier, or anything the report
lacks. Same outcome resolves to the same name and replaces it; a different outcome gets a new
file. Export, not state: nothing reads a shape file back, round 0 included.

## Checklist

Beyond the invariants:

- Asks nothing the repository already answers.
- Reports every provisional entry with the material it follows from.
- Never takes the later of two contradicting answers without naming both.
- Max four orthogonal, atomic questions per round; never pads a batch with zero-gain questions.
- Never rewords a re-ask, reserves a slot for an unanswered question, or replaces a question.
- Lists branch-pruning overflow instead of discarding it.
- Stances are argued, never recommendations, never paired with option lists.
- Carries no risk the user has not ruled on. A ruled risk lands as a constraint, a typed
  non-goal, or an accepted cost - or is dropped if pursued and it changed nothing. Never drops a
  declined risk. Names no empty risk axis.
- Nothing enters what ships after round 1 without a widening statement.
- No how-stance reported as a requirement; no web search for approach or best practice.
- No weasel words in the outcome or in what ships.
- No file unasked or before the frontier closes; nothing in it beyond the report; no comments or
  unfilled placeholders.
- Fails closed on a missing directory or a non-shape file; never reads a shape file back.