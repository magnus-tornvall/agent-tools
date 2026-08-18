# Flattening spec → plan in mise-en-place

Status: proposed, not implemented. Written 2026-08-18, out of the review that
produced the leaner `skills/mvc/SKILL.md`.

The premise under review: *"spec → plan often feels like theatre; mise-en-place should
be able to flatten them into one round."*

## Where the premise holds

**Two gates, one decision.** The spec/plan split is inherited from human teams, where a
spec is written by one person and the plan by another, days apart, and the gate between
them is a handoff across people. In a single session it is the same person answering in
the same five minutes. Two approvals for one act of thinking is the shape of theatre.

**`mvc` makes the split harder to maintain, not easier.** A grill's stances name files
and env vars - "in the existing security middleware, not per-route" is a `constraints`
entry, not a requirement. After a grill, spec-level and plan-level content arrive
*fused*. Re-separating them so each can be gated separately is work spent undoing
information that was deliberately collected together.

**A rubber-stamped gate is worse than no gate.** Two approvals per change trains the
reflex, and once the plan gate is a reflex it launders unreviewed content as approved.
One gate that gets read beats two that get skimmed.

## Where it does not

**The phases are not the theatre; the approvals are.** These are separable, and the
premise conflates them. `outcome` and `requirements` are falsified by the world - wrong
problem. `approach`, `touchpoints` and `constraints` are falsified by the code - wrong
mechanism. They fail at different times, from different causes, and are repaired
differently. That is two lifetimes in one file, not ceremony.

**Re-entry is what pays for the split.** The `Re-entry` path exists for "a task proved
the plan wrong". When it fires, the plan is redone - and what stops a replan from quietly
renegotiating the goal is that the spec is still approved and the plan is not. One
approval for both means a mechanism failure reopens the outcome, and every replan becomes
a chance to redefine success. That is the failure mode this skill exists to prevent.

**`touchpoints` rot; `requirements` do not.** Anchors point into code that exists now,
and code moves. The most common state a change sits in is *goal still valid, anchors
stale*. One approval flag cannot express that; two can.

**The split signal moves later.** The seven-requirements heuristic reads the spec alone,
before approach work is spent. Flattened, "this is actually two changes" arrives after
`approach` and `constraints` have been paid for.

## Likely misdiagnosis

The theatre feeling probably correlates with **change size**, not with phase count. On a
two-file change the spec is `outcome` plus two requirements restating it, and gating that
twice is absurd - but the fix there is a size floor below which mise-en-place is not
invoked at all, not a structural change that also applies to changes where the plan gate
is the only thing catching a wrong approach.

There is also a conditional a flatten would hard-code away: the spec phase is near-empty
**when `mvc` ran first** and load-bearing when it did not. Flattening bakes in the
mvc-ran case for every invocation, including cold ones.

Test before editing: recall the last few times the plan gate taught something. If it
taught something on large changes and nothing on small ones, flattening is the wrong fix.

## Recommendation

Collapse the *approvals*, keep the *phases*.

- One presentation and one approval covering spec and plan together - this removes the
  felt theatre, the second "do you approve?".
- `spec` and `plan` stay separate field groups, with independently invalidatable state,
  so a plan can be marked stale while the spec stays approved.
- Keep the seven-requirements split check reading the spec fields alone, before approach
  work begins.

That is roughly all of the felt ceremony removed at no cost to re-entry or to the
anchor-staleness distinction.

## Blocking question if the fields are flattened too

**When a task proves the approach wrong, what stops the replan from moving the
goalposts?** Today the answer is "the spec is already approved". A field-level flatten
deletes that answer and must supply another one first.

## Loose end noted in the same review

`requirements` may not name a technology or a file, but `mvc`'s stances routinely do.
Those are plan-level decisions a grill legitimately settles, and the handoff currently
has nowhere to put them but prose. One line in `mvc` saying they belong to `constraints`
rather than `requirements` would stop the copy smuggling mechanism into the spec.
