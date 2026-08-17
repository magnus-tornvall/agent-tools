---
name: mvc
description: Initiate a minimal viable change by grilling the user down a design tree until its shape is settled - what ships, what is deferred, what is out, and what each decision ruled out. Bounded to three rounds of at most four questions. Produces mvc.md, a mechanically validated artifact an agent or a human can read and act on. Widening the change requires a recorded reason. Use before a change is planned, when what it is has not yet been pinned down.
disable-model-invocation: true
---

# mvc

A constructor for one artifact: `mvc.md`, holding what a change is and - equally - 
what it is not, in a shape a script can check and a reader can trust.

It grills. That is the whole method: a design tree walked by asking the user the 
question whose answer prunes the most, writing the answer down with what it ruled 
out, and re-deriving the frontier. The tree's pruned branches are not kept. What 
survives is the trunk, the ledger of what was cut, and the reason for each.

Minimal is the constraint, not the aspiration. Every item that ships must be 
load-bearing on the outcome, and the budget exists so that "we'll decide later" 
costs something.

State lives in `mvc.md`, never in the conversation. That is what makes a grill 
resumable after context is lost, and what makes round 2 aware of round 1.

## Where things go

Resolve the changes directory once, before anything else:

- default `docs/changes/`
- overridden by a line matching `changes dir: <path>` in the project's `CLAUDE.md`

This skill *initiates* the change. It creates `<changes dir>/YYYY-MM-DD-<slug>/`, 
where the date is today and the slug is 2-4 kebab-case words, and writes `mvc.md` 
there.

Find an existing grill before creating anything. A resume is the point of writing state 
to a file, and a slug re-derived from scratch each invocation would never match the one 
yesterday's invocation chose:

- **An argument names the change** - a slug, a directory name, or a path. Resolve it 
  against `<changes dir>` and resume that `mvc.md`.
- **No argument**: glob `<changes dir>/*/mvc.md` for any with `approved: false`. One 
  match, resume it. Several, ask which. None, create the directory.

Resuming means reading the file and continuing from its `budget.round` - never starting 
over, and never a second directory for a change that already has one.

Other skills may later add their own artifacts to the same directory. Sharing a 
directory is a filing convention, not a contract: this skill reads no other 
artifact's fields and writes none. `mvc.md` is a document like any other, and a 
downstream specification phase that wants it can read it the way it reads a README.

This skill touches no git. It creates no branch and makes no commit.

## The grill

### Round 0 - synthesize, then draft

Before asking anything, fill what the conversation and the repository already 
determine. A question whose answer is in the repo is a question that wastes a round: 
look it up.

Write a first `outcome`, a first `in`, and the frontier as `open`. Invent nothing - a
plausible guess written into a field is indistinguishable from a decision the user 
made, and this artifact exists to tell those two apart. A field with no evidence 
stays empty and becomes a question.

Then run the script and show the user the draft before round 1. They are about to be
grilled against it; they should see what it already assumes.

### Rounds 1 to 3 - ask, write, re-derive

Each round is one batch of **at most four questions**, asked together, answered together.
Four is the ceiling because that is roughly what a person absorbs in one sitting at the
density these questions run. Three is comfortable. Fewer than two is not a round, it is a
conversation - except a final single question, which is a whole round when it is all the
frontier holds.

**Questions in one round must be independent**: no answer may change whether another in the
same batch is worth asking. If it could, the dependent one waits for the next round. This is
judgement no script can check, and the failure mode is batching four questions and having
the first answer delete the other three - so when in doubt, hold it back.

When `open` holds more than four, rank by what an answer would prune. The question that
rules the most out is the question worth a slot; a question that closes one leaf is worth
a slot only when nothing bigger is open.

Every question carries a **stance**, in the format below. A question asked from zero
context is generic and spends the user's attention for nothing; a question that hides its
own view gets agreement instead of understanding.

After the answers: write each into `settled` with its `rules_out`, delete every `open`
entry the answers made moot, add what they opened, increment `budget.round`, and save.
Then run the script and report.

