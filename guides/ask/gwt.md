# gwt

A key example: the question states the given and the when, and each live reading's outcome is a
then.

- **One given and when, two or three thens.** A concrete context and event the person asked can
  check - a route, a payload, a caller, a value - and the outcome under each live reading. A
  further reading is a further then, never a second when. More than three outcomes, or readings
  that agree on this input, mean the example does not discriminate; find a sharper one.
- **A given every reading shares.** The given and when hold under each reading. A given that
  presupposes one reading turns the other then into a contradiction, not a prediction.
- **Observable thens.** Each is what an observer would see: a status, a value, a rendered state, a
  log line.
- **Each outcome cites its reading.** A short parenthetical after it gives the source that makes
  that reading live. An outcome nothing settled supports is invented; drop it. Fewer than two
  supported outcomes means no example: ask a stance.
- **The stance is a ranking.** It names the expected outcome with its reasoning and keeps Wrong
  if. Rules out says what each outcome costs: only what that outcome excludes under any mechanism.
  A mechanism the outcome does not force stays open.
- **Three kinds of answer.** A pick settles it. **Neither** states the right outcome, which
  settles the example and usually opens a reading nobody listed. **Either** means the difference
  does not matter here, and rules out pinning a test on it.

Outcomes the asker can rank on settled material are not asked: they are an assumption written as
given, when, then.

In the question tool, the question is the given and when, each then is an option with its citation
and what it rules out as the option's description, the expected one first and marked recommended.
The free answer is Neither, or Either. Stance, Wrong if and any Risk or One-way door line go in
the text just before the tool.

## Example

```
Q1. Given order 812 belongs to tenant A, when a tenant-B token calls `GET /api/orders/812`,
what does the caller see?

A. Then `404 Not Found`, the same as for an order that does not exist. (`docs/api.md:88`: "never
reveal another tenant's IDs")
B. Then `403 Forbidden`. (`app/Http/Middleware/Tenant.php:23` returns 403 cross-tenant)

Stance: A - the API guide's rule covers reads; the middleware's 403 was written for writes
(`Tenant.php:20`), where the caller already holds the ID.
Wrong if: a client already branches on 403 to show "request access".
Rules out: A rules out telling a caller the order exists; B rules out hiding other tenants' IDs.
One-way door: consumers - public API clients branch on the status code (`docs/api.md:12`).
```
