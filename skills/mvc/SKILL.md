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

1. **No citation, no claim.** Every fact carries provenance: `file:line`, the user's answer, or a
   primary-source URL. General framework knowledge is not provenance, and a citation proving
   something adjacent is worse than none - it makes a guess look checked. An assumption satisfies
   this by citing the settled material it follows from. An **uncertain** assumption cites what it
   leans on, or says it has nothing - the mark is what keeps it apart from a decision.
2. **The grill proposes, the user decides.** It never settles the shape, admits an item, or avoids
   a risk on the user's behalf.
3. **Settled is closed.** Reopening requires new information. Idempotent: re-invoked on a settled
   shape, it asks nothing and goes straight to the report or the file.
4. **Hard timebox: three rounds** - so that "we'll decide later" costs something. The user may
   lower it; the grill never raises it. Unspent rounds are not owed. "The budget" below means
   whatever the timebox currently is.
5. **Append-only, stable IDs.** Questions (`Q1…`), assumptions (`A1…`), requirements (`R1…`),
   and decisions (`D1…`) keep their numbers; a retired number is never reused.
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
- what established domain guidance settles: a standard, the vendor's documented recommendation,
  or a recognised catalogue such as OWASP. It is provenance for an assumption, and grounds a
  stance. Where the repo departs from it, the repo is the fact - say so once;
- what only the user can decide: intent, priority between outcomes, constraints from outside the
  repo, direction the code cannot show;
- risks, prompted by these axes: architecture and mechanism, security, operations and
  maintenance, dependencies and integration. Requirements risk needs no prompt - it already shows
  up as an unknown.

Axes are prompts only. One that turns up nothing produces no candidate and no line.

Look first for: precedent for the thing being added (kills a branch, not a leaf), the touched code
and its callers, the repo's convention and decision docs, git history for the area, the dependency
manifest, the test setup, and any prior decision record or shape file the user passed in.

The explorer returns, per candidate, the answer with `file:line` or **unknown** - looked for, not
found. Absence is a finding. Split a candidate that is both: the constraint the repo imposes is a
fact, the requirement it cannot know is unknown. Stop when every candidate is answered or unknown.

Classify each candidate:

- **Fact** - with provenance. A prior decision is a fact with its record as provenance, never
  re-asked: a shape already settled in this conversation, a record or shape file the user points
  to, or one among the repo's decision docs.
- **Assumption** - inferred from settled material (the outcome, a user answer, a cited fact, cited
  domain guidance). Silence accepts it, a word corrects it. Every two-way door is an assumption,
  even when the grill cannot predict the answer; one it could not predict is marked
  **uncertain**. An assumption about an observable outcome is written as
  `given <context>, when <event>, then <outcome>`. It lands in `requirements` when it passes the
  deletion test, otherwise in `approach`, `constraints`, or the decision log. One assumption is
  never provenance for another - that is a guess with a paper trail.
- **Unknown** - looked for, not found. It becomes a question when it is a one-way door or intent
  only the user can decide; otherwise an uncertain assumption.

A one-way door is never an assumption: predictable or not, it becomes a question, because silence
must not settle what is costly to undo.

**Doors.** A **one-way door** is a decision someone outside this change pays to undo once it
ships. Mark each one with provenance for who pays. Prompts for who that is:

- consumers - a route, API shape, file format, or contract another service, team, or tool reads;
- data - a persisted column, type, or format, or a migration;
- architecture - a boundary or pattern other code will build on;
- infrastructure - provisioned resources, environments, deployment config;
- precedent - a convention others will copy;
- dependencies - a package or service others will build on;
- security - a permission, a trust boundary, an exposure;
- external effects - anything sent, charged, or published;
- test contracts - an acceptance test or fixture others assert against.

Unsure counts as a door. A mark without provenance still counts, and the map reports its reason as
unconfirmed. Everything else is a two-way door.

Invent nothing. A guess must never be indistinguishable from a decision the user made.

Web: only for a verifiable external fact a candidate turns on - a platform capability, an API
shape, a version - or for the established guidance on a fork. Primary sources only: vendor docs,
the package's own stated requirements, spec text, the guidance's own publisher. Two searches per
candidate; no primary source means unknown. Never for approach comparison.

Report the map in the same reply as round 1, keyed by ID so the user can correct by ID. Every
entry is one line - the questions carry the full text:

- **asked** - one-way doors and user-only intent, each pointing to its question;
- **assumptions** - uncertain first, without provenance;
- **ruled out**;
- **facts** - a count, listed only when the user asks.

Provenance is shown on request ("why A2?"). Corrections are volunteered and off-budget.

**Zero rounds.** With no one-way door and no open user-only intent, nothing is asked: the shape
follows the map in the same reply.

