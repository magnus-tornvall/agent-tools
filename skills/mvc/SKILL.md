---
name: mvc
description: Initiate a minimal viable change by grilling the user down a design tree until its shape is settled - what ships, what does not and why, and what each decision ruled out. Use before a change is planned, when what it is has not yet been pinned down.
disable-model-invocation: true
---

# mvc

It grills. That is the whole method: a design tree walked by asking the user the question
whose answer prunes the most, then re-deriving the frontier. What survives is the trunk,
the ledger of what was cut, and the reason for each.

Minimal is the constraint, not the aspiration. Every item that ships must be load-bearing
on the outcome. Three rounds is the budget, so that "we'll decide later" costs something.

This skill touches no git and writes no file.

## The grill

### Round 0 - synthesize

Fill what the conversation and the repository already determine before asking anything. A
question whose answer is in the repo wastes a round.

List the candidate questions first, then dispatch one subagent to answer what it can. The
candidates drive the search: a fixed file list reads what does not bear on this change and
misses the one file that does.

Candidates span both axes: what the repo settles, and what only the user can decide. A list
drawn from the first alone comes back with nothing dark, which leaves round 1 nothing to ask.

The explorer returns, per candidate, either the answer with `file:line` or **dark** - looked
for, not found. Absence is a finding, because it is what becomes a question. A candidate can
be both: the constraint the repo imposes is determined, the requirement it cannot know is
dark, and splitting them is worth more than either half. It stops when every candidate is
answered or dark, not when a file list is exhausted.

Worth a lookup before anything else: precedent for the thing being added, which kills a
branch rather than a leaf; the code the change touches and its callers; the repo's own
convention and decision docs, whatever they are named; git history for the area; the
dependency manifest; the existing test setup.

Invent nothing. A plausible guess is indistinguishable from a decision the user made, and
telling those two apart is the point - which is why a determination without provenance is
dark, not determined. General knowledge about a framework is not provenance, and a citation
that proves something adjacent is worse than none: it makes the guess look checked.

The web is in scope for one thing: a verifiable external fact a candidate turns on - a
platform capability, an API shape, a version. Not approach comparison, not best practice:
those are stances with no author, and the user owns the stances here. URL is provenance. Two
searches per candidate, and the answer counts only from a primary source - the vendor's own
documentation, the package's own stated requirements, the specification text. Two searches
that do not reach one leave the candidate dark.

Report the map before round 1: **determined**, with provenance; **ruled out**; **dark**. The
user corrects it or says nothing, and either way round 1 asks from a shared map. Correcting
a map is volunteered, so it costs no round.

### Rounds 1 to 3 - ask, re-derive

Each round is one batch of **four questions**, asked together, answered together.
Fewer than two is not a round, it is a conversation - except a final single question, which
is a whole round when it is all the frontier holds.

A round is spent when the batch is asked. Not by the answers: a batch that comes back with
three of four answered still spent it, or nothing bounds a grill that keeps re-asking.

**Questions in one round must be independent**: no answer may change whether another in the
same batch is worth asking. The failure mode is batching four and having the first answer
delete the other three - so when in doubt, hold it back.

More than four candidates, rank by what an answer would prune. The question that rules the
most out takes the slot; one that closes a single leaf takes one only when nothing bigger
is open.

**What the batch could not hold is listed, not discarded.** A candidate that would prune a
branch - kill other questions hanging off it - gets one line under the round in an **open,
not asked** list: the title, nothing else. No stance and no rules out, because the cost of a
fifth question is the stance and the body, not the title. The user promotes one to a real
question or closes it, and a listed candidate the user says nothing about stays listed. A
candidate that closes a single leaf is dropped silently - the branch-or-leaf test is what
keeps the list from becoming a fifth question under another name.

**An unanswered question is not silent acceptance of its stance.** Ask why it was skipped,
once, in the same reply that reports the round: unclear means clarify and re-ask within the
round, since clarification never spends budget; premature means it stays open; don't-care
means the stance stands. Silence to that is a signal too - carry it and move on, and never
withhold the round's other answers waiting for it.

