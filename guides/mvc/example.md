outcome: A cancelled order carries the reason it was cancelled, and the nightly export ships it to finance.
requirements:
  R1:
    given: order 812 is open
    when: an operator cancels it with the reason "duplicate"
    then: GET /api/orders/812 shows status cancelled and reason "duplicate"
  R2:
    given: order 812 was cancelled with the reason "duplicate"
    when: the nightly export runs
    then: its row for order 812 has cancel_reason "duplicate"
  R3:
    text: The reason is stored with the order, not only in the event log.
    reason: The event log is internal, so no caller can observe where the reason lives.
non_goals:
  N1:
    item: Reinstating a cancelled order
    type: boundary
    reason: Cancellation stays final; reinstating is its own feature.
  N2:
    item: Editing the reason after cancellation
    type: deferral
    reason: No operator has asked for it yet.
approach:
  - A nullable cancel_reason column on orders.
constraints:
  - The export's column order does not change; cancel_reason is appended.
touchpoints:
  - app/Models/Order.php:cancel
  - reports/OrderExport.php
  - database/migrations/
decisions:
  D1:
    decision: The reason is a nullable column on orders.
    rejected:
      - A separate cancellations table
      - Keeping the reason only in the event log
    provenance: Finance imports the nightly export by column position, and the event log is pruned after 90 days.
    door: one_way
    who_pays: Finance's import, which reads the export's columns.
    decided_by: owner
    question: Does the reason live in a column on orders, in its own cancellations table, or only in the event log?
  D2:
    decision: The API returns the reason as a plain string.
    rejected:
      - A reason code from a fixed list
    provenance: The operator's cancel form already sends free text.
    door: two_way
    decided_by: silence