**Risks ride on decisions.** A risk is never ruled on its own - one decision, one touch. No
likelihood/impact scoring.

- Bears on an unknown: it goes on that question as its **Risk** line, and the answer settles it.
- Bears on no question: an assumption landing as a constraint or an accepted risk. Silence accepts
  it; silence never avoids it.
- Would need avoiding: its own question. Avoiding drops it from the shape, and that takes the
  user's word - a boundary when outside the change's shape, a deferral when real and parked.

A risk a stance creates mid-grill goes in that stance's **Rules out** - it is a cost of agreeing,
and agreement makes it an accepted risk.

### Rounds 1 to 3 - ask, re-derive

Each round is one batch of up to **four** questions, asked together, answered together. Minimum
two - except a single question, when it is the only orthogonal one the frontier holds. A round is
spent when asked, however many answers come back.

**Orthogonal.** No answer may change whether another question in the same batch is worth asking.
When in doubt, hold it back.

**Report the record once.** Rounds do not repeat the map. Provenance is shown only when the user
asks for it ("why A2?"), and always lands in the decision log.

**Questions first.** A round reply opens with its questions. After them come only the changes
since the last reply: entries newly settled, corrected, or withdrawn, one line each. Nothing
unchanged is restated.

**Ranking.** Greedy by information gain: branch-pruning beats leaf-closing. A question carrying
a **Risk** or **One-way door** line can win a slot it would not win on pruning alone. Only one-way
doors and user-only intent are asked. Zero-gain questions - rule nothing out - are never asked; a
one-way door is never zero-gain. A round that can only muster those means the frontier is closed.

**Open, not asked.** Every candidate the batch could not hold gets one line under the round: the
question itself, shortened. The user promotes or closes it; unaddressed, it stays listed. The list
is never its own section in the report - at close, each entry takes an exhaustion exit, usually a
deferral.

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
  observable outcomes for the same input, when the grill cannot rank them or the decision is a
  one-way door. Judging a key example is cheaper than arguing a proposition, and the answer is
  already an acceptance test. Outcomes the grill can rank make an assumption in given/when/then.

```
**Q1.** Where is a cancelled order's reason stored?

Stance: A nullable `cancel_reason` column on `orders`. Cancellation is a status on the order
(`app/Models/Order.php:41`), and the nightly export already reads that table
(`reports/OrderExport.php:18`).
Wrong if: an order can be cancelled, reinstated, and cancelled again, each with its own reason.
Rules out: a separate cancellations table, and keeping the reason only in the event log.
One-way door: data - a persisted column the nightly export ships to finance
(`reports/OrderExport.php:18`).
```

The question is the first line, after its number - no title label, no markers before it.

- **Question** - neutral: it reads as answerable either way without the stance. A question worded
  from inside the stance ("Can we just use one env var?") has answered itself before the stance is
  read. Context in it is fact; the argument lives only in the stance. It presupposes only settled
  material - resting on an assumption, it restates the few words of it the question needs,
  with its ID. Never a bare pointer the user has to scroll back for.
- **Concrete** - anchored in something the user can check: a route, a caller, an input, a
  number. "How important is latency?" invites "very"; "What is the largest tenant this search
  serves?" invites a fact the decision turns on.
- **Stance** - a strong opinion, weakly held, reasoning inline. Grounded in cited domain guidance
  when there is some, and saying so when it departs from it. Never a recommendation: the cheap
  response to a recommendation is agreement, to a stance an argument - and the argument is what's
  wanted.
- **Wrong if** - the condition that would refute the stance, so the argument has a target. It
  refutes this decision; it never opens a second one.
- **Rules out** - what agreeing costs.
- **Risk** - only when the question bears on one: the risk and its provenance, one line under
  Rules out.
- **One-way door** - only on a one-way door: who pays to undo it, with provenance, one line under
  Rules out (below **Risk** when both).
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
**Q1.** Given order 812 belongs to tenant A, when a tenant-B token calls `GET /api/orders/812`,
what does the caller see?

🅰 Then `404 Not Found`, the same as for an order that doesn't exist. (`docs/api.md:88`: "never
reveal another tenant's IDs")
🅱 Then `403 Forbidden`. (`app/Http/Middleware/Tenant.php:23` returns 403 cross-tenant)

