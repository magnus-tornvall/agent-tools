# Async agent workflow — handoff

Diagram: https://claude.ai/artifact/JBsCzv5XgKrFtHrGCX1PTJ (private artifact; the flow, the six
human touchpoints, the escalation tiers and the invariants).

Status: design settled through a brainstorming session; nothing built. A previous attempt under
`async/` was discarded unread. `skills/agentflow*` is out of scope — do not build on or from it.

## Problem

The owner specs and plans rigorously (the `mvc` skill) so they can argue for and quickly review
what an agent ships. That workflow is serial: more than two parallel items is taxing. The goal is
a queue of specs carried to merge-ready branches by agents, where the owner's attention goes only
to decisions that are costly to reverse — while they stay in the driver's seat and understand the
outcome.

Orchestration instructions, not a maintained process: state what must be true at each handoff and
let the model pick the steps. The rubric changes only from evidence (escapes), never on a
calendar.

## Research basis

- **The human is Amdahl's serial fraction.** Throughput is capped by the owner's touchpoints.
- **Fan-out ≈ neglect time / interaction time + 1** (Olsen & Goodrich 2003, supervisory control).
  Raise neglect time with better specs; cut interaction time with self-contained cards.
- **Task switching and attention residue** (Rubinstein/Meyer/Evans 2001; Leroy 2009): open,
  unresolved loops are the drain, not queue length.
- **Batching interruptions** lowers stress (Kushlev & Dunn 2015; Fitz et al. 2019) → scheduled
  inbox windows, no notifications.
- **Little's law / WIP limits** (Reinertsen): more concurrent items without more throughput only
  lengthens lead time.
- **Review effectiveness drops past ~400 LOC and 60–90 min** (SmartBear/Cisco) → review decisions,
  not diffs.
- **Ironies of automation, out-of-the-loop, automation bias** (Bainbridge 1983; Endsley & Kiris
  1995; Parasuraman & Manzey 2010) → feed understanding back via brief/debrief; spot-check what the
  judge passes; count escapes.
- **Self-perception is unreliable** (METR 2025: 19% slower, felt 20% faster) → measure touches.
- **Generation effect** (Slamecka & Graf 1978) → the owner writes the spec; agents write the how.

Expected ceiling: 3–5 items in flight, not 10.

## Flow

```
H1 spec ─► planner (slices + acceptance cases) ─► brief ─► H2 ─► implementer (per slice)
  ─► slice gate ─► [code review ∥ conformance review] ─► fixer ─► delta re-check (one round)
  ─► integration gate ─► judge writes debrief ─► H4 ─► owner pushes and merges ─► (H6 on escape)
```

Side paths: DECIDE mid-flight → H3 (only that slice parks). Brief won't fit, more than 3 costly
assumptions, or more than 3 DECIDEs during implementation → H5 (spec question, revise or split).

| Point | When | Owner does |
|---|---|---|
| H1 | every item | Writes the spec: direction, known one-way doors, key cases. The only deep work. |
| H2 | every item | Rules on a one-screen brief: answers DECIDE cards, ✓/✗ per line. |
| H4 | every item | Compares debrief with brief by ID: accept, reverse a VETO, or send back. |
| H3 | exception | One self-contained DECIDE card. |
| H5 | exception | Revise or split a spec that wasn't ready. |
| H6 | rare | After-merge surprise: records which trigger should have fired. Only rubric input. |

Agent roles and their context:

- **Planner** — spec in; plan (agent-facing), brief (owner-facing), acceptance cases per slice.
- **Implementer** — plan, brief rulings; writes cases first; logs VETO/Logged decisions.
- **Code reviewer** — the diff only, never the spec (avoids anchoring).
- **Conformance reviewer** — diff vs spec, brief and rulings. Runs in parallel with code review.
- **Fixer** — all findings plus the relevant spec/plan; may reject a finding with a reason.
- **Delta re-check** — the code reviewer on the fixer's commits only. One round, then stop.
- **Judge** — sees everything; filters by the rubric and writes the debrief. Kept separate from
  conformance: the finder should not also decide what matters.

