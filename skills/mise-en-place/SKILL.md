---
name: mise-en-place
description: Construct a change directory - spec, plan, tasks - from what the conversation, the repository and existing docs already determine, validate it, and report what is still missing. Does not interview; it names the gap and stops, and the user closes it however they like. One approval covers the whole change. Use to open a change, or to re-enter one whose plan a task proved wrong.
disable-model-invocation: true
---

# mise-en-place

Constructs one artifact: a change directory - spec, plan, tasks - that someone who was not in
this conversation can execute. Every invocation does the same three things in the same order:
synthesize from context, validate, report what is missing. How a gap gets closed - interview,
conversation, hand-edit, another skill - is the user's choice.

State lives in the artifact, never in the conversation, so an invocation survives context loss.

## Where things go

Resolve the changes directory first: default `.scratch/changes/`, overridden by a line matching
`changes dir: <path>` in the project's `CLAUDE.md`. It defaults to a scratch path so a
half-written spec is not swept into a commit. Do not add it to
`.gitignore` - whether `.scratch/` is ignored is each project's business.

A change lives at `<changes dir>/YYYY-MM-DD-<slug>/` - today's date, a 2-4 word kebab-case
slug. That is `<change dir>`; it holds `change.md` and a `tasks/` directory. The directory
name is the change's only identity - no `id` field duplicates it.

This skill touches no git.

## Every invocation

One invocation writes as much of the change as the evidence supports - spec, plan and tasks -
and asks for one approval covering all of it.

### 1. Find the change

Which directory this operates on is a fact - look it up, never ask. First hit wins:

1. **An argument.** A path - `/mise-en-place .scratch/changes/2026-08-10-csp-header` - or a bare
   slug resolved within `<changes dir>`. A path to a *file* resolves to the directory holding
   it. An argument wins even over a better-matching candidate. One resolving to no directory
   is an error: say so and stop - a typed path that does not exist is a typo, and creating a
   change from it buries the mistake in a directory name.

   A resolved directory with no `change.md` is **adopted**: write `change.md` into it and keep
   its existing name. Something got there first, and its date and slug are the change's
   identity now.
