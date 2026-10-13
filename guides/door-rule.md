# The door rule

Domain: Decision. Sorts a decision by what it costs to undo, which says whether whoever holds it
decides it or asks whoever owns it. It rests on reversibility, one-way and two-way doors: the cost
of undoing a decision, and who pays it, decides who makes it. And on value of information: asking
costs the asked person's attention, and pays only when the answer could change what is done. That
is why a two-way door is decided by whoever holds it, not sent up. Value of information never
decides whether a one-way door is asked. It reads no config.

## Three kinds

- **Settled** - the spec, a reply or an owner's ruling already decides it. Follow that.
- **Two-way door** - cheap to undo. Whoever holds it decides and records the decision.
- **One-way door** - costly to undo once shipped, because someone outside this change pays. It is
  asked of whoever owns the decision: a worker asks the coordinator, the coordinator asks the
  owner. Fixed: changing it is the owner's call.

Given a decision, the rule returns its kind, and with it who decides. How a question is put is the
ask guide's (`mt get ask`).

## One-way doors

- **Consumers** - public routes, API shapes, events, contracts others consume.
- **Data** - persisted schema, migrations, stored data, formats written to disk or a queue.
- **Architecture** - module boundaries, state ownership, sync vs async between components, a new
  store, cache or queue, cross-cutting conventions (errors, logging, auth flow, config).
- **Infrastructure** - cloud resources, network, IAM, secrets, CI/CD, environments, recurring
  cost.
- **Precedent** - the first instance of a pattern; later code and agents copy it.
- **Dependencies** - a new package or service others will build on.
- **Security** - auth and trust boundaries, sensitive data.
- **External effects** - sends, deletes, payments; anything that cannot be recalled.
- **Test contracts** - changing what an existing test asserts.

Workaround for agents not deriving a one-way door from who pays outside the change; remove when
Runs show workers no longer deciding one-way doors without asking.

## Edges

Contradicting the spec, a reply or a ruling is always a question, whatever the door. Unsure means
one-way, and the question says so. Over-escalating is a defect like missing one: a two-way door
belongs to whoever holds it, and sending it up spends someone else's attention on what its holder
can decide and undo cheaply.

A judge's finding names its door: two-way, or one-way and who pays to undo it.
