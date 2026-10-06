---
name: inbox
description: List everything waiting on the owner on the sliceworks board, take the owner's rulings on briefs and debriefs, and record them on the board. Opened by the owner in scheduled windows.
disable-model-invocation: true
---

# Inbox

You show the owner what waits on them on the `sliceworks` board, take their rulings on briefs and
debriefs in this conversation, and write the rulings to the board. The owner never edits the board
by hand; you are the only writer.

Read before the first ruling: [board](../../docs/board.md), [brief](../../docs/brief.md),
[debrief](../../docs/debrief.md), [card](../../docs/card.md), [rubric](../../docs/rubric.md).

## Limits

- Run every `backlog` command with `BACKLOG_CWD=~/dev/me/ai/backlog/sliceworks`. Write to the
  board only through the `backlog` CLI.
- Change only tasks in `Awaiting you`.
- Write nothing for an item until its whole ruling is in and checked. Then any new slices first,
  and the item itself last, in one edit.
- Multi-line values need real newlines: `--plan $'line one\nline two'`. A literal `\n` is stored
  as text.
- `--append-notes` puts a blank line between appends. Write implementation notes with `--notes`,
  holding the existing notes plus your change.

## 1. List

`backlog task list --status "Awaiting you" --plain`, then `backlog task view <ID> --plain` for
each. Sort every entry into one of four kinds, first match wins:

| On the board | Kind | Handled here |
|---|---|---|
| Has a `Parent:` line (a slice) | A DECIDE card raised mid-flight | No |
| Plan field starts `SPEC QUESTION`, or more than three `DECIDE` lines in the notes | A spec to revise or split | No |
| An item with a final summary | Debrief | Yes |
| An item without a final summary | Brief | Yes |

Show every entry, one line each: ID, title, kind. Mark the two kinds not handled here as waiting
outside the inbox, so they are seen. Then ask which item to take.

## 2. Time the touch

Every item the owner rules on is one touch. Run `date +%s` when you show the item and again just
before you write its ruling. The touch time is the difference in whole minutes, rounded up, at
least 1. The owner types no time.

The touch is logged with the ruling, on the item:

```
--comment "brief · <minutes> min" --comment-author owner
```

`debrief · <minutes> min` for a debrief.

## 3. Brief

Show the plan field as written.

The owner answers in reply, e.g. `A2 ✗, D2 B`:

- An ordinary line (Direction, Shape, Costly assumptions, Deviations, Out of scope) is ✓ or ✗. An
  unmarked line is ✓. A ✗ may carry a reason.
- Each DECIDE card needs an answer: an outcome, `Neither:` with what instead, or the fact a hinge
  card asks for. Silence never settles a DECIDE.

If any DECIDE card is unanswered, write nothing: name the unanswered cards and wait. Ask about an
answer you cannot map to a line or a card; do not guess.

Then write, in one `backlog task edit ITEM-58` call:

1. `--plan` — the plan field with each ✗ appended to its line as ` · ✗`, or ` · ✗ <reason>`, and
   each DECIDE card followed by one line `Ruling: <answer>`. Nothing else changes; ✓ is not
   written.
2. `--notes` — the existing notes plus one line per D ID the brief carries. A deviation with a
   DECIDE card gets only the card's line:
   - per DECIDE card: `#58/D2 · DECIDE · <the decision as ruled> — <slice it blocks> · owner: <answer>`
   - per deviation without a card: `#58/D1 · VETO · <the deviation> — <slice it names, else #58> ·
     owner ✓`, or `owner ✗ <reason>`. A deviation contradicts the spec, so it is at least VETO.
3. `--status Ready`, and the touch comment.

## 4. Debrief

Show the final summary ID by ID. Under each line with an S, A or D ID the brief carried, show the
brief's line with the same ID.

The owner answers in reply:

- **Accept** — the whole debrief, as is.
- **Reverse a VETO** — per VETO card, by D ID. The VETO is already applied, so reversing it means
  undoing it.
- **Send back** — with a reason.

A reversal and a send-back can come together; each gives its own new slice. Promoting a Logged
decision to VETO is not recorded by the inbox; if the owner asks for it, say so.

Before any write, check that the notes hold a line for every reversed D ID. If one is missing,
write nothing and tell the owner: the line the implementer should have written is missing.

For each new slice, draft it and show the draft before writing: title, description, and one
acceptance case `Given <context>, when <event>, then <observable outcome>`. The owner corrects or
confirms it.

- A send-back slice: the reason is the description.
- A reversal slice: title `Undo #58/D4`; the description restates the VETO card's decision and
  the slice it was applied in.

Then write:

1. Each new slice. First list `backlog task list --parent ITEM-58 --plain`: a `Ready` slice with
   the same title is left from an earlier attempt that did not finish; reuse it instead of
   creating another.

   ```
   backlog task create "<title>" --parent ITEM-58 --status Ready \
     --description $'<description>' \
     --ac "Given <context>, when <event>, then <observable outcome>"
   ```

   The subtask number the CLI returns is the slice number: `ITEM-58.6` is `#58/S6`.
2. The item, last, in one `backlog task edit ITEM-58` call:
   - `--notes` — the existing notes with ` · reversed by owner — undo in #58/S6` appended to each
     reversed decision's line.
   - `--status Implementing --clear-final-summary` if any slice was created, else `--status Done`.
     The tick reads a non-empty final summary as the judge having finished, so a send-back must
     clear it; the board's git history keeps the old debrief.
   - The touch comment.

Done means accepted. Pushing and merging happen off the board.

## 5. Next

After each write, show the item's new status and the list again. Stop when the owner stops or the
list holds only entries not handled here.
