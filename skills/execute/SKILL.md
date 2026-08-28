---
name: execute
description: Drive one task from a settled shape to a verified green - author the check before any code exists, watch it fail for the stated reason, hand the work to a separate implementer, then judge what comes back against the check and the commit range it produced. Takes one settled shape - a change directory written down, or the same fields reported into the prompt - one unit per invocation, and returns one verdict a calling agent can act on. Use once the shape is settled, never to settle it.
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

One invocation, one task, one verdict. The caller is the loop - it names the next task, because
a skill that picks its own next task is a driver loop wearing a smaller name, and one wrong
early check would then become a run of commits before anyone looked.

State lives in git. This skill writes no state of its own: not a status file, not a run log, and
nothing into `change.md`, which holds approvals it must not be able to touch.

## The input contract

One vocabulary, at two levels of completeness. `outcome`, `requirements`, `approach`,
`constraints`, `non_goals` and `touchpoints` mean the same thing wherever they arrive from; what
differs is whether they have been written down. The caller supplies them, and what arrives is
what this skill has: it does not scrape the surrounding conversation for anything the shape did
not report, because a skill that half-fills its own input behaves differently depending on who
invoked it. Copying a shape that was reported into this conversation is a different act, and
[Arguments](#arguments) draws that line.

**Written down - a change directory**: its path, and the id of one task. A decomposition exists,
so the unit is one task and the check comes from its `goal`; boundaries come from `scope` and
`forbidden`, obligations from `plan.constraints`, and the change-level check from
`plan.acceptance`.

**Settled but not written - a reported shape**: the fields verbatim, and which requirement to
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

Two forms reach a verdict, and each of them names one unit. Nothing else is passed: the form
decides which level the fields come from, and the level decides everything else.

**`/execute <change dir | slug> <task id>`** - the written-down level. A path, or a bare slug
resolved within the changes directory the way `mise-en-place` resolves one. The fields come off
disk and the conversation is not consulted at all, which is what makes this the form a subagent
framer can be handed.

**`/execute <requirement id>`** - the settled-but-not-written level. The fields are transcribed
from the shape most recently reported in this conversation, field by field, verbatim.

**`/execute`** with no unit is a **gap**. Choosing the unit belongs to the caller, in the same
class as choosing the next task, and a skill that picks one when the argument is empty has taken
the decision the empty argument failed to make. So is more than one unit - `/execute R1, R2` - and
that reason names the count. Naming both satisfies the half of the one-unit rule that is about
choosing, because the caller did choose; it does not satisfy the half that is about looking, since
R1's verdict is the evidence you would want before R2's check is written against a base it may
already be evidence against.

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

Each of these is a gap verdict, and nothing is written:

- **A dirty working tree.** The framer commits the check alone, and from a dirty tree that
  commit either sweeps up work it did not write or requires selective staging. Both make the
  base commit a lie that every later boundary check is measured against. Stashing is worse -
  the skill would be moving work it cannot restore if it fails mid-loop.
- **HEAD on the default branch.** The implementer commits, rejected attempts stay in history,
  and neither belongs on the trunk. Requiring a branch is not the same as creating one: naming
  a branch is the caller's decision, in the same class as choosing the next task.
- **No path for the check.** See below.
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

A human-run check stops the invocation **before any implementer is spawned**: the check is
written and committed, and the verdict is a **gap** carrying the check and how to run it. A
subagent cannot obtain a human verdict, and one that guesses it, or quietly substitutes a command
it can run itself, has changed the acceptance criterion to suit its own reachability.

That gap is resumable, and it is the one place where something is written before a gap returns. A
later invocation naming the same unit finds the check already committed at HEAD: it adopts that
commit as `<base>` instead of authoring a second check, takes the human's reported result as the
red-first observation, and goes on to the implementer. A check the human reports green needs no
implementer, and the invocation says that rather than manufacturing one.

Where neither a command nor a runbook can be written cheaply, this skill does not apply. Say so
and stop. A skill that accepts every input by weakening the check until it passes is the failure
mode red-first exists to prevent.

### Where it is written

From the shape where the shape says - a `scope` anchor may already name a test file that does
not exist yet. Otherwise from whatever the repository already does. Neither available is a gap:
inventing a location means inventing a harness, and a skill that refuses to invent a task
decomposition should not invent a test layout either.

## Red first

The framer commits the check **alone**, before the implementer exists, and observes it failing at
that commit **for the stated reason**. That commit is `<base>`.

Failing for the stated reason is not the same as failing. A check that cannot run - a missing
import, an absent fixture, a harness that does not load - also fails, and hands the implementer
two attempts to spend on plumbing. Whatever the check needs in order to reach its observation is
the framer's to write, and belongs in that same commit.

Two things fall out of committing it separately. The check's own creation sits outside the range
being policed, so it needs no exemption from the no-test-path rule below. And "it was red"
becomes a fact re-verifiable at a commit rather than a claim in a report.

A check that passes at `<base>` is not a check. Either the outcome already holds or the check
does not discriminate; both are the caller's to resolve, so it is a gap.

## The implementer

Spawned once, with this brief. It is fixed rather than composed per invocation, because it is the
other half of the boundary check below - improvise the wording and the two drift, in the
direction of a brief that permits what the judge rejects.

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
  work that exists only in your report does not exist.
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
- **No touched path is a test path.**

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

The repository's own suite, run whole, then `plan.acceptance` when it is non-empty. Judging order
is this unit's check, the suite, then acceptance - narrowest first, so a failure names the
smallest thing that broke.

The suite rather than a list of prior checks, because git records neither which commits were
checks nor how each was run. Re-running them individually would need state this skill does not
keep, and every check committed so far in this change is a test in the suite already. What the
whole suite buys is the thing a per-check verdict cannot: task four quietly breaking task two
while returning green three times.

A human-run check from an earlier task is in no suite, so it is **skipped and named** - the
verdict carries a `regression not verified` list. Re-running it would force a human into every
later invocation of the change, which ends the unattended path after the first one. A partial
green reported as green is the only unacceptable option.

## The verdict

One of three, and the difference between them is how far the invocation got.

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

```
verdict: green | red | gap
unit: <task id, or requirement id>
check:
  path: <check path>
  runner: agent | human
  command: <command>              # absent when the runner is human
range: <base>..<head>             # absent on a gap that wrote nothing
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
- Does not invent a check, a check's location, a task decomposition, or a test setup. Each is a
  gap.
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
- Does not choose the unit when the argument names none, or the nearest one when the argument
  names an id no shape carries.
- Does not choose the next task, run more than one unit, or decide that the change is done.
- Does not create or name a branch, and does not commit on the default branch.
- Does not push, and does not open a pull request. Green means the next step is available.
- Does not rewrite, squash or amend history. The attempts that failed are the record.
- Does not stash, restore, or selectively stage work it did not write.
- Does not write state of its own - no status file, no log, no write to `change.md`.
