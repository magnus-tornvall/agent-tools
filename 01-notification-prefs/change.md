---
approvals:
  spec: true
  plan: true
  tasks: false

spec:
  outcome: "A signed-in user controls their own email notification delivery from the account page."
  kill_criterion: "If the setting cannot be read at send time from the user row already loaded, stop and re-scope."
  non_goals:
    - "Not adding notification categories beyond email."
    - "Not changing the send pipeline's retry behaviour."
  requirements:
    - id: R1
      text: "A signed-in user can see their current email notification setting."
    - id: R2
      text: "A signed-in user can change whether they receive email notifications."
    - id: R3
      text: "A setting a user changed is still in force after the service restarts."
  open_questions: []

plan:
  approach: "Persist the setting on the user row, read it at send time, expose it on the existing account page."
  touchpoints:
    - src/db/user.ts
    - src/api/account.ts
    - src/notify/send.ts
    - web/src/AccountPage.tsx
  constraints:
    - "One column on the users table; no new table."
    - "The send path reads the setting from the user row it already loads, not a second query."
  acceptance: "bun test"
  escalate_if:
    - "The send path has no user row loaded where the setting is needed."
  open_questions: []

tasks:
  open_questions: []
---

The account page already renders and saves other profile fields; the send path already loads
the user row to resolve the destination address.
