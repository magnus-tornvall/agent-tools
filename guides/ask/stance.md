# stance

A position for a decision whose readings differ in mechanism, structure or cost, but not in
anything an input can show. Plain text, one block per question.

- **A strong opinion, weakly held**, with its reasoning inline. Grounded in established guidance
  when there is some - a standard, the vendor's documented recommendation - and saying so when it
  departs from it.
- **A stance, not a recommendation.** The cheap answer to a recommendation is agreement; the
  answer to a stance is an argument, and the argument is what is wanted.
- **No option lists.** Options beside a stance are a ballot with a box already marked, and a free
  counter is what surfaces the option neither side listed. When the answer set is genuinely
  closed, ask options instead.

## Example

```
Q1. Where is a cancelled order's reason stored?

Stance: A nullable `cancel_reason` column on `orders`. Cancellation is a status on the order
(`app/Models/Order.php:41`), and the nightly export already reads that table
(`reports/OrderExport.php:18`).
Wrong if: an order can be cancelled, reinstated, and cancelled again, each with its own reason.
Rules out: a separate cancellations table, and keeping the reason only in the event log.
One-way door: data - a persisted column the nightly export ships to finance
(`reports/OrderExport.php:18`).
```
