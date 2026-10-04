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
2. **The grill proposes, the user decides.** It never settles the shape, admits an item, or declines
   a risk on the user's behalf.
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
  word corrects it. Use this instead of a question whenever the answer is predictable and the
  item is a two-way door. A one-way door is never provisional: predictable or not, it becomes a
  question, because silence must not settle what is costly to undo. One provisional entry is never
  provenance for another - that is a guess with a paper trail.
- **Dark (unknown)** - looked for, not found; it becomes a question.

**Doors.** Mark each candidate that decides something costly to reverse once shipped as a
**one-way door**, with provenance for why: a public route or API shape, a persisted column or
type, a contract another service consumes, a dependency others will build on, a data migration.
Everything else is a two-way door and carries no mark. A door mark is a determination like any
other: without provenance it is provisional, and the map reports it so. A door the repo already
determines (the route is live, the column exists) stays determined; the rule applies only to what
the grill would otherwise infer.

Invent nothing. A guess must never be indistinguishable from a decision the user made.

Web: only for a verifiable external fact a candidate turns on - a platform capability, an API
shape, a version. Primary sources only: vendor docs, the package's own stated requirements, spec
text. Two searches per candidate; no primary source means dark. Never for approach comparison or
best practice - the user owns the stances.

Report the map before round 1: **determined**, **provisional**, **ruled out**, **dark**. One-way
doors are marked on their entries; they get no section of their own. Corrections are volunteered
and off-budget.

**Risks ride on decisions.** A risk is never ruled on its own - one decision, one touch. No
likelihood/impact scoring.

- Bears on a dark question: it goes on that question as its **Risk** line, and the answer settles
  it.
- Bears on no question: a provisional entry landing as a constraint or an accepted cost. Silence
  accepts it; silence never declines it. An accepted cost that is a one-way door is never
  provisional: it becomes its own question.
- Would need declining: its own question. Declining drops it from the shape, and that takes the
  user's word - a boundary when outside the change's shape, a deferral when real and parked.

A risk a stance creates mid-grill goes in that stance's **Rules out** - it is a cost of agreeing,
and agreement accepts it as an accepted cost.

### Rounds 1 to 3 - ask, re-derive

Each round is one batch of up to **four** questions, asked together, answered together. Minimum
two - except a final single question, when it is all the frontier holds. A round is spent when
asked, however many answers come back.

**Orthogonal.** No answer may change whether another question in the same batch is worth asking.
When in doubt, hold it back.

**Report the record once.** The map before round 1 is the record: determined facts with their
provenance, provisional entries with what they follow from, what is ruled out. Rounds do not
repeat it. Provenance is shown again only when the user asks for it ("why P2?"), and always
lands in the decision log.

**Questions first.** A round reply opens with its questions. After them come only the changes
since the last reply: entries newly determined, corrected, or withdrawn, one line each. Nothing
unchanged is restated.

**Ranking.** Greedy by information gain: branch-pruning beats leaf-closing. A question carrying
a **Risk** or **One-way door** line can win a slot it would not win on pruning alone. Zero-gain
questions - rule nothing out, or have a predictable answer - are never asked, except a one-way
door: its predictable answer still needs the user's word. A round that can only muster
those means the frontier is closed.

**Open, not asked.** A branch-pruning candidate the batch could not hold gets one line under the
round: the question itself, shortened. The user promotes or closes it; unaddressed, it stays
listed. Leaf-closing overflow is dropped silently. The list is never its own section in the
report - at close, each entry takes an exhaustion exit, usually a deferral.

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
easy to type as an answer. Two forms:

- **Stance** - for a decision whose readings differ in mechanism, structure, or cost, but not in
  anything an input can show.
- **Example** - specification by example: for a decision whose live readings produce different
  observable outcomes for the same input. Use it whenever such an input exists: judging a key
  example is cheaper than arguing a proposition, and the answer is already an acceptance test.

A question that fits both is asked as an example.

```
**Q1.** Does the CSP value need to differ between staging and production?

Stance: No — one string from an env var, no code difference. Staging and production serve
the same routes from the same bundle.
Wrong if: a script or reporting endpoint loads in one environment and not the other.
Rules out: per-env code branches, and any policy registry.
```

The question is the first line, after its number - no title label, no markers before it.
**Risk** and **One-way door** lines follow Rules out, in that order, only when present.

- **Question** - neutral: it reads as answerable either way without the stance. A question worded
  from inside the stance ("Can we just use one env var?") has answered itself before the stance is
  read. Context in it is fact; the argument lives only in the stance. It presupposes only settled
  material - resting on a provisional entry, it restates the few words of it the question needs,
  with its ID. Never a bare pointer the user has to scroll back for.
- **Concrete** - anchored in something the user can check: a route, a caller, an input, a
  number. "How important is latency?" invites "very"; "What is the largest tenant this search
  serves?" invites a fact the decision turns on.
- **Stance** - a strong opinion, weakly held, reasoning inline. Never a recommendation: the cheap
  response to a recommendation is agreement, to a stance an argument - and the argument is what's
  wanted.
- **Wrong if** - the condition that would refute the stance, so the argument has a target. It
  refutes this decision; it never opens a second one.
- **Rules out** - what agreeing costs.
- **Risk** - only when the question bears on one: the risk and its provenance, one line under
  Rules out.
- **One-way door** - only when the decision is costly to reverse: what makes it so, with its
  provenance, one line under Rules out (below **Risk** when both).
- **Atomic** - one decision per question. A stance needing "and", or a Rules out covering half of
  it, is two questions. The ceiling counts decisions, not blocks.