Gates are scripts, not agents: an exit code beats an opinion.

- **Slice gate** — the slice's acceptance cases pass; lint, test, build green.
- **Integration gate** — rebase on base, rerun; a conflict becomes a DECIDE.

## Escalation rubric

One question: **who pays to undo it?**

| Who pays | Tier | Meaning |
|---|---|---|
| Anyone outside this change | **DECIDE** | Slice parked until the owner rules. Silence never settles it. |
| Only this item, beyond the current slice | **VETO** | Already applied. Silence accepts it. |
| Only this slice — a revert undoes it | **Logged** | Decision log only. |

"Outside this change" — the DECIDE triggers:

- **Consumers** — public routes, API shapes, events, contracts other services or teams consume.
- **Data** — persisted schema, migrations, stored data, formats written to disk or a queue.
- **Architecture** — module/service boundaries, state ownership, sync vs async between components,
  a new store/cache/queue, cross-cutting conventions (errors, logging, auth flow, config).
- **Infrastructure** — cloud resources, network/DNS/firewall, IAM, secrets, CI/CD, environments,
  region/data residency, recurring cost.
- **Precedent** — the first instance of a pattern; future code and agents copy it.
- **Dependencies** — a new package or service others will build on.
- **Security** — auth and trust boundaries, sensitive data.
- **External effects** — sends, deletes, payments; anything that cannot be recalled.
- **Test contracts** — changing what an existing test asserts.

Modifiers: contradicting something the spec or approved brief settled is at least VETO; something
a reader holding only spec and brief would be surprised by is at least VETO; unsure who pays → one
tier up, reason marked unconfirmed.

Guardrails: asking is not free — over-escalating is a defect like missing one. More than three
DECIDEs on one item → back to the owner as a spec question. Watch the tier mix: mostly DECIDE means
covering or a thin spec; mostly Logged means too lax. Only escapes change the rubric.

## Artifact formats

**Durable IDs**, scoped to the item and never reused or renumbered: `#58/S3` (slice), `#58/D2`
(decision), `#58/A1` (assumption). A split retires the ID and adds new ones ("split from S3"). Every
ID is an anchor; brief and debrief share them.