**An unanswered question is not a spent slot.** A batch of four that comes back with three
answers still increments `budget.round` - a round is spent by the writing, not by the asking -
but the survivor stays in `open` with its id and costs nothing. The next batch is built by
re-ranking the whole frontier and filling to four, so a carried question competes with what the
three answers just opened rather than holding a reserved seat. Frequently it loses, or the
answers made it moot and it is deleted; either is the ranking working. Re-asked, it is re-asked
verbatim under its original id, because a reworded question is a different question and the
silence was about this one.

Ask why it was skipped in the same reply that reports the round, once per round and never
again within it, and take the answer as the routing: unclear means clarify
off-budget and re-ask in the same round, since clarification never spends the budget;
premature means it is not yet a question and leaves `open`; do-not-care means the stance
stands and it goes to `settled` as answered. Silence to that too is a real signal - carry
it and move on, and never withhold the round's other answers waiting for it.

There is no attempt counter, and a question carries no memory of how often it was skipped.
The three-round ceiling already bounds re-asking at three, the ranking usually drops it
sooner, and a tally would be conversation state in a skill whose state lives in `mvc.md` - a
resumed grill would read a number it never wrote.

An answered question becomes a `settled` entry with a **fresh `D` id, never reused**,
and its `open` entry is deleted in the same edit. The `Q` number is not carried over -
ids are one namespace, and the traceability is the question text preserved in `settled.q`,
not a matching number that has to be kept in sync.

### The question format

Ask in plain text, one block per question, never a picker. A picker makes the most valuable
reply awkward - "hang on, you are asking the wrong thing" should be as easy to type as an
answer, and in a grill it often is the answer.

```
❓ **Q7** — **Per-environment policy**: Does the CSP value need to differ between staging
and production?

➡️ **Stance**: No — one string from an env var, no code difference. Staging and production
serve the same routes from the same bundle.
   **Rules out**: per-env code branches, and any policy registry.
```

The id is the `open` entry's id, so the answer has an obvious destination. The title is
2-4 words and exists so four questions can be referred to by name in one reply.

**Stance, never recommendation.** The word sets the reply. The cheapest response to a
recommendation is agreement; the cheapest response to a stance is an argument, and the
argument is the thing worth having. A stance with no reasoning is worse than no stance - it
is an appeal to authority with nothing to disagree with - so the reason is always inline.

**Rules out** is what agreeing costs, projected: the `rules_out` this will carry into
`settled` if the stance survives. It is the line that makes someone stop. It gets no field
in `open`, because it is derivable from the stance and a second copy would drift.

**No option lists under a stance.** Options plus a stance is a ballot with a box already
marked - rejecting it now means also picking a replacement from a list the user did not
write. A freeform counter is what surfaces the option neither party listed, which in a
design tree is where the pruning actually happens. Enumerate only when the answer set is
genuinely closed, and then the stance is a ranking rather than a position.

**Keep the body short.** Four is the round ceiling because four is what a person absorbs;
three paragraphs per question silently makes the real ceiling two. Terse questions or
smaller rounds, not both.

**Clarification is off-budget and unlimited.** A stance is a position to attack, and nobody
attacks what they have not understood - so talking through a question before answering it is
not an interruption to this method, it is the method. Asked why a stance holds, expand the
reasoning: the evidence behind it, what it assumes, what it would take to be wrong. Never
restate the stance louder. Asked what a question even means, answer plainly and drop the
stance until the question lands. None of this spends a round; a round is spent when an
answer is written to `settled`, and nothing else consumes the budget.

A question back is not a vague answer. Bodies are terse by design, which makes questions
back expected rather than a failure - if a stance is being interrogated instead of answered,
the format is working.

### Pushing back

Grilling means resisting, on four triggers:

- **A settled decision reopened.** Name the `settled` id, quote its `reason`, and ask what
  changed. If nothing changed, it stays settled.
- **An answer that widens the change.** Route it through `widened` below, or push it to
  `deferred`. Never let it enter `in` quietly.
- **A better option exists.** Say which and why, once. The user's call after that - if they
  reaffirm, write their answer and move on. Re-arguing a settled call is not grilling, it
  is stalling. "Once" caps what is volunteered, not what is asked for: pressed on a
  decision, explain it again as fully as it takes.