A re-asked question is asked verbatim. A reworded question is a different question, and the
silence was about this one.

### The question format

Plain text, one block per question, never a picker. A picker makes the most valuable reply
awkward - "hang on, you are asking the wrong thing" should be as easy to type as an answer,
and in a grill it often is the answer.

```
❓ **Q1** — **Per-environment policy**: Does the CSP value need to differ between staging
and production?

➡️ **Stance**: No — one string from an env var, no code difference. Staging and production
serve the same routes from the same bundle.
   **Rules out**: per-env code branches, and any policy registry.
```

**Stance, never recommendation.** The cheapest response to a recommendation is agreement;
the cheapest response to a stance is an argument, and the argument is the thing worth
having. The reasoning is always inline - a stance without it is an appeal to authority with
nothing to disagree with.

**Rules out** is what agreeing costs. It is the line that makes someone stop.

**No option lists.** Options plus a stance is a ballot with a box already marked. A
freeform counter is what surfaces the option neither party listed, which in a design tree
is where the pruning happens. Enumerate only when the answer set is genuinely closed, and
then the stance is a ranking rather than a position.

**Keep bodies to one short paragraph.** Four is what a person absorbs at this density; three
paragraphs each silently makes the real ceiling two.

**Clarification is off-budget and unlimited.** Nobody attacks a stance they have not
understood. Asked why one holds, expand: the evidence, what it assumes, what would make it
wrong. Never restate it louder. Asked what a question even means, answer plainly and drop
the stance until it lands. A question back is not a vague answer, and never gets pushed
back on.

### Pushing back

- **A settled decision reopened.** Ask what changed. Nothing changed, it stays settled.
- **An answer that widens the change.** Route it through widening below, or make it a
  non-goal. Never let it into what ships quietly.
- **A better option exists.** Say which and why, once - then it is the user's call, and a
  reaffirmed decision is closed. Re-arguing it is not grilling, it is stalling. "Once" caps
  what is volunteered, not what is asked for: pressed, explain as fully as it takes.
- **A vague answer.** "Probably", "some kind of", "we'll see" is not an answer. Ask the
  narrower question.

### Exhaustion

There is no round four. Finishing the third with questions still open is not a failure - it
is information. Each survivor takes one of three exits:

1. **The user answers it off-budget** - volunteered, not asked by a round. Costs nothing,
   because the ceiling bounds what this skill asks for, not what the user offers.
2. **It becomes a non-goal**, deferred with a reason, and stops blocking.
3. **Neither.** The change is too big to define in three rounds; report that and propose
   the split.

This skill does not raise its own ceiling. A budget that moves when it binds is not a
budget, and the split signal is the most valuable thing it produces. Lowering it is the
user's call; only raising is the rule being broken.

## Widening

Anything entering the shipping set after round 1 is a widening, and is stated as one: what
it is, where it came from, why the outcome is unreachable without it, and what it ruled
out. The reason clears a bar - not "it would be better with this", but "the outcome does
not happen without this".

**The grill proposes, the user decides.** It never admits an item on its own reasoning, and
never withholds one it spotted because the idea was not the user's. It states the widening
and argues it once; the call is the user's, and a rejected proposal is closed.

The same statement carries the pushback. An item that competes with a pattern already in the
repo, adds a dependency, or challenges the existing architecture says so where it enters.
That is cheaper than finding it at the minimality pass, and it is the same sentence either
way.

## What ships, what does not

Sorting these is the judgement the grill exists to produce.

**Ships.** The test is deletion: remove the item and the outcome no longer holds. Anything
whose absence merely makes the result slower, uglier, or less pleasant is a non-goal. A
shipping list where every item survives deletion is not an MVC.

**Non-goals.** One list from the start. Every entry carries either a **boundary** - never
this change, and the line that separates them - or a **deferral reason** - not now, and
why. Which one it carries is the entry's type, and an entry carrying neither is not a
non-goal, it is an omission.

The two types are argued differently, which is why the type is written down rather than
inferred. A boundary prunes: it kills a branch and every question hanging off it, which is
the most frontier a single answer can clear. A deferral only parks - the item leaves what
ships, its subtree stays alive. The list exists to stop re-litigation, not to inventory
everything imaginable; if nobody would have asked for it, leave it out.

