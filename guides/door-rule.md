# The door rule

Sorts a decision by what it costs to undo. A worker uses it to decide what to ask, a judge to
classify a finding, the coordinator to decide what goes to the owner.

## Three kinds

- **Settled** - the spec, a reply or an owner's ruling already decides it. Follow that.
- **Two-way door** - cheap to undo. Whoever holds it decides and records the decision.
- **One-way door** - costly to undo once shipped, because someone outside this change pays. It is
  asked of whoever owns the decision: a worker asks the coordinator, the coordinator asks the
  owner.

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

## Edges

Contradicting the spec, a reply or a ruling is always a question, whatever the door. Unsure means
one-way, and the question says so. Over-escalating is a defect like missing one: a two-way door
belongs to whoever holds it, and sending it up spends someone else's attention.

A judge's finding names its door: two-way, or one-way and who pays to undo it.