- **A vague answer.** "Probably", "some kind of", "we'll see" is not an answer. Ask the
  narrower question. The round is not spent until something is written. This is a trigger
  on answers only - a question back is not a vague answer, and never gets pushed back on.

### Exhaustion

Three rounds is the budget, and there is no round four. Finishing the third with `open`
still non-empty is not a failure of the grill - it is information. Stop and report, and each
survivor takes one of three exits:

1. **The user answers it off-budget.** Volunteered in conversation, not asked by a round.
   Write it to `settled`. Costs nothing, because the ceiling bounds what this skill asks
   for, not what the user offers.
2. **It is deferred**, with a reason, and stops blocking.
3. **Neither.** Then the change is too big to define in twelve decisions, and the report
   says so and proposes the split.

This skill does not raise its own ceiling, and the script defects on a `ceiling` above 3.
A budget that moves when it binds is not a budget, and the split signal is the most valuable
thing it produces. Lowering it is the user's call; only raising is the rule being broken.

## Widening

Anything entering `in` after round 1 is a widening, and gets a `widened` entry naming what
it is, where it came from, why `outcome` is unreachable without it, and what it ruled out.
The reason must clear a bar: not "it would be better with this", but "the outcome does not
happen without this".

Widening stays possible because sometimes round 2 genuinely discovers the outcome is
unreachable as drawn. Forbidding it would not prevent the growth, only the record of it.
The list makes growth countable - a reader sees how much the change grew after it was first
drawn, and on what grounds, which is the number nobody otherwise has.

An item moved out of `deferred` or `out` is removed from that list in the same edit. Living
in two buckets is a defect, not a nuance.

## What goes in each list

The script checks that these are filled. Only a reader can check that they are true - which
is what this section is for, and why the gate is not the script alone.

**`in`** - what ships. The test is deletion: remove the item, and `outcome` no longer holds.
Anything whose absence merely makes the result slower, uglier, or less pleasant is not `in`,
it is `deferred`. An `in` list where every item survives deletion is not an MVC.

**`settled`** - a question that was genuinely live and is now closed. `rules_out` is
mandatory because it is the point: a decision that eliminates no alternative was not a
decision, it was a description. "We will write tests" rules nothing out. "Tests go in the
existing suite, not a new harness" rules out a new harness.

**`deferred`** - something a reasonable reader would expect in scope, and the reason it
isn't, revisited after the change has been tested in the wild. The ledger exists to stop
re-litigation, not to inventory everything imaginable. If nobody would have asked for it,
leave it out.

**`out`** - a boundary, not a delay. Something adjacent that will never be this change,
with the line that separates them. If it might happen later, it is `deferred`; the
distinction is the whole reason both lists exist.

**`terms`** - a word this grill had to pin down, carried for whoever maintains the project's
glossary. The filter is a lookup, not a memory: before writing an entry, grep `CONTEXT.md`,
`AGENTS.md`, and `docs/adr/` for the term. What you find decides `status`:

- **`new`** - nothing defines it. A candidate for `CONTEXT.md`, once the change has shipped.
- **`conflict`** - something defines it differently. Two parts of the project mean different
  things by one word, which is ADR-shaped.
- **`narrowed`** - a glossary has it, and this change uses a tighter sense. Stays in the
  change; never promoted.

A term some glossary already defines the same way is not an entry. It is already written
down, and copying it here creates a second copy to drift. `status` is the payload: it is
what tells a later reader whether an entry implies a glossary edit, a decision, or nothing.

`means` always states the sense *this change* uses. For a `conflict` that is the local
resolution, and it is the reason a conflict does not block: the change is pinned, only the
durable record is owed. `seen_in` names where the other definition lives, whole paths only.

Writing the ADR or the glossary entry is not this skill's. Promoting a coinage before the
change ships is premature - if the change dies the term should never have entered the
glossary - and `term`/`means` maps onto the `**term**: means` glossary format directly, so
promotion is a copy rather than a translation.

**`open`** - a question whose answer changes what gets built. A question whose answer
changes nothing is not open, it is curiosity, and it costs a slot in a three-round budget.

