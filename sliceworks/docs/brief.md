# Brief

The planner's owner-facing summary of an item, ruled on by the owner before implementation starts.
Written as a diff against the item's spec, ordered surprise-first.

## Durable IDs

Scoped to the item, never reused or renumbered:

- `#58/S3` — slice
- `#58/D2` — decision, any tier (see [rubric](rubric.md))
- `#58/A1` — assumption

A split retires the ID and adds new ones (`#58/S5 · split from S3`). Every ID is an anchor; the
[debrief](debrief.md) reports against the same IDs.

## Size

At most **40 lines at 100 columns**, cards included. A brief that does not fit is not trimmed: it
returns to the owner as a spec question — the spec is revised or split before planning again. So
do more than three costly assumptions.

## Sections

In this order:

1. **Direction** — one sentence restating the direction.
2. **Shape** — slices, one line each: `#58/S1 · <what the slice delivers>`.
3. **Costly assumptions** — at most three:
   `#58/A1 · <assumption> — follows from <provenance> — if wrong: <who pays>`.
   An assumption qualifies only if a door rests on it, rework would spread beyond a slice, or it
   has no provenance. Others are not listed.
4. **Deviations from the spec** — one line each, with its D ID.
5. **DECIDE cards** — in [card](card.md) format.
6. **Out of scope** — one line each.

## Ruling

The owner answers per line: ✓ or ✗. An unmarked line is ✓. Each DECIDE card
is answered on the card. Silence never settles a DECIDE.