**Decision card.** Prefer a **hinge** (ask for the fact the decision turns on), then a **case**
(specification by example; the answer becomes an acceptance test), then a **stance** alone. Stance
always last, so the owner forms a view before reading it. No options beside a stance. One decision
per card. Self-contained. Format rules otherwise follow `skills/mvc` (neutral question, stance,
Wrong if, Rules out).

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
Rules out: partial downloads; paginated exports.
Who pays: consumers — the export response is public API (docs/api/export.md:12).
Meanwhile: #58/S4 parked; nothing else blocked.
```

A VETO card has the same shape with header `**VETO · #58/D4 · applied in #58/S2 — reply to
reverse**` and no Meanwhile line.

**Brief** — one screen, written as a diff against the spec, ordered surprise-first:

1. One sentence restating the direction.
2. The shape: slices, one line each.
3. Costly assumptions only (at most three): `#58/A1 · <assumption> — follows from <provenance> — if
   wrong: <who pays>`. An assumption qualifies only if a door rests on it, rework would spread
   beyond a slice, or it has no provenance.
4. Deviations from the spec.
5. DECIDE cards.
6. Out of scope.

The owner answers per line; an unmarked line is ✓. Not fitting one screen is a signal, returned as
H5.

**Debrief** — mirrors the brief by ID: approved vs actual per slice, assumption and decision, plus
anything new, conformance deltas, still-open findings, and links to evidence (gate output).

## Structure

| Nature | Lives in |
|---|---|
| Owner, interactive | Skills: `mvc` (H1, existing) and a new `inbox` (H2–H5) |
| Isolated judgment | Agent definitions: planner, implementer, code-reviewer (read-only), conformance-reviewer (read-only), fixer, judge |
| Shared vocabulary | Reference docs: rubric, card, brief, debrief |
| Deterministic checks | Scripts: slice gate, integration gate |
| State | The tracker — the only durable state |
| Coordination | One orchestrator file of invariants, run as a scheduled tick |

The orchestrator is a **tick, not a session**: each run reads the tracker, advances whatever is
unblocked, writes results back, and exits. The runtime is disposable.

Invariants:

- Nothing reaches the owner without a card or a brief.
- Every agent runs in a fresh, isolated context.
- One fix round, then the judge decides.
- Gates are scripts.
- The tracker is the only durable state.
- Nothing is pushed until the owner accepts at H4.

`mvc` is not reused as a stage — it is a synchronous interview, and the new artifacts are async.
Its format rules are copied for now; extract a shared reference once both exist and are stable.
Watch for drift between mvc's door definition and this rubric.

## v1 decisions

- **Tracker:** backlog-md (installed, v1.53) in a new local git repo at `~/dev/me/ai/backlog` —
  does not exist yet. Proposed mapping: spec = task; slices = subtasks (`--parent`) with
  `--depends-on` for the critical path; acceptance cases = `--ac`; plan = plan field; debrief =
  final summary; DECIDE rulings = `backlog decision`; owner queue = a custom status such as
  `Awaiting you`; pipeline states = configured statuses.
- **Trial repo:** `~/dev/lambertsson/repos/lao-web-frontend` (Angular, pnpm, no CI). Work only on
  a local branch from `staging`. **Never push. Never touch Azure DevOps.** Gate: `pnpm lint`,
  `pnpm test` (Vitest), `pnpm build`. E2E (Playwright) is out. The repo's AGENTS.md conventions
  apply (no code comments, a `Deviations` heading for the eventual PR).
- **Inbox:** a terminal skill. No notifications; the owner opens it in scheduled windows.
- **Merge:** the owner pushes and opens the PR themselves after H4.
- **Runtime:** local worktrees, at most three items in flight. Orca automations plus
  `worker-start` are a good fit (see below) but the design stays execution-agnostic.
- **Scope:** the full chain for one item at a time; the four reference docs; both gates
  (integration = rebase + rerun only); the inbox. Out: parallel items until one runs cleanly,
  per-slice review, overlap detection across in-flight items, automated escape capture.
- **Success measure:** log time and number of owner touches per item, count escapes; run 3–5
  items and compare with the current mvc flow.
- **First trial item:** not chosen. Should be medium-sized with at least one likely DECIDE, so
  the rubric is exercised.

## Orca notes

Orca is an execution layer; this design is a decision layer.

- **Overlaps:** `worker-start` (isolated agents in worktrees), task dependencies (slice waves),
  the task-spec contract (Target, Change, Constraints, Ownership, Observable acceptance — adopt the
  field names), `gate-create` (a mechanism for DECIDE), `automations` with `--precheck` (the
  tick), per-role agent choice (`--agent codex` for review diversity).
- **Gaps it leaves:** a human queue across items with tiers; the rubric; brief/debrief; spec and
  planning stages; gates that verify rather than trust the worker's report; WIP across items;
  escape learning.
- **Tensions:**
  - backlog-md and Orca both model tasks — backlog-md owns what and where; Orca owns attempts; sync
    one way, Orca → backlog-md.
  - Orca's coordinator loop assumes a live session; use a tick instead.
  - Answer in one place — the inbox — with Orca gates as plumbing only.
  - `gate-create` options suit case cards, not stance or hinge cards.
- **Unverified:** whether Orca's UI surfaces gates/asks to the human; whether `gate-resolve` takes
  free text; what `--precheck` failure does.

## Next steps

1. Write the four reference docs: rubric, card, brief, debrief.
2. Create `~/dev/me/ai/backlog` (`git init`, `backlog init`, custom statuses).
3. Agent definitions, gate scripts, the orchestrator invariants, the inbox skill.
4. Pick the first trial item and run it end to end.

Ask before writing outside this repo.
