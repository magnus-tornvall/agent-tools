---
name: mise-en-place
description: Construct a change directory - specification, plan, tasks - by synthesizing what the conversation, the repository and existing docs already determine, validating the result, and reporting what is still missing. It does not interview; it names the gap and stops, and the user closes it however they like. Each phase is gated by the user. The approved result hands off to an implementation loop. Use to open a change, and to resume or re-enter one whose plan a task proved wrong.
disable-model-invocation: true
---

# mise-en-place

A constructor for one contract: a change directory an implementation loop can execute
unattended. Every invocation does the same three things in the same order - synthesize
from context, validate, report what is needed to continue.

It forces the artifact and nothing else. How a gap gets closed - an interview, a
conversation, a hand-edit, a skill - is the user's choice, and this skill makes none of
it. The conversation already holds most of the answers; what it does not hold becomes a
report, not a question this skill asks.

State lives in the artifact, never in the conversation. That is what makes an invocation
resumable after context is lost.

## Where things go

Resolve the changes directory once, before anything else:

- default `docs/changes/`
- overridden by a line matching `changes dir: <path>` in the project's `CLAUDE.md`

The change lives at `<changes dir>/YYYY-MM-DD-<slug>/`, where the date is today and the
slug is 2-4 kebab-case words. That directory is `<change dir>`. It holds `change.md` and
a `tasks/` directory. The directory name is the change's only identity - no `id` field
duplicates it.

This skill touches no git. It creates no branch and makes no commit. Committing is the
user's; branching belongs to the implementation loop.

## Every invocation

The same loop, whichever phase the change is in.

### 1. Find the change, then read its state

Which directory this is operating on is a fact, so look it up - never ask. First hit wins:

1. **An argument.** Either a path - `/mise-en-place docs/changes/2026-08-10-csp-header` - or a
   bare slug resolved within `<changes dir>`: `/mise-en-place csp-header`. Always wins, even
   over a better-matching candidate. An argument that resolves to no directory is an
   error: say so and stop. It is not a request to create one - a typed path that does not
   exist is a typo, and creating a change from it buries the mistake in a directory name.
2. **A change already on disk.** Read `change.md` in every `<changes dir>/*/` and match
   against the prompt, in this order:
   - an exact slug match wins outright;
   - otherwise, a change whose slug or `spec.outcome` shares the prompt's distinctive
     terms - not "the", "add", "fix";
   - two or more survivors, or a single weak one, is a question for the user, not a coin
     flip.
   Prefer a match without `approvals.tasks: true`. If the only match is terminal - approved
   through `tasks` - say so and stop: there is nothing to advance, and the user either
   re-enters it (see Re-entry) or names a new change.
3. **Create.** Only when step 2 found nothing.

Deriving a fresh `YYYY-MM-DD-<slug>` without step 2 is the failure this ordering exists to
prevent: the same intent named a day later, or worded differently, silently opens a second
change and re-answers a phase the user already approved. A terminal change is scanned for
the same reason - excluding it is exactly how the duplicate gets created.

There is no way to force a new change past a match. If step 2 matched wrongly, that is
exactly the ambiguity it already routes to the user.

Then read `change.md`. Its `phase` and `approvals` are the truth - never restart an
approved phase. A new change starts at `phase: spec` with all approvals `false`.

### 2. Synthesize

Fill every field of the current phase that the conversation, the repository, or an
existing `CONTEXT.md` and `docs/adr/` already determine.

A field is written only where the evidence for it can be named: a `path:line` anchor, a
`path::symbol`, an ADR number, or a quote of what the user said. No evidence, no write -
the field stays empty and becomes part of the gap in step 4.

This is a discipline over what may be written, not a schema. There is no evidence field,
because a script can check that such a field is *filled* and never that it is *true* - and
a checkable-but-meaningless slot would convert "I must be able to defend this" into "fill
the slot", which is the one failure this skill exists to prevent. Evidence lands in
`plan.touchpoints` and task `scope`, whose *paths* the script resolves - the symbol or line
after them it does not, so an anchor can point at nothing and still pass - and in the prose
body for everything else. It is shown to the user at step 5. The user is the gate on
whether it holds up.

