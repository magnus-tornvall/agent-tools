---
name: change-plan
description: Turn a proposal's problem block into an approach and a set of task contracts an agent can execute unattended. Use whenever work is about to start, and whenever the user says "plan this", "break this down", "write the tasks", or asks how a change should be sequenced. If no proposal exists it invokes change-propose --lite first. Also use when an existing plan needs re-planning after a task proved it wrong.
---

# change-plan

Add the approach block to `proposal.md` and write one file per task under `tasks/`.

The plan is the handover boundary. Everything upstream is judgement; everything
downstream is mechanical. Every field exists because an agent reads it to act - if a
field is only read by a human, it does not belong here.

## Preconditions

Resolve the changes directory the way `change-propose` does - `docs/changes/` unless the
project's `CLAUDE.md` carries a `changes dir: <path>` line - and use that one path
everywhere below. `<change dir>` is `<changes dir>/<id>/`.

No `proposal.md` in the change directory? Invoke `change-propose --lite`, then proceed.

Refuse and stop if either fails:

- `unresolved` is empty. A non-empty list is the proposal saying "there is a gap I
  refused to invent an answer for" - planning past it fills the gap silently.
- Every entry in `inferences` has `signed_off: true`. Planning against an unsigned
  inference rests the tasks on a guess.

## Process

### 1. Read

`proposal.md` and the repository. Nothing else. No web, no other changes, no prior
plans. Cite what was found with `path:line` or `path::symbol`.

### 2. Interview the approach

Run the `grilling` skill. This half decides *how*, and it has a floor: put at least
three approaches on the table, including

- one requiring no new code,
- one changing no data model,
- one solving roughly 60% of it.

Record why each rejected approach was rejected in `alternatives_rejected`. The
rejection reasons are the durable artifact; the chosen approach will be obvious in six
months, the discarded ones will not.

### 3. Record the baseline

Run the project's whole-suite verify command on a clean tree. Actually run it - do
not describe it. Record command, result, duration, and commit SHA.

Without this, the implementer cannot tell its own breakage from breakage that was
already there. This is the single most load-bearing field in the file.

If the tree is not clean, say so and record it - a baseline from a dirty tree is
still worth more than none, but it must be labelled.

### 4. Pin shared decisions

Anything more than one task would otherwise decide independently and inconsistently:
names, signatures, data shapes, error contracts, boundaries. Pin them before writing
tasks, with anchors, so the implementer does not rediscover them at full cost.

Decisions, not mechanics. If it is a decision an agent would make silently and
differently each time, it goes in. If it is code, it does not.

### 5. Write tasks

One file per task in `tasks/`. `proposal.md` names no tasks - the directory is the list.

Rules, all validator-enforced:

- `goal` is one line, at most 100 characters, an observable end state that is either
  true or false. If it needs " and ", it is two tasks.
- `verify` is a literal command that decides truth **by exit status**. Copy-pasteable.
  No placeholders, no `<...>`, no "your". If exit status alone cannot decide it, pipe
  it into something that can: `curl -sI $URL | grep -q '^content-security-policy:'`.
- `satisfies` is exactly one requirement id.
- `scope` is at most 3 paths. Each resolves in the repo, or carries `new: true`.
- `type: behavior-change` requires a `test` naming a test that does **not yet exist**.
  `type: behavior-preserving` requires `existing_tests` that must keep passing.
- `depends_on` forms a DAG. Every task leaves the tree green.

### 6. Run the verify commands

Run each task's `verify` at plan time and record the result in `verify_result`, which
must be `fail` on a `behavior-change` task (the test does not exist yet) and `pass` on a
`behavior-preserving` one. Either way round is a finding: a `behavior-change` command
that passes today proves nothing, and a `behavior-preserving` command that fails today
means the baseline is not what the plan thinks it is.

This catches a command that was never real - the cheapest and most common forgery -
before an agent burns a run on it.

Where a command cannot run at plan time (needs a booted service, a migration, a
deploy), set `verify_unrun: <reason>` instead. Report the count. Silent skipping makes a
plan look more verified than it is.

### 7. Validate

```
bun .claude/skills/change-plan/scripts/validate.ts <change dir>
```

Run from the repository root. If `bun` is not installed, stop and say so - do not
fall back to reviewing the rules by eye.

The validator applies the full task bar as soon as `tasks/` is non-empty, whatever
`state` still says. That is deliberate: the tasks are checked here, before the user is
asked to approve them, not after.

Report every error and warning. Silence is not a pass.

On a size failure (`goal` too long, `scope` too wide), present a **proposed split** -
not a question. Splitting is mechanical; the seam is judgement. Show the seam, let the
user approve it or redraw it. If the user declines the split, record why in
`oversize_ack` on that task; it is a reality check, not a gate.

### 8. Approval

The user approves, never the skill. On approval, set `state: planned`, run the validator
again - a state flip changes which bar applies, so it is never committed unvalidated -
and commit `proposal.md` and `tasks/` by explicit path using the `commit` skill.

## Anchors

Any file reference, anywhere, takes one of four forms:

```
src/middleware/security.ts               the whole file
src/middleware/security.ts:34            one line
src/middleware/security.ts:34-51         a range
src/middleware/security.ts::applyHeaders a symbol
```

Anchor to a symbol; use a line only where there is no symbol to name (config blocks,
markup, data files). Lines rot when a task edits the file; symbols do not.

`forbidden` takes whole paths and globs only, never anchors. Forbidding half a file is
a rule an agent cannot reliably obey and a reviewer cannot cheaply check - if only part
of a file is off-limits, the pin is probably wrong.

## proposal.md, approach block

Added to the frontmatter `change-propose` already wrote.

```yaml
---
# ... problem block from change-propose ...
state: planned            # drafted | proposed | planned | done
baseline:
  command: "npm test"
  result: pass
  duration_s: 34
  commit: a1b2c3d
  clean_tree: true
pinned_decisions:
  - "Header set in src/middleware/security.ts::applyHeaders, not per-route."
  - "Policy string read from CSP_POLICY env var; empty means header omitted."
alternatives_rejected:
  - approach: "Set the header at the CDN edge."
    reason: "Policy would drift from the app that generates the markup."
escalate_if:
  - "The policy requires unsafe-inline to keep any page working."
  - "An existing test must be modified to pass."
---
```

`escalate_if` names the circumstances where the implementer stops rather than adapts.
Without it, pinning turns "improvises badly" into "proceeds confidently off a cliff".

## tasks/T1.md shape

```yaml
---
id: T1
state: todo               # todo | done
type: behavior-change     # behavior-change | behavior-preserving
goal: "An HTML response carries a content-security-policy header."
satisfies: R1
verify: "npm test -- security.test.ts -t 'sets CSP header'"
verify_result: fail       # run at plan time; fail on behavior-change, pass on behavior-preserving
test: "test/security.test.ts::sets CSP header"
scope:
  - path: src/middleware/security.ts::applyHeaders
  - path: test/security.test.ts
    new: true
forbidden:
  - path: "src/routes/**"
    reason: "Header is middleware-level; per-route changes mean the pin was wrong."
depends_on: []
---

Optional prose. Only what the agent needs and the fields cannot carry.
```

## Prohibitions

- May not invent requirements. Needs something the proposal lacks - stop and ask; the
  gap goes in `unresolved`, which blocks approval.
- No implementation code, and no test bodies - test names and assertions, yes. No
  architecture rationale inside a task; that belongs in `pinned_decisions` and
  `alternatives_rejected`.
- No estimates presented as commitments.
- Does not mark itself approved or done, and `proposal.md` does not list tasks. Two
  places holding task state is two places that disagree.