## Validate, by script

```
bun <skill dir>/scripts/validate.ts <change dir>
```

`<skill dir>` is the directory holding this file. Run it every round, not once at the end.

| exit | meaning | what to do |
| --- | --- | --- |
| 0 | the shape holds | the minimality pass, the reader's checklist, then the user approves |
| 1 | gaps remain | its output is the frontier; keep grilling or report exhaustion |
| 2 | malformed | a structural defect, not a gap. Fix it, then re-run here |

Report every line the script prints, including warnings. Silence is not a pass. If `bun` is
not installed, stop and say so - do not review the rules by eye instead.

A check earns a place in the script only when a wrong answer is mechanically decidable.
Everything else is a checklist line or a warning. The pull is always toward making the
script check more; followed all the way it turns the gate into a regex and moves judgement
off the human, who is the only thing here that can tell a real reason from a filled slot.

## The minimality pass

Runs once, after the script first exits 0 and before the user approves. Everything above
this point enforces *defined*; this is the only thing that enforces *minimal*. A change can
satisfy every other check with a bloated `in` list, as long as each entry is written clearly
and something was cut.

Take each `in` item and try to delete it:

> Drop "a policy value that differs per environment". Does `outcome` still hold?

Three answers, three destinations:

- **It still holds.** The item was never load-bearing. Move it to `deferred`, with the
  reason it survived this long.
- **The outcome fails.** It stays, and *why* becomes a `settled` entry - `q` is the deletion
  question, `a` is no, `reason` is how the outcome breaks, `rules_out` is shipping without
  it. The pass adds no field to the shape; a survival is an ordinary settled decision and a
  deletion is a move between lists that already exist.
- **Cannot tell.** The frontier reopens: it becomes an `open` entry and the gate closes
  again. This is the pass making things longer rather than shorter, and it is correct - it
  means the shape was not settled, only out of questions. If the budget is also spent, the
  split signal fires here instead of at exhaustion.

**Probe in one batch, apply one at a time.** The probes look independent and are not: two
items can each be individually droppable because the other covers the outcome, and dropping
both breaks it. So ask them together, then apply the accepted deletions serially, and if two
or more were accepted, read the reduced `in` back and confirm `outcome` still holds against
it. One extra question buys the whole class of pairwise mistakes.

**Skip what has already passed a harder test.** A `widened` item cleared "the outcome does
not happen without this", which is the deletion test asked earlier and stricter. An item
already contested in `settled` was probed on a previous run. Probe neither. On a five-item
`in` with two widenings, that is three probes and one batch.

The pass is **off-budget**. It asks no new design question - fixed form, yes or no, about
material the user already settled - and the ceiling bounds what this skill asks for, not
every exchange.

**Re-run the script when the pass is done.** It mutates `in`, `deferred` and `settled`, and
a "cannot tell" adds an `open` entry - so the exit 0 that authorised the pass no longer
describes the artifact the user is about to approve.

There is no `minimised` flag, deliberately. A boolean the model sets is an unchecked
self-report, which is the "turn *justify this* into *type something*" failure the rest of
this skill exists to avoid, and a boolean the user sets is a second signature on a
three-round skill. The pass needs no flag because its output is its evidence: either items
moved to `deferred`, or `settled` grew entries saying they could not be dropped. The user
sees both at approval.

## The reader's checklist

Run this after the minimality pass. Its output goes into the report and nowhere else - it may
not write a field, may not set `approved`, and may not be added to `open`. That list is
state, it blocks the gate, and state records the user's judgement, not the reader's. A doubt
raised here dies with the invocation and is re-derived next time.

- Is `outcome` falsifiable, or does it merely sound good?
- Did every `in` item face the minimality pass, and did each survival record how the
  outcome breaks - or does one of them just say it is important?
- Does each `rules_out` actually eliminate something, or restate the decision?
- Does any `deferred` reason merely rephrase the item instead of justifying the deferral?
- Is anything in `out` actually just `deferred` with a confident tone?
- Does each `widened` reason clear the bar - unreachable without it, not better with it?
- Is any term used two ways across `settled` without a `terms` entry?
- Does each `conflict` entry's `means` actually pick a sense, or does it describe the
  disagreement and leave the change using both?
