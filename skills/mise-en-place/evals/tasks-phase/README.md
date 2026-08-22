# tasks-phase eval

A smoke test for one question: does adding a vertical-slice rule to the `tasks` phase of
`SKILL.md` change the decomposition for the better, and at what cost?

It grades the `tasks` phase only. The fixtures arrive with `spec` and `plan` already
approved, so nothing about those phases is under test.

## The two modes, and which one proves anything

```
bun run.ts                        calibration
bun run.ts <fixture> <dir>...     a live comparison
```

**Calibration** grades the hand-written sample decompositions checked in under each fixture
and asserts the metrics separate them the way the fixture declares. It tests the grader.
It says nothing whatever about `SKILL.md` - the samples were written to be a horizontal
decomposition and a vertical one, so of course they come out that way.

Calibration passing is the precondition for trusting a live run, not a result. A grader that
cannot tell a hand-written horizontal decomposition from a hand-written vertical one will not
see the difference in generated output either.

**A live comparison** grades real `tasks/` directories, one per arm, that a model produced
from the prompts in `prompts/`. This is the only mode that can say whether a wording earned
its place.

## Running a live comparison

```
bun prompts/render.ts 01-notification-prefs             > /tmp/control.md
bun prompts/render.ts 01-notification-prefs --candidate > /tmp/candidate.md
```

Each renders a standalone prompt: the `tasks` rules lifted out of `SKILL.md`, the approved
`change.md`, and a file listing standing in for the repository. The control arm is
*extracted* from `SKILL.md`, never copied, so it cannot drift from the skill under test; the
candidate arm is the same text plus `prompts/candidate/`. `diff` the two and the only
difference is the wording being measured.

Give each prompt to a fresh context. Collect the `tasks/` directory each produces, then:

```
bun run.ts 01-notification-prefs runs/control/tasks runs/candidate/tasks
```

Two things this protocol needs and cannot enforce:

- **Fresh contexts, and a context that has not seen the other arm.** A model that has read
  the candidate wording will write vertical slices under the control prompt too.
- **Repetition.** One sample per arm on one fixture is an anecdote. Run each arm five or more
  times and read the spread before believing a difference.

## What the metrics are

Every metric is computed from the task files alone - `scope` anchors, `satisfies` ids, and
the `depends_on` DAG. None of them reads intent, and only one reads wording. The rule from
`validate.ts` carries over: a metric earns a place only where a wrong answer is mechanically
decidable.

| metric | what it counts |
| --- | --- |
| `complete_path` | fraction of tasks whose scope reaches two or more product layers *and* a test layer |
| `single_layer` | fraction reaching exactly one product layer - the layer-shaped task |
| `critical_path` | longest chain, normalised. 0 = every task startable now, 1 = one queue |
| `startable` | fraction with no blockers |
| `req_fanout` | mean tasks claiming a given requirement. 1 = one task delivers one requirement |
| `unclaimed` | tasks claiming no requirement at all |
| `expand_contract` | is the DAG one source, a fan of batches, one sink blocked by all of them |
| `work_shaped_goals` | advisory, lexical: goals naming work done rather than a state |

A fixture may only draw a conclusion from the metrics in its own `discriminates` list. The
rest print for context. Without that rule every fixture reports nine numbers, nine numbers
read as a score, and a score invites tuning the wording until it moves.

`work_shaped_goals` is the one metric that reads wording, so it is never a discriminator
anywhere - it is a hint for a human reading the output, in the same spirit as a `validate.ts`
warning.

## The fixtures, and why each one exists

**`01-notification-prefs`** - the case for the rule. A per-user setting across store,
service, interface and test: it admits an obvious layer decomposition and an obvious path
decomposition, and every discriminating metric separates them. If the candidate wording does
nothing here, it does nothing.

**`02-rename-tenant-id`** - the case for the exception. One mechanical rename across four
packages. `forced-vertical` slices it by feature, which scores *better* than the correct
expand-contract sequence on `complete_path`, `single_layer` and `startable` - a declared
inversion the calibration asserts still holds. Only `expand_contract`, read off the DAG, sees
which one can actually land green. This fixture is the argument that the two additions are
one addition: the verticality rule creates the failure mode the exception exists to catch, so
shipping the first without the second makes the skill worse on this change than saying
nothing.

**`03-csp-header`** - the cost. The skill's own worked example, decomposed two ways, *both
of them vertical*. `over-split` chops it finer than the change has seams for, and it beats
the two-task decomposition on `complete_path`, `single_layer` and `critical_path`. The only
ranked metric that notices is `req_fanout`, and the only hard stop is a task-count bound.
This is the fixture that decides whether "usually one requirement" stays in the candidate
wording: without that clause, a verticality rule is an incentive to over-decompose, and
nothing in `validate.ts` would catch it.

## What this harness cannot tell you

- Whether a decomposition is **correct**. Shape is not truth; that is the user's gate, and
  the skill is built so no script takes it.
- Whether a task is **the right size**. There is no metric for it here, deliberately: the
  skill declines to give one, and a number would become the rule.
- Whether the wording generalises past three fixtures. It is a smoke test.

## Relationship to `validate.ts`

Disjoint by design. `validate.ts` decides whether a change may be approved; this decides what
shape a decomposition has. They overlap on nothing, and the fixtures here are prompt inputs
rather than real repositories, so their anchors do not resolve on disk and `validate.ts`
would report them as unresolved touchpoints. Do not point it at them.

One thing calibration did surface about `validate.ts`: it checks that every requirement is
claimed by some task, never that every task claims some requirement. The horizontal sample in
fixture 01 has two tasks claiming nothing and passes that check. `unclaimed` is that gap
measured, not yet a proposal to close it.
