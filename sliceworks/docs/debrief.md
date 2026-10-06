# Debrief

The judge's report on a finished item, ruled on by the owner before anything is pushed. It mirrors
the [brief](brief.md) by ID: every S, A and D the brief carried appears again under the same ID,
approved vs actual. It is also the item's decision log: every decision of every tier appears here
under its D ID.

## Sections

In this order:

1. **Slices** — per brief slice, in brief order: `#58/S1 · approved: <…> · actual: <…>`. A split
   slice lists its successors (`#58/S5 · split from S3`).
2. **Assumptions** — per brief assumption: `#58/A1 · held` or `#58/A1 · broke — <what happened>`.
3. **Decisions from the brief** — per brief deviation and DECIDE: the ruling and what was built.
4. **VETO cards** — every VETO applied during implementation, in [card](card.md) format. This is
   where the owner first sees them.
5. **Logged** — one line each: `#58/D7 · <decision> — <slice>`.
6. **New** — anything the brief did not carry: new slices, assumptions, DECIDEs raised mid-flight.
7. **Conformance deltas** — where the diff departs from the spec, brief, or rulings.
8. **Open findings** — review findings still unresolved after the fix round.
9. **Evidence** — links to gate output (slice gate, integration gate).

## Ruling

Per ID, the owner accepts, reverses a VETO, or promotes a Logged decision to VETO, or sends the
item back. Nothing is pushed until the owner accepts.