2. **A change already on disk.** Read `change.md` in every `<changes dir>/*/` and match the
   prompt: an exact slug match wins outright; otherwise a change whose slug or `spec.outcome`
   shares the prompt's distinctive terms - not "the", "add", "fix". Two survivors, or a single
   weak one, is a question for the user, not a coin flip. Prefer a match without
   `approvals.tasks: true`; if the only match is terminal, say so and stop - the user either
   re-enters it (see [Re-entry](#re-entry)) or names a new change.
3. **Create.** Only when step 2 found nothing.

Nothing forces a new change past a match; a wrong match is the ambiguity step 2 already routes
to the user.

Then read `change.md`. Its `approvals` are the truth - never rewrite the fields of an approved
phase. There is no `phase` field: the frontier is the first phase whose approval is false. A
new change starts with all approvals `false`.

### 2. Synthesize

Fill every field of `spec`, then `plan`, then `tasks` that the conversation, the repository,
an existing `CONTEXT.md` or `docs/adr/`, or another artifact in `<change dir>` already
determine. Stop at the first phase the evidence cannot fill: everything downstream of a gap is
written against a guess. That phase's gap is the report.

**Invent nothing.** A plausible guess in a field is indistinguishable from a decision the user
made. That is the failure this skill exists to prevent, and every rule below serves it.

A field is written only where the evidence for it can be named: a `path:line`, a
`path::symbol`, an ADR number, a quote of what the user said, or a quote of a field in another
artifact in `<change dir>`. No evidence, no write - the field stays empty and becomes part of
the gap.

Another artifact carries its own gate. One declaring an approval state that is false is not
evidence: report it unfinished and leave the fields it would have filled as gaps. Its wording
is not a schema either - a field whose meaning differs from the field here is restated against
this phase's rules, never copied across.

There is no evidence field: evidence lands in `plan.touchpoints` and task `scope`, whose
paths the script resolves, and in the prose body for everything else. The user is the gate on
whether it holds.

Stopping early: say whether the phase was unattempted or unfillable - the script cannot tell
them apart, and a user who is not told assumes it was tried.

Explore the area named in the prompt first, unless the conversation already covered it. A cold
conversation yields almost nothing, and the report does nearly all the work.

### 3. Validate, by script

```
bun <skill dir>/scripts/validate.ts <change dir>
```

`<skill dir>` is the directory holding this file. It takes no phase argument: a phase is
checked once it has content of its own or the gate before it is given. It exits:

| exit | meaning | what to do |
| --- | --- | --- |
| 0 | invariants hold | go to step 5 |
| 1 | not ready | its output is the gap; go to step 4 |
| 2 | malformed | a defect, not a gap. Fix it, then re-run here |

Report every line the script prints, warnings included. If `bun` is not
installed, stop and say so - do not review the rules by eye instead.

An approval standing under a revoked one is exit 2. The fix is the cascade in
[Re-entry](#re-entry) - never supplying the missing approval, which is the user's alone.

The script also warns on a capitalised term in a requirement that no `CONTEXT.md` defines, and
on any word the glossary lists under `_Avoid_`. That check is partial by design - it misses
lowercase terms and flags proper nouns - so it warns, never blocks.

### 4. Name the gap, then report it

The gap has two halves.

**What the script found** - missing fields, uncovered requirements, non-empty `open_questions`.
Mechanical and complete.

**What only a reader finds** - run the checklist below for every phase this invocation wrote,
and no others; a checklist run against unfilled fields invents work. Its output goes into the
report and nowhere else: it may not write a field, set an approval, or land in
`open_questions`. That list is state, and state records the user's judgement, not the reader's.
A doubt raised here dies with the invocation and is re-derived next time.

Then report, and stop:

- Questions, grouped by what each one unblocks.
- Each question carries the evidence synthesis found - `path::symbol`, an ADR, a quote. A
  question asked from zero context is generic, and generic questions spend attention for
  nothing.
- **No proposed answers.** The user's own understanding is the thing being drawn out.
- If synthesis yielded almost nothing, say so in one line first. A user who sees fifteen
  questions and does not know whether that is normal will assume the skill failed.

The report is not persisted. The one thing that should survive, a question the user judged
unresolved, already has a home in `open_questions`.

Then the invocation ends. Closing the gap happens in the conversation, and the next invocation
picks the answers up at step 2. Only exit 2 does not end the invocation: that is a defect, so
fix it and re-run the script in place.

### 5. The user approves

One presentation, covering every phase this invocation wrote and every warning the script
printed. The user is auditing writing they did not do, so every field carries its provenance.

- **spec and plan**: each field with where it came from - the quote, the anchor, the ADR
  number.
- **tasks**: one row per task - `goal` and `satisfies` - and nothing else. The script counts
  that every requirement is claimed by some task, never that *this* task delivers *that*
  requirement; ids, anchors and the `depends_on` DAG it has already decided. A row that looks
  wrong is a cue to open that file.

The user approves; this skill never does. One approval covers everything presented: set those
phases' `approvals` entries to `true` in a single edit. A second "do you approve?" is theatre
that trains the reflex to say yes.

`approvals.tasks: true` is terminal: a further invocation has nothing to advance.

If the user approves some of what was presented and not the rest, set only the flags they gave
and return to step 2 for what they rejected.

## Phases

### spec

Fields: `outcome`, `kill_criterion`, `non_goals`, `requirements`.

`outcome` is the change's observable result, and no vague qualifier belongs in it or in a
requirement.

No requirement names a technology or a file - that is an approach decision, and it belongs to
the plan.

`kill_criterion` warns when empty rather than blocking. Plenty of changes have no condition
that would stop them, and one written to clear a gate is invention.

More than about seven requirements usually means two changes. Check before writing any `plan`
field, while the split is still cheap. If the prompt describes several independent subsystems,
say so before synthesising anything and help split it. The user decides.

**Reader's checklist**: Does `kill_criterion` name a condition that could actually fire? Does
any term contradict `CONTEXT.md`? Is any in-scope uncertainty still too vague to state as a
question?

### plan

Fields: `approach`, `touchpoints`, `constraints`, `acceptance`, `escalate_if`.

`constraints` is the coordination slot - anything more than one task would otherwise decide
independently and inconsistently: names, signatures, data shapes, error contracts. Anchor them
where an anchor exists. A decision durable enough to outlive the change is an ADR.

`acceptance` is one command deciding whether the change as a whole works; all tasks done is
not the change works. Leave it empty when no single command can decide it. It is literal and
copy-pasteable - no placeholders, no `<...>`, no "your" - and decides by exit status. If exit
status alone cannot, pipe it into something that can:
`curl -sI $URL | grep -q '^content-security-policy:'`.

`escalate_if` names what would prove the approach wrong - the plan's counterpart to
`spec.kill_criterion`.

**Reader's checklist**: What could two tasks decide differently that `constraints` does not
pin? If the approach is wrong, which way does it fail, and is that in `escalate_if`?

### tasks

One file per task in `tasks/`. `change.md` names no tasks - the directory is the list. Two
places holding task state is two places that disagree.

A task's `goal` must be falsifiable: something you could look at the result and call false.
Nothing else in the file carries the task's truth condition, so a goal that only names work -
"update the middleware" - leaves it without one.

Writes no code, tests included. A `goal` names what to observe; the test that observes it is
the implementer's first act. No command belongs in the file: one fixed at design time pre-empts
that test and names code that does not exist yet. `scope` may still anchor a test file that has
yet to be written.

`depends_on` forms a DAG. An edge exists when the later task's goal cannot be observed until
the earlier one lands - not merely because two tasks touch the same file. Every task leaves the
tree green.

No cap on a task's goal length, scope width, or requirement count. A task is as big as its
seam, and the seam is judgement.

**Reader's checklist**: Is there a requirement whose only coverage is a task that cannot
really show it? Is a seam missing - a place the change should be observable and is not?

## open_questions

Every phase has one, `tasks` included. It holds only what the user judged unresolved - never a
doubt the reader raised.

An uncertainty that cannot be stated as a question is not an `open_question` - it is a gap in
the report, recurring every invocation until the phase gets sharp enough to name it. One that
can be stated has exactly three exits:

1. **Answered** - it becomes a field value and disappears.
2. **Blocks the design** - it stays in that phase's `open_questions`. Non-empty is exit 1 and
   blocks approval. The user resolves it or the change does not ship.
3. **Cannot be answered until code is touched** - it converts to a `plan.escalate_if` entry.

There is no fourth exit. `open_questions` is empty at approval by definition.

## Anchors

Any file reference takes one of four forms:

```
src/middleware/security.ts               the whole file
src/middleware/security.ts:34            one line
src/middleware/security.ts:34-51         a range
src/middleware/security.ts::applyHeaders a symbol
```

Anchor to a symbol; use a line only where there is no symbol to name (config blocks, markup,
data files). Lines rot when a task edits the file; symbols do not.

`forbidden` takes whole paths and globs only, never anchors. Forbidding half a file is a rule
nobody can reliably obey - if only part of a file is off-limits, the constraint is probably
wrong.

## Re-entry

A task can prove the plan wrong. Set `approvals.plan: false`, which cascades to
`approvals.tasks: false`, and invoke again. The specification survives - that is what stops a
replan from quietly renegotiating the outcome, and why the flags stay separate even though one
approval gives them all. Revoking `approvals.spec` cascades to both others. The cascade is not
optional; the script exits 2 on state that violates it.

## change.md shape

```yaml
---
approvals:                # given together; revoked separately, see Re-entry
  spec: false
  plan: false
  tasks: false

spec:
  outcome: "Every HTML response carries a Content-Security-Policy header."
  kill_criterion: "If the policy cannot be expressed without unsafe-inline, stop and re-scope."
                          # empty is fine when nothing would stop the change
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

tasks:                    # tasks live in tasks/*.md, one per file - the directory is the list
  open_questions: []
---
```

Prose body is optional. Use it for context a future reader needs and the fields cannot carry,
including the evidence behind a field where an anchor alone does not explain it. Do not restate
the fields in prose.

## tasks/T1.md shape

```yaml
---
id: T1                    # T followed by digits, unique across tasks/
goal: "An HTML response carries a content-security-policy header."
satisfies: [R1]           # requirement ids
scope:                    # anchors; a path that does not exist yet is fine
  - src/middleware/security.ts::applyHeaders
  - test/security.test.ts
forbidden:                # optional; whole paths and globs only, never anchors
  - path: "src/routes/**"
    reason: "Header is middleware-level; per-route changes mean the constraint was wrong."
depends_on: []
---
```