Explore the area named in the prompt before writing anything, if the conversation has not
already covered it.

Invent nothing. A gap is a gap; a plausible guess written into a field is indistinguishable
from a decision the user made, which is the one failure this skill exists to prevent.

If the conversation is cold - the change was named in a single sentence and nothing else -
synthesis yields almost nothing and the report in step 4 does nearly all the work. Same
machinery, same order.

### 3. Validate, by script

```
bun <skill dir>/scripts/validate.ts <change dir>
```

`<skill dir>` is the directory holding this file. The script reads `phase` from
`change.md`, checks that phase and every phase upstream of it, and exits:

| exit | meaning | what to do |
| --- | --- | --- |
| 0 | phase invariants hold | go to step 5 |
| 1 | not ready | its output is the gap; go to step 4 |
| 2 | malformed | a factual or structural defect, not a gap. Fix it, then re-run here |

Report every line the script prints, including warnings. Silence is not a pass. If `bun`
is not installed, stop and say so - do not review the rules by eye instead.

The gate is checked in both directions and both misalignments are exit 2: an approval
standing under a revoked one, and a `phase` set past a gate that was never given. The fix
for the second is always to set `phase` back to the first unapproved phase - never to
supply the missing approval, which is the user's and no one else's.

The script also warns on a capitalised term in a requirement that no `CONTEXT.md` defines,
and on any word the glossary lists under `_Avoid_`. That check is deliberately partial: it
misses lowercase terms and flags proper nouns that were never domain terms. So it warns, it
never blocks, and whether every domain noun is glossed stays a question on the spec
checklist. Nothing here says how the glossary gets written.

### 4. Name the gap, then report it

The gap has two halves.

**What the script found** - missing fields, uncovered requirements, non-empty
`open_questions`. Mechanical and complete.

**What only a reader finds** - run the checklist for the current phase below. Its output
goes into the report and nowhere else. It may not write a field value, may not set an
approval, and may not be written into `open_questions`: that list is state, it blocks a
gate, and state records the user's judgement, not the reader's. A doubt raised by whatever
is reading this file should die with the invocation and be re-derived next time.

Then report, and stop. The report is the invocation's output:

- Questions, grouped by what each one unblocks.
- Each question carries the evidence synthesis found - `path::symbol`, an ADR, a quote -
  because a question asked from zero context is generic, and a generic question spends the
  user's attention for nothing.
- **No proposed answers.** Evidence is a fact; a proposed field value is a preconception,
  and the user's own understanding of the problem space is the thing being drawn out here.
  Report what was found, never what it probably means.
- If synthesis yielded almost nothing, say so in one line before the questions. A user who
  sees fifteen questions and does not know whether that is normal will assume the skill
  failed.

The report is not persisted. It is re-derivable from the artifact plus the script, and a
written copy is a second place holding the same thing that goes stale the moment a field
is filled. The one thing that should survive - a question the user judged genuinely
unresolved - already has a home in `open_questions`.

Then the invocation ends. Closing the gap happens in the conversation, by whatever means
the user prefers, and the next invocation picks the answers up in step 2. The only thing
that does not end the invocation is exit 2: that is a defect, not a gap, so fix it and
re-run the script in place.

**What belongs in the script.** A check earns a place there only when a wrong answer is
mechanically decidable. Everything else is a checklist line or a warning, and a claim that
is neither belongs in no table in this file. The pull is always toward making the script
check more; followed all the way it turns the gate into a checklist and moves judgement
from the user to a regex.

### 5. The user approves

Present the phase's fields, each with where it came from - the quote, the anchor, the ADR
number - and every warning the script printed. Synthesis-first means the user is auditing
writing they did not do, and provenance is what makes that an audit rather than a skim. It
is also the only enforcement the evidence discipline gets, since deliberately no script
checks it.

The user approves; this skill never does.

On approval set that phase's `approvals` entry to `true` and advance `phase` in the same
edit. Written separately they can be interrupted between the two writes, and both halves
are defects on their own: an approval on a non-terminal current phase, and a `phase` past a
gate not yet given. If a later phase exists, return to step 2 for it - an approval is
progress, and stopping to make the user re-type the command buys nothing, so one invocation
may carry all three gates. At `tasks` there is no later phase, so only the approval is
written: `phase` stays `tasks`, and `phase: tasks` with
`approvals.tasks: true` is the terminal state - the change is ready for handoff and a
further invocation has nothing to advance.

