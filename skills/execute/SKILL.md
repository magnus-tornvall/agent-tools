---
name: execute
description: Drive one or more tasks from a settled shape to a verified green - author the check before any code exists, watch it fail for the stated reason, hand the work to a separate implementer, then judge what comes back against the check and the commit range it produced. Takes one settled shape - a change directory written down, or the same fields reported into the prompt - and the units of it to run, one at a time and stopping at the first that is not green, and returns a verdict per unit a calling agent can act on. Use once the shape is settled, never to settle it.
disable-model-invocation: true
---

# execute

The check is written before the work, by something with no stake in satisfying it, and the same
thing re-runs it afterwards. Nothing is green because whoever did the work says it is. Every
rule below follows from that one sentence.

Two roles, and never the same agent. The **framer** authors the check, watches it fail, and
judges what comes back. The **implementer** satisfies it and cannot touch it. Collapse them and
a green verdict means only that one agent was satisfied with its own work, which is the one
thing this skill exists to make impossible.

Units run one at a time and the run **stops at the first that is not green**. That is what makes
naming several of them safe: a unit's check is authored only after the previous unit's verdict
exists, so a wrong early check still cannot become a run of commits before anyone looked. What the
caller chooses is which units and in what order the shape already puts them; this skill never
picks a unit the caller did not name, and never decides the change is done.