- **Open-ended** - no option lists in the stance form; options plus a stance is a ballot with a
  box pre-marked, and a freeform counter is what surfaces the option neither side listed.
  Enumerate only a genuinely closed answer set, and then the stance is a ranking. An example's
  outcomes are not an option list: they are what the live readings already predict, and
  **Neither** keeps the freeform counter open.
- One short paragraph per body.

Clarification is off-budget and unlimited. Asked why a stance holds: the evidence, what it
assumes, what would make it wrong - never restate it louder. Asked what a question means: answer
plainly and drop the stance until it lands. A question back is not a vague answer.

#### The example form

A key example in Given/When/Then: the question states the Given and the When, each outcome is a
Then.

```
**Q1.** Given one shared CSP string, when staging serves `/checkout` with
`cdn.staging.example.net/pay.js` (production doesn't load it), what happens?

🅰 Then the script is blocked until the host is in the shared allowlist. (one-string reading)
🅱 Then the script loads — staging has its own policy value. (`config/staging.php:14`)

Stance: 🅰 — the staging origin is a config leftover.
Wrong if: QA serves unreleased assets from that host.
Rules out: 🅰 rules out per-env policy values; 🅱 rules out a single string.
One-way door: the CSP header is public.
```

- **One Given/When, two Thens.** A concrete context and event the user can check (a route, a
  payload, a caller, a value) and the outcome under each live reading. A third reading is a third
  Then, never a second When. More than three outcomes means the input does not discriminate.
  Find a sharper one.
- **Outcomes, not mechanisms.** Each Then is what an observer would see: a status, a value, a
  rendered state, a log line. "Uses a registry" is a mechanism; it belongs in a stance question.
- **Each outcome cites its reading.** A short parenthetical after the outcome gives the provenance
  that makes that reading live. An outcome no settled material supports is invented; drop it.
- **Discriminating.** The live readings must disagree on this input. An input where they agree is
  zero-gain, even if it looks concrete.
- **Stance is a ranking.** It names the expected pick with its reasoning, and keeps **Wrong if**.
  **Rules out** lists what each outcome costs.
- **Four answers.** A pick of one outcome settles it. **Neither** states the right outcome, which
  settles the example and usually opens a reading nobody listed. **Either** means the divergence
  does not matter: it is recorded as a deliberate non-constraint and rules out pinning a test on it.
- **Risk** and **One-way door** lines work as in the stance form.

### Pushing back

- **Reopened decision** - ask what changed. Nothing changed, it stays closed.
- **Contradicting answers** - name both, ask which wins. Never quietly take the later one.
  Off-budget. An answer contradicting the repo is the same: cite the `file:line`, ask which wins.
- **Widening answer** - through change control ([Widening](#widening)), or a non-goal. Never
  quietly into what ships.
- **Better option** - disagree and commit: say which and why, once; then it's the user's call and
  a reaffirmed decision is closed. "Once" caps volunteering - pressed, explain fully.
- **Weasel words** ("probably", "some kind of", "we'll see") - ask the narrower question, or name
  what deferring blocks and let the user rule. An accepted defer is recorded then as a deferral.

### Exhaustion

No extra round. At close - frontier closed or budget spent - each surviving question or listed
candidate takes one exit:

1. The user answers it off-budget - volunteered, not asked. On a question carrying a **Risk** line,
   the answer settles the risk.
2. It becomes a deferral with its reason. Never for a question carrying a **Risk** line: that is
   declining the risk for the user. A question carrying a **One-way door** line is deferred only on
   the user's word, and the deferral names what it blocks: nothing that lands on the door ships
   until it is decided. That block lands in `constraints`.
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
- Risks have no field. A settled risk lands as a constraint, a typed non-goal, or an accepted cost
  (tolerated, not mitigated) recorded in the decision log with what tolerating it costs. A risk
  whose answer changed nothing is dropped; a declined one is always recorded as its non-goal. An
  unsettled risk is never carried.
- A settled example lands in `requirements` as `given <context>, when <event>, then <outcome>`:
  observable, so problem space, and copyable into an acceptance test as written. An **Either**
  answer lands in the decision log as a non-constraint with the input it covers. The rejected
  outcome is that decision's rejected alternative.

The body under the frontmatter is the decision log, ADR-style but only three parts per decision:
the decision, its rejected alternatives, its provenance. Not optional, not a summary - it is the
only record of the pruned branches. A provisional entry that reached the close uncorrected keeps
its label: silence accepted it, the user did not decide it. A decision on a one-way door keeps
its mark in the decision log, so a reviewer can see which entries cost most to reopen.

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
- Questions are neutral, concrete, and presuppose nothing unsettled; stances are argued, never
  recommendations, never paired with option lists, and always carry a Wrong if.
- Asks as an example whenever an input discriminates the live readings; every outcome is observable
  and cites the reading it follows from.
- Marks one-way doors with provenance in round 0; never makes one provisional (a dark item or an
  accepted cost), never lets pruning alone crowd one out, and never defers one without the user's
  word.
- Opens each round with its questions; reports the record once and only deltas after; restates
  what a question rests on instead of pointing to it; puts nothing before the question but its
  number.
- Rules no risk on its own: it rides on a question, a provisional entry, or a stance's Rules out.
  Silence never declines one, and a question carrying a Risk line is never deferred. A settled
  risk lands as a constraint, a typed non-goal, or an accepted cost - or is dropped if its answer
  changed nothing. Never drops a declined risk. Names no empty risk axis.
- Nothing enters what ships after round 1 without a widening statement.
- No how-stance reported as a requirement; no web search for approach or best practice.
- No weasel words in the outcome or in what ships.
- No file unasked or before the frontier closes; nothing in it beyond the report; no comments or
  unfilled placeholders.
- Fails closed on a missing directory or a non-shape file; never reads a shape file back.