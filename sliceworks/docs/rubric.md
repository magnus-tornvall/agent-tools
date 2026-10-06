# Escalation rubric

Every decision an agent makes gets a tier from one question: **who pays to undo it?**

| Who pays | Tier | Meaning |
|---|---|---|
| Anyone outside this change | **DECIDE** | Slice parked until the owner rules. Silence never settles it. |
| Only this item, beyond the current slice | **VETO** | Already applied. Silence accepts it. |
| Only this slice — a revert undoes it | **Logged** | Decision log only. |

Every decision, whatever its tier, takes the item's next durable D ID (`#58/D3`).

## DECIDE triggers

"Outside this change" means any of:

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

A DECIDE names its trigger and the `file:line` that makes it fire in the card's `Who pays` line.

## Modifiers

- Contradicting something the spec or approved brief settled is at least VETO.
- Something a reader holding only spec and brief would be surprised by is at least VETO.
- Unsure who pays: go one tier up and mark the reason unconfirmed.

## Guardrails

- Asking is not free. Over-escalating is a defect, like missing one.
- More than three DECIDEs on one item: stop, and return it to the owner as a spec question — the
  spec is revised or split before work continues.
- Watch the tier mix. Mostly DECIDE means covering or a thin spec; mostly Logged means too lax.
- Only escapes change the rubric: a surprise found after merge records which trigger should have
  fired.

## Where each tier reaches the owner

| Tier | Reaches the owner as |
|---|---|
| DECIDE | A card in the brief, or mid-flight a card on its own; only that slice parks |
| VETO | A card in the debrief; the owner may reverse it there |
| Logged | One line in the debrief; the owner may promote it there |
