---
approvals:
  spec: true
  plan: true
  tasks: false

spec:
  outcome: "Every HTML response carries a Content-Security-Policy header."
  kill_criterion: "If the policy cannot be expressed without unsafe-inline, stop and re-scope."
  non_goals:
    - "Not adding CSP reporting."
    - "Not touching the existing security headers middleware ordering."
  requirements:
    - id: R1
      text: "An HTML response from any route carries a content-security-policy header."
    - id: R2
      text: "The policy value is configurable per environment without a rebuild."
  open_questions: []

plan:
  approach: "Set the header once in the existing security middleware, value read from env."
  touchpoints:
    - src/middleware/security.ts
    - src/config/env.ts
  constraints:
    - "Header set in src/middleware/security.ts::applyHeaders, not per-route."
    - "Policy string read from CSP_POLICY env var; empty means header omitted."
  acceptance: "npm test"
  escalate_if:
    - "The policy requires unsafe-inline to keep any page working."
    - "An existing test must be modified to pass."
  open_questions: []

tasks:
  open_questions: []
---
