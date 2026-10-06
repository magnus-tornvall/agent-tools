# Decision card

A card puts one DECIDE or VETO decision in front of the owner. Nothing reaches the owner without
a card or a brief. Tiers come from the [rubric](rubric.md).

## Rules

- **One decision per card.** A stance needing "and", or a Rules out covering half of it, is two
  cards.
- **Self-contained.** The owner rules from the card alone: no link, file, or earlier message has to
  be opened. Anything the decision rests on is restated in the card, with its ID when it has one.
  Citations (`file:line`) are provenance, not required reading.
- **Form, in order of preference:**
  1. **Hinge** — ask for the fact the decision turns on. Use it when the owner knows something the
     agent cannot find.
  2. **Case** — specification by example. Use it when the live readings produce different
     observable outcomes for the same input. The answer becomes an acceptance test.
  3. **Stance alone** — when the readings differ in mechanism, structure, or cost, but not in
     anything an input can show.
- **Stance always last**, so the owner forms a view before reading it.
- **No options beside a stance.** Options plus a stance is a ballot with a box pre-marked. A case's
  outcomes are not an option list: they are what the live readings already predict, and
  `Neither: say what` keeps the freeform answer open.

## Fields

In this order. Each body is one short paragraph.

- **Header** — `**DECIDE · <D ID> · blocks <S ID>**` or
  `**VETO · <D ID> · applied in <S ID> — reply to reverse**`.
- **Question** — neutral: it reads as answerable either way without the stance. A question worded
  from inside the stance ("Can we just return 413?") has answered itself before the stance is
  read. Context in it is fact; the argument lives only in the stance. It presupposes only settled
  material. Concrete: anchored in something the owner can check — a route, a caller, an input, a
  number. "How important is latency?" invites "very"; "What is the largest tenant this export
  serves?" invites a fact the decision turns on.
- **Where** — which slices this touches, which are done, which wait on it.
- **Case** — case form only. `Given <a concrete context>`, then one line per outcome (`A:`, `B:`,
  at most three), each observable — a status, a value, a rendered state, a log line — then
  `Neither: say what`. Readings that agree on this input do not discriminate; find a sharper
  input.
- **Stance** — a strong opinion, weakly held, reasoning inline. Never a recommendation: the cheap
  response to a recommendation is agreement, to a stance an argument, and the argument is what's
  wanted. In case form it names the expected outcome.
- **Wrong if** — the condition that would refute the stance, so the argument has a target. It
  refutes this decision; it never opens a second one.
- **Rules out** — what agreeing costs. In case form, what each outcome costs.
- **Who pays** — the rubric trigger and the `file:line` that makes it fire. Unsure: one tier up,
  marked unconfirmed.
- **Meanwhile** — DECIDE only: what is parked and what continues.

## DECIDE, case form

```
**DECIDE · #58/D2 · blocks #58/S3**
When a CSV export exceeds the 50k-row limit, what does the caller receive?

Where: #58/S3 adds the limit; #58/S1–S2 (query, streaming) are done; #58/S4 (UI) waits on this.
Case:  Given a tenant exporting 80k rows
         A: 200 with the first 50k rows and an X-Truncated: true header
         B: 413 with no body; the caller narrows the filter
         Neither: say what
Stance: B. A truncated CSV gets opened in Excel and read as complete; headers are invisible there.
Wrong if: anything already consumes partial exports, e.g. a scheduled job pulling "latest N".
Rules out: A rules out a hard failure on large exports; B rules out partial downloads.
Who pays: consumers — the export response is public API (docs/api/export.md:12).
Meanwhile: #58/S4 parked; nothing else blocked.
```

## DECIDE, hinge form

```
**DECIDE · #58/D5 · blocks #58/S3**
What is the largest row count any tenant has exported in the last 90 days?

Where: #58/S3 adds the export row limit; #58/S1–S2 are done; #58/S4 (UI) waits on this.
Stance: under 50k. The limit then rejects no existing export, and 50k matches the import cap.
Wrong if: any tenant has exported more than 50k rows; the limit would break a working export.
Rules out: a per-tenant limit.
Who pays: consumers — the export response is public API (docs/api/export.md:12).
Meanwhile: #58/S4 parked; nothing else blocked.
```

## VETO

Same shape, its own header, no Meanwhile. It is already applied; silence accepts it.

```
**VETO · #58/D4 · applied in #58/S2 — reply to reverse**
Does the streaming export write rows in the order the query returns them?

Where: #58/S2 (streaming) is done; #58/S3–S4 build on its output.
Stance: yes, query order. Sorting in the stream would buffer the whole result and undo S2.
Wrong if: the spec's "sorted by date" (#58 spec, Exports) applies to the file, not the screen.
Rules out: server-side sorting of exports.
Who pays: this item only — S3 and S4 read S2's output; nothing outside the item does.
```
