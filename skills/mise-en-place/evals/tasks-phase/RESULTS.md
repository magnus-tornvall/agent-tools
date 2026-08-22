# Live run, 2026-08-22

40 generations: 4 fixtures x 2 arms x 5 samples. Each sample was written by a fresh context
given only its own rendered prompt and a scratch output directory — no arm saw the other's
wording, and none could reach the repository.

Reproduce with `bun prompts/render.ts <fixture> [--candidate]`, one fresh context per sample,
then `bun aggregate.ts <runs dir>`.

## What was under test

Two additions to the `tasks` phase, rendered into the candidate prompt from
`prompts/candidate/`:

1. **A task is a path, not a layer** — scope cuts through every layer including the test, so
   the goal is observable when the task lands; take the smallest set of requirements that can
   be seen working end to end, usually one.
2. **The wide-refactor exception** — one mechanical transformation with no isolating seam is
   sequenced expand / migrate-in-batches / contract, and *"that shape is a `plan.approach`
   decision and is already made before tasks are drafted."*

## Result

| fixture | discriminating metric | candidate | control | verdict |
| --- | --- | --- | --- | --- |
| 01 notification-prefs | `complete_path` | 0.73 [0.67-1] | 0.00 | **separated** |
| | `single_layer` | 0.27 [0-0.33] | 1.00 | **separated** |
| | `startable` | 0.37 [0.33-0.50] | 0.21 [0.20-0.25] | **separated** |
| | `req_fanout` | 1.13 [1-1.33] | 2.33 [2-2.67] | **separated** |
| | `critical_path` | 0.80 [0.50-1] | 0.58 [0.50-0.75] | overlapping, favours control |
| 02 rename-tenant-id | `expand_contract` | 1.00 | 1.00 | no difference |
| 03 csp-header | `req_fanout` | 1.30 [1-1.50] | 1.60 [1.50-2] | overlapping, favours candidate |
| 04 rename-neutral-plan | `expand_contract` | 0.00 | 1.00 | **separated, wrong way** |

### Addition 1 earns its place

Fixture 01 separates on four of six discriminating metrics with non-overlapping ranges across
all five samples, and loses none. The control produced a purely layer-shaped decomposition
every single run: `single_layer` 1.00 and `complete_path` 0.00, five for five.

The interesting part is *where* the control failed. Its goals were fine — falsifiable state
descriptions, not "add the column" (`work_shaped_goals` was 0 in every arm of every fixture,
so the existing falsifiable-goal rule is doing its job). What the control got wrong was scope
shape and requirement fanout: one task per layer, with R2 and R3 each claimed by three
different tasks. That is a gap the current wording genuinely does not close.

### Addition 2 fails, and takes addition 1 down with it

Fixture 04 is the same rename as 02, with a `plan.approach` that states the outcome and leaves
the sequencing open. The candidate collapsed a four-hundred-call-site rename across four
packages into **one task, five times out of five**:

> "The organisation identifier is exported from core and read at every call site in api, web,
> and jobs under the new name only; no source file mentions the old name, and the suite
> passes." — one task, thirteen scope anchors, no dependencies

The control produced the batched five-task sequence with the correct topology, five for five.

The cause is the deferral clause. By saying the expand-contract shape "is already made before
tasks are drafted", the exception hands the decision to `plan` — so when the plan is silent,
the exception never fires, and the verticality clause is left to conclude that the only
complete path through a rename is the entire rename. The addition meant to protect against
this is precisely what disabled it.

Fixture 02 cannot see any of that: its approved plan already names expand-contract, so both
arms copy it and the metric reads 1.00 either way. Two fixtures that look like duplicates
answered opposite questions, and only the one with a neutral plan was informative.

### No over-decomposition cost, and the opposite risk instead

Fixture 03 was built to catch a verticality rule pushing toward too many slices. It caught
nothing: `req_fanout` overlaps, mean slightly favouring the candidate, and both arms stayed
inside the task-count bound. The candidate ran *coarser* than the control (1.60 tasks vs
2.80), not finer.

Combined with fixture 04, the real hazard from addition 1 is the reverse of what the fixture
was designed for: the rule collapses decompositions rather than inflating them. The
`task_count` bound on 03 is guarding the wrong direction, and `req_fanout` cannot see a
single-task decomposition at all, because one task claiming every requirement scores a
perfect 1.00.

## What this changes

- Ship the path-not-layer clause.
- Do not ship the refactor paragraph as written. Either drop the sentence deferring the shape
  to `plan.approach` so the rule can fire while tasks are being drafted, or pair the
  verticality clause with a floor — a task that can only be observed once the whole change
  lands is one task too few.
- Add a metric that sees collapse. Nothing in the current set penalises a single task
  swallowing the change; `complete_path` rewards it with 1.00.

## Caveats

- Five samples per arm. Non-overlapping ranges at n=5 are suggestive, not significant.
- Four fixtures, all synthetic, with a file listing standing in for a repository. Real
  synthesis reads code, and anchoring against real symbols may change decomposition pressure.
- Every sample came from one model at one setting. Nothing here says how the wording behaves
  elsewhere.

---

# Third arm: the path clause alone, same day

The first run confounded the two additions — the candidate carried both, so "the candidate
collapsed fixture 04" could not distinguish which clause did it. `path-only` is the candidate
with the refactor paragraph deleted and nothing else changed.

| fixture | metric | path-only | candidate | control |
| --- | --- | --- | --- | --- |
| 01 | `complete_path` | 0.75 [0.67-1] | 0.73 [0.67-1] | 0.00 |
| 01 | `single_layer` | 0.25 [0-0.33] | 0.27 [0-0.33] | 1.00 |
| 01 | `req_fanout` | 1.33 | 1.13 [1-1.33] | 2.33 [2-2.67] |
| 01 | `task_count` | 3.40 [3-4] | 2.80 [2-3] | 4.80 [4-5] |
| 04 | `expand_contract` | **0.00** | **0.00** | 1.00 |
| 04 | `task_count` | **1** | **1** | 5 |

Two findings, and they point in opposite directions.

**The refactor paragraph is inert.** On fixture 01 it changes nothing that clears the noise,
and on 04 it does not prevent the collapse it was written to prevent. Delete it. Whatever the
wide-refactor sequence needs, it is not those five sentences in the `tasks` phase.

**The collapse belongs to the path clause, not the paragraph.** `path-only` produced one task
for the four-hundred-call-site rename in all five samples, exactly as the full candidate did.
So deleting the refactor paragraph does not fix fixture 04 — nothing in the `tasks` phase
does. The clause tells the drafter to find a complete observable path, and for a rename with
no isolating seam the only complete path is the whole rename. That is the clause working as
written.

## What that means for relying on `plan.approach`

It works, with one consequence worth being explicit about.

Fixture 04's plan is not neutral, it is defective: `plan.approach` reads "Rename the
identifier wherever it appears so that only the new name remains", which restates
`spec.outcome` and names no approach at all. It should not have passed its gate. So 04 does
not show the path clause failing on a reasonable plan — it shows what happens downstream of a
plan phase that abdicated.

But the control degrades gracefully there and both candidate arms do not. Today's wording
recovers a sensible batched sequence from a plan that says nothing; with the path clause, the
tasks phase follows the plan off the cliff. Adding the clause therefore makes `plan.approach`
load-bearing in a way it currently is not, and the place to spend the next effort is the plan
gate - an approach that restates the outcome is a gap the reader's checklist should name -
rather than a floor bolted onto `tasks`.

A floor would also be a sizing rule, which is what `tasks` already refuses to give: "A task
is as big as its seam, and the seam is judgement."