- Is an in-scope uncertainty still too vague to state as a question? That is not an `open`
  entry; it is a gap in the report, and it recurs until the change gets sharp enough to
  name it.

## The user approves

Present the shape with where each part came from. The user is auditing writing they did not
do, and provenance is what makes that an audit rather than a skim.

Provenance comes out of the artifact, never out of recall: `settled.reason`, `terms.seen_in`,
`widened.reason`, and the prose body for anything the fields cannot carry. State lives in
`mvc.md`, so evidence held only by the live conversation is gone the moment context is - and
a resumed grill would present a shape it cannot defend. If a decision's evidence is in no
field, write it into the body before presenting, not into the answer.

The user writes `approved: true`. This skill never does. `approved: true` over any gap -
an open question, an empty `outcome`, a deferral with no reason - is malformed state and
the script exits 2 on it.

## mvc.md shape

```yaml
---
outcome: "Every HTML response carries a Content-Security-Policy header."
approved: false

budget:
  round: 2                # rounds spent
  ceiling: 3              # never raised by this skill

in:                       # what ships. delete any one and `outcome` fails
  - "A CSP header on every HTML response."
  - "A policy value that differs per environment."

settled:                  # ids are D followed by digits
  - id: D1
    q: "Where is the header set?"
    a: "In the existing security middleware, not per-route."
    reason: "Every route already passes through src/middleware/security.ts::applyHeaders."
    rules_out: "Per-route opt-in, and any registry of which routes get a policy."

widened:                  # entered `in` after round 1. must be justified, not preferred
  - what: "A policy value that differs per environment."
    from: deferred        # deferred | out | discovered
    reason: "Staging serves test payment iframes production never will; one shared policy
             breaks staging outright, so the outcome does not hold without this."
    ruled_out: "A single hardcoded policy string."

deferred:                 # the ledger - written down, never designed
  - what: "Per-tenant policy overrides."
    reason: "No per-tenant config exists to hang it on."
  - what: "CSP violation reporting."
    reason: "Needs an endpoint and a retention decision; neither exists yet."

out:                      # never this change. the boundary, not a delay
  - what: "CSP for the admin SPA."
    boundary: "Separate deploy, separate team, separate header pipeline."

terms:                    # only what no glossary already says. status is the payload
  - term: "policy"
    means: "The CSP header value for one environment. Not a per-route rule."
    status: new             # new | conflict | narrowed
    seen_in: []             # where the other definition lives; empty iff status is new
  - term: "route"
    means: "An Express handler path. The frontend router's 'route' is a different thing."
    status: conflict
    seen_in: ["CONTEXT.md", "docs/adr/0007-header-pipeline.md"]

open:                     # the live frontier, each with the stance to attack
  - id: Q7
    q: "Does an empty policy value omit the header or send an empty one?"
    stance: "Omit it - an empty CSP header is worse than none, and it makes the env var a
             clean off switch."
---
```

Prose body is optional. Use it for context a future reader needs and the fields cannot
carry. Do not restate the fields in prose.

## Prohibitions

- Does not approve. The user approves.
- Does not raise its own `ceiling`, and does not start a fourth round. Exhaustion is
  reported, and an unresolvable frontier means the change wants splitting.
- Does not ask more than four questions in a round, or ask two whose answers interact.
- Does not reserve a slot for an unanswered question, reword it when re-asking, or track how
  often one was skipped.
- Does not present a stance as a recommendation, state one without its reasoning, or pair
  one with a list of options.
- Does not let something into `in` after round 1 without a `widened` entry.
- Does not approve without the minimality pass, and does not apply two accepted deletions
  without re-reading the reduced `in` against `outcome`.
- Does not invent a field value to fill a gap. A gap is reported.
- Does not keep the pruned branches. `rules_out` is the record; the transcript is not.
- Does not let the reader's checklist write a field, set `approved`, or add an `open` entry.
- Does not write implementation code, a plan, or tasks. What the change is, not how.
- Does not ask what the repository already answers.
- No vague qualifiers in `outcome` or `in`.
