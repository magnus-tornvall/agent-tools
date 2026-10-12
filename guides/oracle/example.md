outcome: A cancelled order carries the reason it was cancelled, and the nightly export ships it to finance.
purpose: Finance reconciles every cancelled order by hand, asking support why it was cancelled.
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
constraints:
  C1: The export's column order does not change; cancel_reason is appended.
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
    decided_by: owner
  D3:
    decision: The API returns the reason as a plain string.
    rejected:
      - A reason code from a fixed list
    provenance: The operator's cancel form already sends free text.
    door: two_way
    decided_by: silence
oracles:
  O1:
    covers: [R1]
    base: fail
    run: php artisan test tests/Feature/CancelReasonApiTest.php --log-junit .scratch/oracles/O1.xml
    junit: .scratch/oracles/O1.xml
    files:
      tests/Feature/CancelReasonApiTest.php: 14c2529eb4498c5d1ffd6915d05bf58a91bdda796af59f41d480d11c099d0479
  O2:
    covers: [R2]
    base: fail
    run: php artisan test tests/Feature/CancelReasonExportTest.php --log-junit .scratch/oracles/O2.xml
    junit: .scratch/oracles/O2.xml
    files:
      tests/Feature/CancelReasonExportTest.php: d46aee08cc49f6d1eb41800c1d6bab4506c960c700cff0efffe490d7cb1de5e3
  O3:
    covers: [outcome]
    base: fail
    run: php artisan test tests/Feature/CancelledOrderReachesFinanceTest.php --log-junit .scratch/oracles/O3.xml
    junit: .scratch/oracles/O3.xml
    files:
      tests/Feature/CancelledOrderReachesFinanceTest.php: 1bdfa399a64dcf61e3c97ef2743788084bd6c4fe7278c7901104ff3fdb3ec439
  O4:
    covers: [C1]
    base: pass
    run: php artisan test tests/Feature/ExportColumnOrderTest.php --log-junit .scratch/oracles/O4.xml
    junit: .scratch/oracles/O4.xml
    files:
      tests/Feature/ExportColumnOrderTest.php: 9af5b34f260e3973c0b87c6e78aefbc83ffdaa4bb39561688b74baef6577c986
  O5:
    covers: [N1]
    base: pass
    run: sh tests/no-reinstate.sh
    files:
      tests/no-reinstate.sh: 186d9d7ca68b40d181dea35f6c37ad8c4906b91dc3b29cf53b09b6652eb7dfea
unchecked:
  R3: No caller can observe where the reason is stored; only reading the migration against D1 can judge it.