State lives in git. This skill writes no state of its own: not a status file, not a run log, and
nothing into `change.md`, which holds approvals it must not be able to touch. A check that has no
home in the repository is a working file, not state - see [Where it is written](#where-it-is-written).

## The input contract

One vocabulary, at two levels of completeness. `outcome`, `requirements`, `approach`,
`constraints`, `non_goals` and `touchpoints` mean the same thing wherever they arrive from; what
differs is whether they have been written down. The caller supplies them, and what arrives is
what this skill has: it does not scrape the surrounding conversation for anything the shape did
not report, because a skill that half-fills its own input behaves differently depending on who
invoked it. Copying a shape that was reported into this conversation is a different act, and
[Arguments](#arguments) draws that line.

**Written down - a change directory**: its path, and the ids of the tasks to run. A decomposition
exists, so the unit is a task and the check comes from its `goal`; boundaries come from `scope` and
`forbidden`, obligations from `plan.constraints`, and the change-level check from
`plan.acceptance`.

**Settled but not written - a reported shape**: the fields verbatim, and which requirements to
work. There is no decomposition, so the unit is a requirement and there is one check per
requirement; `touchpoints` is scope, and `constraints` and `approach` are the obligations. Nothing
at this level carries `forbidden` - `non_goals` is the nearest thing and it is prose - so the
boundary check below runs on scope alone, and the verdict says so rather than implying a check it
did not perform. `kill_criterion` is not asked for at either level: it is the caller's condition
for abandoning the change, and nothing here would act on it.

What the second level costs is one redundant check, not the boundary: scope still admits only the
paths it names, and the no-test-path rule still holds. Written down is better because `forbidden`
catches the case where `scope` is wide, and because a decomposition puts the check at a seam
someone chose rather than at whatever granularity the requirements happen to have. Neither level
is promoted to the other here - a shape reported into the prompt is executed as reported, because
writing it down is an act with an approval of its own.

Either level arriving incomplete is a **gap** verdict naming the missing field. Filling it from
context is a thing the caller can be asked to do as its own act; it is not this skill's, because
a guess in a field is indistinguishable from a decision someone made.

## Arguments

Two forms reach a verdict. The form decides which level the fields come from, and the level
decides everything else. Each form takes the units to run: one id, several ids, or none.

**`/execute <change dir | slug> [task ids]`** - the written-down level. A path, or a bare slug
resolved within the changes directory the way `mise-en-place` resolves one. The fields come off
disk and the conversation is not consulted at all, which is what makes this the form a subagent
framer can be handed.

**`/execute [requirement ids]`** - the settled-but-not-written level. The fields are transcribed
from the shape most recently reported in this conversation, field by field, verbatim.

### How many units

**One id** is the unit. **Several** run in the order named. **None** - `/execute <change dir>`, or
`/execute` on its own after a shape was reported - is the whole change: every unit in the order the
shape already puts them, `depends_on` for a decomposition and the reported order for a requirement
list. Naming none is a choice rather than the absence of one, and it is the caller's: whether a
change is small enough to run end to end is a judgement about the change, which this skill has no
standing to make and does not second-guess in either direction.

The order is always the shape's. A cycle in `depends_on`, or a named unit whose `depends_on` names
a unit that runs **later** in this run, is a **gap** - reordering them would mean choosing an
order, which is the caller's. A dependency named in no unit of this run is not checked: whether it
is already done is state this skill does not keep, and the caller who named the list is the one
that knows.

Running several is safe for the reason the run stops at the first non-green unit: a unit's check is
authored against a base the previous unit's verdict has already been rendered on. What multiple ids
cost is commits before the caller looks, and the stop bounds that at one unit's worth.

**`/execute`** with neither a change directory nor a shape reported in the conversation is a
**gap**: there is no input, not an empty unit list.

### Transcription is not synthesis

The framer of a reported shape is normally the agent that was in the conversation the shape was
reported into, so the report is already in front of it. Copying it is the transfer a settled shape
is owed - re-deriving it invites a second opinion on a decision already made, and the two are
indistinguishable afterwards. Filling a field the report does not contain is the other thing
entirely, and it is a gap: one commit later, a value the framer supplied cannot be told from one
the user chose.

Every field verbatim, and no field without a source. No `touchpoints` reported means no scope,
which is a gap and not an unbounded implementer. A requirement id appearing in no report is a gap
and not the nearest requirement that resembles it.

## Preconditions

Checked before the first unit, and again before each later one. Each is a gap verdict, and
nothing is written:

- **A dirty working tree**, ignoring an ephemeral check this run wrote. Every commit in the range
  is measured against `<base>`, and from a dirty tree the framer's own commit either sweeps up
  work it did not write or requires selective staging - both make that base a lie. Stashing is
  worse: the skill would be moving work it cannot restore if it fails mid-run. Between units it
  means the previous implementer left work uncommitted, which its brief forbids.
- **HEAD on the default branch.** The implementer commits, rejected attempts stay in history,
  and neither belongs on the trunk. Requiring a branch is not the same as creating one: naming
  a branch is the caller's decision, in the same class as choosing which units to run.
- **Delegation unavailable.** If this agent cannot spawn an implementer, the roles collapse and
  the verdict would be shaped like a verified change without being one.

## The check

### Where it attaches

To the unit the shape makes falsifiable: a task's `goal` in a change directory, a `requirement`
in a reported shape.

A unit whose statement is not falsifiable is a **gap**, not a deferral. A change directory's own
rules already forbid a `goal` that only names work, so accommodating one would launder a
malformed input into a verdict; and a reported shape carries no change-level command to defer it
to. The change-level check is part of judging below, not a catch-all for units that cannot state
their own truth condition.

### What makes one

A check is **falsifiable and re-runnable by whoever judges it**, and it states the observation
that constitutes failing now and passing later. Re-running is the mechanism: it is what makes
red-first enforceable and what makes the hand-back loop terminate on something other than
opinion.

Runnable and *who runs it* are separate axes. An agent-run check is a command that decides by
exit status. A human-run check may be a runbook - explicit steps and a named observation -
because requiring a command everywhere would refuse every change whose executable check costs
more than the change itself, which is most interface work and most infrastructure. The verdict
format is identical either way, and "the human judges the diff" appears nowhere.

A human-run check stops the run **before any implementer is spawned** for that unit, and stops the
run: the check is written, and the verdict is a **gap** carrying the check, its path and how to run
it. A subagent cannot obtain a human verdict, and one that guesses it, or quietly substitutes a
command it can run itself, has changed the acceptance criterion to suit its own reachability.

That gap is resumable, and it is the one place where something is left behind before a gap returns.
A later invocation naming the same unit finds the check at the path the verdict named - committed at
HEAD if it was durable, in the change directory if it was not: it adopts that instead of authoring a
second check, takes the human's reported result as the red-first observation, and goes on to the
implementer. A check the human reports green needs no implementer, and the invocation says that
rather than manufacturing one. In a run of several units the remaining ones are not started, and
the verdict lists them, so resuming is the same command with that list.

Where neither a command nor a runbook can be written cheaply, this skill does not apply. Say so
and stop. A skill that accepts every input by weakening the check until it passes is the failure
mode red-first exists to prevent.

### Where it is written

Two rungs, and the question that decides between them is whether the repository already has a home
for this check.

**Durable** - the shape names the path, a `scope` anchor already pointing at a test file that need
not exist yet, or the repository's own test convention covers it. It is written there and committed
alone, and `<base>` is that commit. This is a test, and a test landing in the suite is the
deliverable, not pollution: every later unit's regression run re-runs it for free.

**Ephemeral** - neither names a home. A one-off script, and every runbook, is a working file: it is
written under the change directory at `checks/<unit id>`, or at `.scratch/checks/<unit id>` for a
reported shape which has no change directory, and it is **never committed**. `<base>` is HEAD as it
stood when the check was observed red. Whether `.scratch/` is ignored is each project's business,
the same way `mise-en-place` leaves it.

The rung is not a preference. Inventing a location means inventing a harness, and a skill that
refuses to invent a task decomposition should not invent a test layout either - so where the repo
has no convention to follow, the check does not go into the repo at all. What it costs is stated
under [Red first](#red-first), and it is one thing.

## Red first

Before the implementer exists, the framer puts the check in place and observes it failing **for the
stated reason**. A durable check is committed **alone** and that commit is `<base>`; an ephemeral
check is not committed and `<base>` is HEAD at the moment it was seen red.

Failing for the stated reason is not the same as failing. A check that cannot run - a missing
import, an absent fixture, a harness that does not load - also fails, and hands the implementer
two attempts to spend on plumbing. Whatever the check needs in order to reach its observation is
the framer's to write, and belongs in that same commit.

Either way the check's own creation sits outside the range being policed - the durable one because
its commit precedes `<base>`, the ephemeral one because it is in no commit at all - so neither needs
an exemption from the no-test-path rule below.

What the ephemeral rung costs is exactly one thing: "it was red" stops being re-verifiable at a
commit and becomes the framer's observation at a named HEAD. That is the price of not writing a
file the repository has no place for, and it is paid nowhere else - the boundary check, the
hand-back loop and the verdict are identical on both rungs.

A check that passes at `<base>` is not a check. Either the outcome already holds or the check
does not discriminate; both are the caller's to resolve, so it is a gap.

## The implementer

One per unit, spawned after that unit's check is red, with this brief. It is fixed rather than
composed per invocation, because it is the other half of the boundary check below - improvise the
wording and the two drift, in the direction of a brief that permits what the judge rejects. A unit
gets a fresh one: carrying the previous unit's context in would carry the previous unit's scope with
it, and hand-backs are the only thing a context is kept across.

```
A check has already been written and committed, and it currently fails. Make it pass.

Check:             <check path>
Run it with:       <command>              # omitted when the runner is human
Goal:              <task goal, verbatim>
Satisfies:         <requirement text, verbatim>
Constraints:       <the constraints and approach entries that apply>
You may edit:      <scope anchors>
You may not touch: <forbidden paths and globs>

- Do not edit the check. If making it pass would require changing what it observes -
  the check itself, a fixture it reads, a mock it installs, a default it depends on -
  that is a collision. Report it and stop; do not do it.
- Write no tests. The one that judges this task already exists and is not yours. If you
  want a test that does not exist, name it in your report instead of writing it.
- Commit each attempt before you report. An attempt that failed is wanted in history;
  work that exists only in your report does not exist. Stage by path - if the check is
  an untracked file, it stays untracked.
- Run the check yourself, as often as you like. Reporting that it passes without having
  run it is a failed attempt.
- If the check cannot be satisfied inside "you may edit" without touching "you may not
  touch" or breaking a constraint, name the specific collision and stop. Naming one
  costs you nothing. "I do not see how" is not a collision and gets one real attempt
  first.
- Do not widen scope, refactor adjacent code, or fix unrelated failures.

Report what you changed, whether the check passes, and the commits you made.
```

The fixture clause asks for more than the boundary check can enforce - a diff cannot tell a
legitimate fixture change from one that hollows the check out. That asymmetry is deliberate: the
brief asks, and the ceiling at the end of this file admits it is unenforced.

It writes no tests. Every test in the range is the framer's, which is what makes the boundary
check mechanical and the suite single-provenance. An implementer that wants a test it may not
write is reporting something rather than being obstructed: the check does not observe something it
believes matters, and that belongs back with whoever wrote the shape, in the same channel as a
collision.

It is told the goal, not only the check. The check is a proxy for the goal, and an implementer
holding only the proxy cannot tell "make this observation true" from "make the outcome true".
Withholding context is the wrong lever against overreach; `scope` and `forbidden` are that
lever.

It runs the check as often as it likes. The hand-back budget measures approach, not iteration -
spend it on import errors and it measures nothing.

### Hand-backs

The framer re-runs the check itself. Never the implementer's report: a report is a second
account of the diff, free to flatter it.

Still red, the work goes back to **the same implementer**, by message, carrying the check's
failure output verbatim. Its context is intact so it resumes rather than re-deriving an approach
from a diff it wrote. A fresh spawn re-reasons from scratch, which is where a second wrong
attempt comes from.

**At most two hand-backs**, then the verdict is red. Three failed attempts at one check is
evidence about the approach far more often than evidence about the implementer, which is why
exhaustion maps to `plan.escalate_if` and not to a complaint. Unbounded retry is how a wrong
approach gets ground in one plausible attempt at a time.

### Escalation from below

The implementer may report that the check cannot be satisfied, and what it must name decides
whether that costs an attempt.

**A collision the framer can verify** - the check requires a change where `forbidden` blocks it,
or it contradicts a constraint, or the only place it can be satisfied lies outside `scope` -
escalates immediately. It is knowable before any code, an attempt teaches nothing, and forcing
one produces a commit that is known-wrong and misleading in history.

**Difficulty** - "I do not see how" - is checkable by nobody and is the cheapest exit from hard
work if it is free. It gets one attempt first.

Either way the verdict is red and the reasoning is the failure output. There is no fourth
verdict: a separate one for the implementer's opinion makes opinion an exit from work.

## Judging

Green requires all of it: the check passes when the framer runs it, the boundary holds, and the
regression set holds.

### The boundary check

Over every path touched by **any commit** in the range - `git log --name-only --pretty=format:
<base>..HEAD` - and never the endpoint diff. An endpoint diff misses a path that was changed and
then put back, which is the whole attack: edit the check, pass it, revert the edit, and the final
state looks untouched.

Three conditions. A failure in any is a rejection, not a note, because a green check says nothing
about where the work landed.

- **Every touched path is allowed by `scope`.** Anchors normalize to their paths first, so a
  symbol or line anchor permits its whole file - a diff decides paths and nothing finer.
  Enforcement is file-level, and the verdict says so rather than implying it policed a symbol.
- **No touched path matches `forbidden`.**
- **No touched path is a test path.** An ephemeral check appearing in the range at all is a
  rejection under this condition: it is untracked by construction, so a commit containing it is
  an implementer that swept up a file it was told to leave alone.

No test path, rather than the check's own path, because every test in the range is the framer's.
The stronger rule is the mechanical one: which paths are tests is decidable from the convention
the frame-path precondition already required, whereas "the check plus anything that behaves like
it" is not. It also keeps the suite single-provenance - once the satisfier can add tests, nobody
downstream can tell which test was load-bearing, and one it got subtly wrong fails in a later
task's regression run looking exactly like a check failing.

The cost is that no test below goal level lands during a run. That is consistent with everything
else here: granularity follows falsifiability, so a test at that level means a task whose goal is
falsifiable at that level, which the shape decides rather than an implementer improvising it
mid-attempt.

In a reported shape there is no `forbidden` - `non_goals` are prose and yield no paths - so only
scope and the test paths are decidable, and the verdict names the asymmetry. The two conditions
that remain are the ones that admit paths rather than exclude them, so the boundary still holds
from the inside; what is lost is the check on a `scope` too wide to bound the work by itself.

### Regression

The repository's own suite, run whole, after every unit; then `plan.acceptance` when it is
non-empty, after the **last** unit of this run and not before. Judging order is this unit's check,
the suite, then acceptance - narrowest first, so a failure names the smallest thing that broke.

Acceptance last because it is the change-level check and a change with units still to run has no
business satisfying it. In a single-unit invocation the last unit is the only one, so this is what
the caller-as-loop already got.

The suite rather than a list of prior checks, because git records neither which commits were
checks nor how each was run. Re-running them individually would need state this skill does not
keep, and every durable check committed so far in this change is a test in the suite already. What
the whole suite buys is the thing a per-check verdict cannot: task four quietly breaking task two
while returning green three times.

A human-run check from an earlier unit is in no suite, and neither is an ephemeral one from a
previous invocation, so both are **skipped and named** - the verdict carries a
`regression_not_verified` list. An ephemeral check written earlier in *this* run is still on disk
and is re-run, which is the one thing the multi-unit form buys over the caller looping. Re-running it would force a human into every
later invocation of the change, which ends the unattended path after the first one. A partial
green reported as green is the only unacceptable option.

## The verdict

One of three per unit, and the difference between them is how far that unit got.

- **green** - the check passes, the boundary holds, the regression set holds.
- **red** - the check was written and committed red, an implementer worked, and it is still
  failing. Evidence about the approach; it feeds `plan.escalate_if`.
- **gap** - no verdict could be reached. The contract was unsatisfied, a precondition failed, no
  check could be constructed, or the check needs a human runner. Evidence about the input; it
  feeds back to whoever wrote the shape. Nothing is written, except in the human-runner case,
  where the check's own commit stands and the gap is resumable.

Collapsing red into gap is the expensive mistake: it replans a plan that was never tried.

This is the whole verdict, and it is a literal shape rather than a description of one, for the
same reason the brief above is: a caller that has to infer structure from prose is not an agent
caller.

One block per unit reached, in the order they ran, inside a run wrapper that is present whether one
unit ran or ten - a caller that has to detect which of two shapes it got is parsing prose again.
The run stops at the first non-green, so the last block's `verdict` is the run's, and a non-empty
`remaining` is what says it halted early.

```
units: [<ids, in the order named>]
remaining: [<ids never started>]        # empty when every unit reached a verdict
completed:
  - verdict: green | red | gap
    unit: <task id, or requirement id>
    check:
      path: <check path>
      durable: true | false           # false - written, never committed
      runner: agent | human
      command: <command>              # absent when the runner is human
    range: <base>..<head>             # absent on a gap that left nothing behind
    boundary: full | no-forbidden-list
    failure: |                        # red only - the check's own output, verbatim
      <output>
    attempts: <n>                     # red only
    reason: <the field, precondition, or construction that failed>   # gap only
    resumable: true | false           # gap only
    dependents: [<task ids>]          # empty for a reported shape
    regression_not_verified: [<check paths>]
```

No prose account of what the implementer did: the commits are that account, and a summary is free
to disagree with them.

`dependents` is the tasks whose `depends_on` names this one, read from `tasks/`. Not which tasks
are now runnable - that needs to know what else is done, which is state this skill does not keep,
so it reports the edge and leaves readiness to the caller. Choosing among them was never this
skill's.

## A ceiling this skill does not close

An implementer that wants green need not edit the check. It can edit what the check depends on -
a fixture, a mock, a config default, a helper the check imports - and the check then passes
honestly while the outcome does not hold. No diff filter decides that in general.

Nothing here catches it. What catches it is a human runner, or someone actually reading the
range. It is written down because the alternative is a reader assuming the boundary check
covered it.

## Prohibitions

- Does not settle the shape. It executes one that is already settled.
- Does not read the surrounding conversation. What it was given is what it has.
- Does not invent a check, a task decomposition, or a test setup. Each is a gap.
- Does not put a check into the repository where the repository has no home for it, and does not
  commit an ephemeral check.
- Does not let the implementer author or edit the check, write any test of its own, or have its
  report accepted in place of the check being run.
- Does not spawn an implementer before the check exists, is committed, and has been seen failing
  for the stated reason.
- Does not spawn an implementer for a human-run check.
- Does not judge the boundary from the endpoint diff. A path changed and then put back was still
  touched.
- Does not exceed two hand-backs, and does not respawn instead of continuing the same one.
- Does not report green without the boundary check and the regression set, or without naming what
  it could not verify.
- Does not return a fourth verdict, or report a gap as a red.
- Does not choose the nearest unit when the argument names an id no shape carries, and does not
  choose an order the shape does not already give.
- Does not start a unit after one that was not green, and does not run acceptance before the last
  unit.
- Does not decide which units are worth running in one invocation, or that the change is done.
- Does not create or name a branch, and does not commit on the default branch.
- Does not push, and does not open a pull request. Green means the next step is available.
- Does not rewrite, squash or amend history. The attempts that failed are the record.
- Does not stash, restore, or selectively stage work it did not write.
- Does not write state of its own - no status file, no log, no write to `change.md`.
