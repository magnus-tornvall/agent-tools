---
name: chart
description: Chart the critical path to a destination for work too big for one session. Frame the problem, resolve unknowns by escalating from research to case questions to spikes to user research, and keep the map in the tracker the repo declares, one child item per piece of work handed to another session. Re-invoke to advance.
disable-model-invocation: true
---

# chart

Chart the critical path from here to a destination, then advance it until the path is untangled.
Plans, never implements.

Arguments: the map, as a tracker reference or a path. Optionally, an item on it to work on next.

## The map

The map is one container in the tracker. Its body holds:

- **Destination** - what is true when the work is done, stated as an observable outcome.
- **Constraints** - limits from outside the code: SLA, data residency, budget, team capacity.
- **Non-goals** - what someone would otherwise ask for, with the reason.
- **Decision log** - each decision, the alternatives considered and why each was not chosen, and
  its provenance. Forks are kept so a failed path can backtrack.

Its children are the items handed to another session. Each item has a kind (change, spike, user
research), an owner, a status (open, done, dropped), what it is blocked by, and its result.

## Owners

Every unknown gets an owner. The owner decides where the work happens.

- **Subagent** - research inside this session. Read-only: no writes, no builds, no live services,
  no secret-bearing files. Never becomes an item.
- **Agent** - a separate agent session, such as an mvc run on a change, or building it. Becomes an
  item.
- **Human** - a separate session involving people, money, or live environments. Becomes an item.

## Charting

On the first invocation, before any question:

1. **Frame the problem.** Propose the destination, constraints, and non-goals from the argument,
   the conversation, and the repos. Problem-space unknowns come before solution-space ones: one
   answer about an availability target settles many component questions.
2. **Explore.** List candidate questions, then dispatch a subagent to answer them from the repos
   and primary sources, including the domain's established best practice. Each answer cites
   `file:line` or a URL, or is dark.
3. **Lay out the path.** What stands between here and the destination, with blocked-by only where
   it changes what comes next. Unknowns off the critical path are left alone until they matter.

Then advance.

## Advancing

Work the critical path until the only open items belong to another session. Resolve each unknown
by the cheapest step that can:

1. **Research** - a subagent, as in exploring.
2. **Case question** - specification by example: one concrete input and the outcome under each
   live reading, given/when/then where it fits, with a stance on which you expect. The user picks
   an outcome, states the right one (neither), or says the difference does not matter (either).
   A case question the user cannot answer now becomes a user research item.
3. **Spike** - only for a one-way door that turns on a fact only building can reveal. Suggest it;
   the user chooses. One question, timeboxed, thrown away.
4. **User research** - an item owned by a human.

Two-way doors: decide on the evidence, record it in the decision log, and move on. One-way doors
need the user's word.

Edits to the map are two-way doors: add, split, re-link, and drop items without asking.

When a chosen path fails, backtrack to the next viable alternative in the decision log.

## Invocation

- **No item named** - read the map back, report what changed since the last session, recommend the
  next step on the critical path, and continue.
- **An item named** - work on it. If it is blocked, say what blocks it once; the user decides. If
  another session owns it, record its result or hand it off.

Results come back through the tracker: an item done elsewhere, with its result, is read like any
other answer. Items other sessions add, such as an unknown found while building a change, are read
the same way.

The path is **untangled** when every open item is done or is a change mvc can shape without
splitting it. Report that and stop. Re-invoked after that, report where the map stands.

## The tracker

The repo declares the tracker adapter. Without one, the map is a file. The skill never names a
backend.

The adapter implements:

```yaml
read_map:    {ref} -> {body, version, items: [{ref, kind, owner, status, blocked_by, result, body, version}]}
write_map:   {ref, body, if_version}
create_item: {map: ref, kind, owner, body, blocked_by} -> ref
update_item: {ref, status?, result?, body?, blocked_by?, if_version}
```

- The tracker is the source of truth. Read the map back on every invocation.
- Kind, owner, status, blocked-by, and result round-trip unchanged. How the adapter stores them is
  its own business.
- Tracker references are the IDs. Nothing is deleted; an item no longer needed is dropped.
- A write against a stale version fails: re-read, then continue. Never overwrite another edit.
- A status the adapter cannot map reads as open.