## Phases

### spec

Fields: `outcome`, `kill_criterion`, `non_goals`, `requirements`.

No requirement names a technology or a file. That is an approach decision wearing a
requirement's clothes, and it belongs to the plan.

More than about seven requirements usually means two changes. If the prompt describes
several independent subsystems, say so before any of this and help split it - do not spend
a synthesis and a report on something that needs decomposing. The user decides.

**Reader's checklist**: Is `outcome` falsifiable, or does it merely sound good? Does
`kill_criterion` name a condition that would actually stop the change, or one that can
never occur? Does any requirement encode a mechanism rather than an observable result?
Does any term contradict `CONTEXT.md`? Is any in-scope uncertainty still too vague to
state as a question?

### plan

Fields: `approach`, `touchpoints`, `constraints`, `acceptance`, `escalate_if`.

`constraints` is the coordination slot - anything more than one task would otherwise
decide independently and inconsistently: names, signatures, data shapes, error contracts.
Anchor them where an anchor exists. It is not a record of decisions; a decision durable
enough to outlive the change is an ADR.

`escalate_if` names the circumstances where the implementer stops rather than adapts.
Without it, pinning turns "improvises badly" into "proceeds confidently off a cliff".

`acceptance` is one command deciding whether the change as a whole works, distinct from any
task's `verify`. All tasks done is not the change works. Leave it empty if no single
command can decide it.

**Reader's checklist**: What could two tasks decide differently that `constraints` does
not pin? If the approach is wrong, which way does it fail, and is that in `escalate_if`?
Does `acceptance` test the outcome or merely re-run the tasks' own checks?

### tasks

One file per task in `tasks/`. `change.md` names no tasks - the directory is the list.
Two places holding task state is two places that disagree.

`verify` is a literal command that decides truth by exit status. Copy-pasteable. No
placeholders, no `<...>`, no "your". If exit status alone cannot decide it, pipe it into
something that can: `curl -sI $URL | grep -q '^content-security-policy:'`.

Run each `verify` and record the outcome in `verify_result`. This catches a command that
was never real - the cheapest and most common forgery - before an agent burns a run on it.
A command that cannot run yet (needs a booted service, a migration, a deploy) is
`verify_result: unrun`, with the reason in the body. A command that already passes is
either a no-op task or a check that does not test the change; the script warns, and the
warning is the user's to judge.

`verify_result` is user-audited, not checked. The script cannot tell a recorded `fail` from
one nobody ran, and cannot read whether the body explains an `unrun` - only that the field
is non-empty, which would turn "say why" into "type something". It warns on `pass` and on
`unrun`, and that is the whole of the mechanical check.

`depends_on` forms a DAG. Every task leaves the tree green.

There is no cap on a task's goal length, scope width, or requirement count. A task is as
big as its seam, and the seam is judgement.

**Reader's checklist**: Would each `verify` fail before the change and pass after, or does
it merely run? Is there a requirement whose only coverage is a task that cannot really
prove it? Is a seam missing - a place the change should be observable and is not?

## open_questions

Every phase has one, `tasks` included. It holds only what the user judged unresolved -
never a doubt the reader raised, which belongs in the report and dies with the invocation.

The three exits below presume the uncertainty is stateable as a question. One that is not
is not an `open_question` - it is a gap in the report, and it recurs every invocation until
the phase gets sharp enough to name it.

A question that cannot be settled has exactly three exits:

1. **Answered** - it becomes a field value and disappears.
2. **Blocks the design** - it stays in that phase's `open_questions`. Non-empty is exit 1
   from the script and blocks approval. The user resolves it or the change does not ship.
3. **Cannot be answered until code is touched** - it converts to a `plan.escalate_if`
   entry. The loop stops there and asks.

There is no fourth exit. `open_questions` is empty at approval by definition, so it never
reaches the handoff.

## Anchors

Any file reference takes one of four forms:

