# Board

Where an item lives on the `sliceworks` board (backlog-md, task prefix `ITEM`), and who moves it.
The board is the only durable state: an agent reads its inputs from it and writes its result back
to it.

All writes go through the `backlog` CLI. Hand-edited frontmatter is dropped by the next CLI edit and
bypasses the CLI's locks.

## Durable IDs

| ID | Is | On the board |
|---|---|---|
| `#58` | item | task `ITEM-58` |
| `#58/S3` | slice | subtask `ITEM-58.3` |
| `#58/D2` | decision, any tier | one line in `ITEM-58`'s implementation notes |
| `#58/A1` | assumption | one line in `ITEM-58`'s plan field (the brief) |

A **slice** is a vertical slice: an end-to-end increment that passes the slice gate on its own. It
is stored as a subtask (`--parent`), with `--depends-on` for the order slices must land in.
Subtask numbers are slice numbers. A split archives the old subtask and creates the next number
(`#58/S5 · split from S3`); a number is never reused.

## Where each artifact lives

| Artifact | Location |
|---|---|
| Spec | The item's description |
| Acceptance cases | `--ac` on the slice they belong to |
| [Brief](brief.md) | The item's plan field. Assumptions and the owner's ✓/✗ marks sit inline. When the brief does not fit, the plan field holds the spec question instead |
| Decision, any tier | `#58/D2 · <tier> · <decision> — <slice>` in the item's implementation notes. A ruling, reversal or promotion is appended to its line |
| Mid-flight DECIDE [card](card.md) | The parked slice's implementation notes; once ruled, the ruling goes on the decision's line on the item |
| [Debrief](debrief.md) | The item's final summary |
| Gate and review output | Saved by the gate or reviewer, linked from the item with `--ref` |
| Owner touch | One comment per touch, author `owner`: `<touch> · <minutes> min` |

Each agent writes its own field in a single `backlog task edit` as its last action. An empty field
means the step did not finish.

## Statuses

Columns: `Spec`, `Planning`, `Awaiting you`, `Ready`, `Implementing`, `Reviewing`, `Gating`,
`Judging`, `Done`.

Only the orchestrator tick and the inbox change a status, with one exception: the owner moves a
finished spec to `Planning`. Agents write content and exit; the tick reads it and moves the item.

### Item

| From | To | Moved by | When |
|---|---|---|---|
| Spec | Planning | owner | The spec is written |
| Planning | Awaiting you | tick | The plan field is non-empty |
| Awaiting you | Ready | inbox | The owner has ruled on the brief |
| Awaiting you | Spec | inbox | The owner revises or splits the spec |
| Ready | Implementing | tick | Next tick |
| Implementing | Reviewing | tick | Every slice is `Done` |
| Implementing | Awaiting you | tick | A fourth DECIDE is logged: the spec was not ready |
| Reviewing | Gating | tick | The delta re-check's output is linked |
| Gating | Judging | tick | The integration gate passed and its output is linked |
| Judging | Awaiting you | tick | The final summary is non-empty |
| Awaiting you | Done | inbox | The owner accepts the debrief |
| Awaiting you | Implementing | inbox | The owner sends the item back; the reason becomes a new slice |

`Reviewing` covers both reviews, the fix round and the delta re-check. `Gating` on an item means
the integration gate. `Done` means accepted; pushing and merging happen off the board.

### Slice

A slice uses `Ready`, `Implementing`, `Gating`, `Awaiting you` and `Done`. Its item stays in
`Implementing` until every slice is `Done`.

| From | To | Moved by | When |
|---|---|---|---|
| Ready | Implementing | tick | Every slice it depends on is `Done` |
| Implementing | Gating | tick | The implementer's final summary on the slice is non-empty |
| Implementing | Awaiting you | tick | An unruled DECIDE card is in the slice's notes |
| Awaiting you | Implementing | inbox | The owner has ruled on the card |
| Gating | Done | tick | The slice gate passed and its output is linked |
| Gating | Implementing | tick | The slice gate failed |

### Reading `Awaiting you`

| On the board | The owner is asked to |
|---|---|
| A slice (subtask) | Rule on one DECIDE card |
| An item whose plan field holds a spec question, or with more than three DECIDEs in its notes | Revise or split the spec |
| An item without a final summary | Rule on the brief |
| An item with a final summary | Accept, reverse a VETO, or send back the debrief |