Stance: 🅰 - the API guide's rule covers reads; the middleware's 403 was written for writes
(`Tenant.php:20`), where the caller already holds the ID.
Wrong if: a client already branches on 403 to show "request access".
Rules out: 🅰 rules out telling a caller the order exists; 🅱 rules out hiding other tenants' IDs.
One-way door: consumers - public API clients branch on the status code (`docs/api.md:12`).
```

- **One Given/When, two Thens.** A concrete context and event the user can check (a route, a
  payload, a caller, a value) and the outcome under each live reading. A third reading is a third
  Then, never a second When. More than three outcomes, or readings that agree on this input, mean
  it does not discriminate. Find a sharper one.
- **A Given every reading shares.** The Given and When hold under each live reading. A Given that
  presupposes one reading turns the other Then into a contradiction, not a prediction.
- **Observable Thens.** Each Then is what an observer would see: a status, a value, a rendered
  state, a log line.
- **Each outcome cites its reading.** A short parenthetical after the outcome gives the provenance
  that makes that reading live. An outcome no settled material supports is invented; drop it.
  Fewer than two supported outcomes means no example: ask in the stance form.
- **Stance is a ranking.** It names the expected pick with its reasoning, and keeps **Wrong if**.
  **Rules out** lists what each outcome costs: only what the outcome excludes under any
  mechanism. A mechanism the outcome doesn't force stays open.
- **Three kinds of answer.** A pick of one outcome settles it. **Neither** states the right
  outcome, which settles the example and usually opens a reading nobody listed. **Either** means
  the divergence does not matter, and rules out pinning a test on it.

### Pushing back

- **Reopened decision** - ask what changed. Nothing changed, it stays closed.
- **Contradicting answers** - name both, ask which wins. Never quietly take the later one.
  Off-budget. An answer contradicting the repo is the same: cite the `file:line`, ask which wins.
- **Scope creep** - through change control ([Change requests](#change-requests)), or a non-goal.
  Never quietly into what ships.
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
   settling the risk for the user. A question carrying a **One-way door** line is deferred only on
   the user's word, and the deferral names what it blocks: nothing that lands on the door ships
   until it is decided. That block lands in `constraints`.
3. Neither: the change is too big to define within the budget. Report that and propose how to
   decompose it: name the parts and whether they are independent or a strict sequence, so each
   can be grilled on its own. The split signal is the most valuable output - never raise the
   ceiling to avoid it. It lives in the report and writes no shape.

## Change requests

Scope creep under change control. Anything entering the shipping set after round 1 is stated as a
change request: what it is, where it came from, why the outcome is unreachable without it (not
"better with it"), and what it rules out. The same request flags if it competes with a pattern
already in the repo, adds a dependency, or challenges the architecture.

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
  R1: given <context>, when <event>, then <outcome>
  R2: <something the outcome needs> - not observable, <why>
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

The reported block has no comments and no unfilled placeholders - it is copied verbatim. It must
parse as YAML: quote any free-text value that contains `: ` or ` #`, or starts with a character
YAML treats specially (`[`, `{`, `&`, `*`, `!`, `|`, `>`, `%`, `@`, a quote, or a backtick).

- `outcome` is the one scalar, with no weasel words. Every other field is a collection; an empty
  one is a statement, not an omission.
- Problem space vs solution space. `outcome`, `requirements`, `non_goals` are the what;
  `approach` (mechanism chosen), `constraints` (limits on it), `touchpoints` (files and symbols it
  lands on) are the how. A stance naming a file, symbol, technology, or value is how - never a
  requirement.
- Every requirement is observable - given/when/then - or says why it cannot be. Most come from
  assumptions written that way; the rest from settled examples.
- `touchpoints` are the expected blast radius: a change outside them needs an explanation.
- `type` is explicit on each non-goal: it decides whether reopening one is a question or a mistake.
- Risks have no field. A settled risk lands as a constraint (mitigated), a typed non-goal
  (avoided), or an accepted risk recorded in the decision log with what accepting it costs. A risk
  whose answer changed nothing is dropped; an avoided one is always recorded as its non-goal. An
  unsettled risk is never carried.
- A settled example lands in `requirements` as `given <context>, when <event>, then <outcome>`:
  observable, so problem space, and copyable into an acceptance test as written. An **Either**
  answer lands in the decision log as a non-constraint with the input it covers. The rejected
  outcome is that decision's rejected alternative.

The body under the frontmatter is the decision log, ADR-style but only three parts per decision,
each entry keyed `D1…`: the decision, its rejected alternatives, its provenance. Not optional,
not a summary - it is the only record of the pruned branches. An assumption that reached the close
uncorrected keeps its label: silence accepted it, the user did not decide it. A decision on a
one-way door keeps its mark in the decision log, so a reviewer can see which entries cost most to
reopen.

## Persisting the shape

Only on request, and only once the frontier is closed - asked earlier, name the open questions and
write nothing. The file is the report verbatim: nothing the report lacks. With no location given,
`mvc-<slug>.md` in `.scratch` at the repo root, else the system temp directory. Never replace an
existing file without the user's word; when they passed in a prior shape, they choose replace,
merge, or a new file.