```
src/middleware/security.ts               the whole file
src/middleware/security.ts:34            one line
src/middleware/security.ts:34-51         a range
src/middleware/security.ts::applyHeaders a symbol
```

Anchor to a symbol; use a line only where there is no symbol to name (config blocks,
markup, data files). Lines rot when a task edits the file; symbols do not.

`forbidden` takes whole paths and globs only, never anchors. Forbidding half a file is a
rule an agent cannot reliably obey and a reviewer cannot cheaply check - if only part of a
file is off-limits, the constraint is probably wrong.

## Re-entry

A task can prove the plan wrong. Set `approvals.plan: false`, which cascades to
`approvals.tasks: false`, set `phase: plan`, and invoke again. The specification survives.
Revoking `approvals.spec` cascades to both others. The cascade is not optional - an
approval standing downstream of a revoked one is malformed state, and the script exits 2
on it.

## change.md shape

```yaml
---
phase: spec               # spec | plan | tasks
approvals:
  spec: false
  plan: false
  tasks: false

spec:
  outcome: "Every HTML response carries a Content-Security-Policy header."
  kill_criterion: "If the policy cannot be expressed without unsafe-inline, stop and re-scope."
  non_goals:
    - "Not adding CSP reporting."
    - "Not touching the existing security headers middleware ordering."
  requirements:           # ids are R followed by digits
    - id: R1
      text: "An HTML response from any route carries a content-security-policy header."
    - id: R2
      text: "The policy value is configurable per environment without a rebuild."
  open_questions: []

plan:
  approach: "Set the header once in the existing security middleware, value read from env."
  touchpoints:            # anchors into code that exists now
    - src/middleware/security.ts::applyHeaders
    - src/config/env.ts:12
  constraints:            # what more than one task would otherwise decide differently
    - "Header set in src/middleware/security.ts::applyHeaders, not per-route."
    - "Policy string read from CSP_POLICY env var; empty means header omitted."
  acceptance: "npm test"  # one command deciding the whole change; empty if none can
  escalate_if:
    - "The policy requires unsafe-inline to keep any page working."
    - "An existing test must be modified to pass."
  open_questions: []

tasks:
  open_questions: []
---
```

Prose body is optional. Use it for context a future reader needs and the fields cannot
carry, including the evidence behind a field where an anchor alone does not explain it.
Do not restate the fields in prose.

## tasks/T1.md shape

```yaml
---
id: T1                    # T followed by digits, unique across tasks/
status: todo              # todo | done - the only field the implementation loop may write
                          #   always todo when written; `done` is the loop's to set
goal: "An HTML response carries a content-security-policy header."
satisfies: [R1]           # requirement ids
scope:                    # anchors; a path that does not exist yet is fine
  - src/middleware/security.ts::applyHeaders
  - test/security.test.ts
verify: "npm test -- security.test.ts -t 'sets CSP header'"
verify_result: fail       # pass | fail | unrun - recorded when the task was written
forbidden:                # optional; whole paths and globs only, never anchors
  - path: "src/routes/**"
    reason: "Header is middleware-level; per-route changes mean the constraint was wrong."
depends_on: []
---
```

## Handoff

`approvals.tasks: true` is the gate. What the implementation loop may read, what it may
write, and where it stops is [HANDOFF.md](./HANDOFF.md) - that contract describes the loop,
not this skill.

## Prohibitions

- Does not approve anything. The user approves.
- Does not interview. It reports the gap and stops; closing it is the user's, by whatever
  means they choose.
- Does not propose a field value in the report. Evidence, never a preconception.
- Does not invent a field value to fill a gap. A gap is reported, and an unresolved one is
  an `open_question` that blocks.
- Does not let the reader's checklist write a field, set an approval, or add an
  `open_question`.
- Does not write implementation code or test bodies. Test names and assertions, yes.
- Does not branch, commit, or run a baseline. Not its half.
- Does not prescribe how the glossary or an ADR gets written - only that the artifact
  survives the script's warnings.
- No vague qualifiers in `outcome` or `requirements`.

## Known gap

What happens to `<change dir>` after the change is done - deleted, archived, or harvested
into an ADR first - is unspecified. That decision sits downstream of the implementation
loop, which is out of scope here.