**Ruled out.** Every decision names what it eliminated. A decision that eliminates no
alternative was not a decision, it was a description. "We will write tests" rules nothing
out; "tests go in the existing suite, not a new harness" rules out a new harness.

## The minimality pass

Runs once, when the frontier closes. Everything above enforces *defined*; this is the last
thing that enforces *minimal*, and the only one that sees the closed set rather than one
item arriving. Minimal here means not unnecessarily complex, not the smallest design
imaginable: the pass exists against drift, complexity creep, scope expansion and
inefficiency, not against every line that could technically go.

Probe the shipping items that add **mechanism**, in one batch: drop this - does the outcome
still hold? An item adds mechanism when deleting it changes what the system does - a code
path, a dependency, a schema, a config surface, a new pattern. An item whose deletion leaves
behaviour identical - a name, a doc, a test, a type - does not enter the batch at all, because
probing it produces a squabble over a detail nobody wanted cut.

Inefficiency is the one trigger that belongs here rather than at entry. Two items that each
looked proportionate as they arrived can be redundant against each other once the set is
closed, and only the closed set shows it.

Report only what moves - an item whose deletion breaks the outcome stays, and stays silently,
because the shipping list already asserts it is load-bearing:

- **It still holds.** The item was never load-bearing. It becomes a non-goal, deferred
  with the reason it survived this long.
- **Cannot tell.** The frontier reopens. The shape was out of questions, not settled - and
  if the budget is also spent, the split signal fires here instead of at exhaustion.

Apply accepted deletions one at a time, and if two or more land, read the reduced set back
against the outcome. Two items can each be individually droppable because the other covers
the outcome, and dropping both breaks it. That read-back buys the whole class of mistake.

The pass is off-budget and the four-question ceiling does not apply to it: the form is fixed,
the answer is yes or no, and the material is already settled, so the batch reads as a
checklist rather than as four things to absorb.

## Reporting the shape

Close by naming the shape in the fields a specification is written in, so whatever consumes
it copies rather than translates.

A grill settles two kinds of thing and they go to different fields. What the outcome requires
is `outcome`, `requirements`, `non_goals`. How it is reached - every stance that named a file,
a symbol, a technology or a value - is `approach`, `constraints` and `touchpoints`:

- `approach` - the mechanism chosen.
- `constraints` - the limits the mechanism must respect.
- `touchpoints` - the files and symbols it lands on.

Reporting one of those as a requirement smuggles a mechanism into the goal, where the next
replan is free to renegotiate it.

Non-goals carry across with the type they were argued under - boundary or deferral - because
that is what decides whether reopening one is a question or a mistake.

What each decision ruled out belongs to no field: it is the prose that ships with the shape.
It is the most expensive thing the grill produced and the only record of the branches, so it
is not optional and it is not a summary.

Every part comes with where it came from. The user is auditing a shape they did not write,
and provenance is what makes that an audit rather than a skim.

## Prohibitions

- Does not settle the shape on the user's behalf.
- Does not ask more than four questions in a round, or two whose answers interact.
- Does not reserve a batch slot for an unanswered question, or reword it when re-asking.
- Does not discard a branch-pruning candidate the batch could not hold. It is listed.
- Does not present a stance as a recommendation, state one without its reasoning, or pair
  one with a list of options.
- Does not let anything into the shipping set after round 1 without a widening reason, and
  does not admit one on its own reasoning. It proposes; the user decides.
- Does not probe an item whose deletion leaves behaviour identical, or report one the probe
  left standing.
- Does not invent an answer to fill a gap. A gap is reported.
- Does not keep the pruned branches. What each decision ruled out is the record; the
  transcript is not.
- Does not write code, a plan, tasks, or a file.
- Does not ask what the repository already answers.
- Does not report a determination without provenance.
- Does not report a stance that names a file or a technology as a requirement.
- Does not search the web for approach comparison or best practice.
- No vague qualifiers in the outcome or in what ships.
