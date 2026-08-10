---
name: change-propose
description: Open a change by writing the problem block of its proposal - what the problem is, what done looks like, and what would make this the wrong problem to solve. Use whenever the user describes work to be done, an itch, a feature, a bug, or a refactor - and whenever the user says "propose this", "spec this", "brainstorm this", "what should we build", or names a change they intend to hand to an agent. Use it BEFORE planning; change-plan invokes it with --lite when no proposal exists. Also use when an existing proposal's problem block needs revising.
---

# change-propose

Write the problem block of `proposal.md` in a change directory, and stop. It states the
problem, what done looks like, and what would make this the wrong problem to solve.

It contains no approach, no file layout, no code, no task breakdown. Those are
`change-plan`'s half of the same file.

## Where things go

Resolve the changes directory once, before anything else, and use that one path
everywhere below - proposal, validator argument, archive:

- default `docs/changes/`
- overridden by a line matching `changes dir: <path>` in the project's `CLAUDE.md`

The change lives at `<changes dir>/YYYY-MM-DD-<slug>/`, where the date is today and the
slug is 2-4 kebab-case words. That directory is `<change dir>` below.

## Before the first write

Ensure the branch `change/YYYY-MM-DD-<slug>` exists and is checked out. Switch to it if
it is already there - a revision of an existing proposal is the normal case, and `-c`
alone fails on it:

```
git switch change/YYYY-MM-DD-<slug> 2>/dev/null || git switch -c change/YYYY-MM-DD-<slug>
```

An uncommitted working tree is fine - the changes carry over. Do not stash, do not
commit unrelated work, do not create a worktree.

If the repository has no git, say so and stop.

## Process

### 1. Read first

Explore the area named in the prompt before asking anything. Cite what was found with
`path:line` or `path::symbol`. Questions asked from zero context are generic, and a
generic question spends the user's attention for nothing.

### 2. Scope check

If the prompt describes several independent subsystems, say so immediately and help
split it into separate changes. Do not spend the interview refining something that
needs decomposing.

### 3. Interview

Run the `grilling` skill. Two rules bind it to this artifact:

- Ask only where the answer changes a field in the proposal or produces a rejection
  reason. If both answers lead to the same file, do not ask.
- There is no question count cap. Relevance is the bound.

### 4. Chunked confirmation

Present the problem block one part at a time as it firms up - outcome, then non-goals,
then requirements - and wait for confirmation on each. The user grasping each decision
as it lands is the point; a complete artifact they did not read is the failure this
replaces.

### 5. Write

Write the problem block with `state: drafted`, then check two things by hand:

- Every claim outside `requirements` carries an evidence anchor.
- No requirement names a technology or a file. That is an approach decision wearing a
  requirement's clothes, and it belongs to `change-plan`.

Then run the validator, which owns everything mechanical:

```
bun .claude/skills/change-plan/scripts/validate.ts <change dir>
```

At `drafted` the validator checks nothing by design - that run is a smoke test that the
file parses. The run after sign-off is the one that decides.

Report every error and warning. Silence is not a pass.

### 6. Sign-off

The user signs off, never the skill. On explicit approval, set `state: proposed`, run
the validator again - a state flip changes which bar applies, so it is never committed
unvalidated - and commit `<change dir>/proposal.md` by explicit path using the `commit`
skill.

## --lite

`change-plan` invokes `change-propose --lite` when a change has no proposal yet. It is
a closed list, not a mood:

- Ask four things in one exchange: outcome, kill criterion, non-goals, and the one
  requirement that would be false today and true when this is done. The requirement is
  not optional trimming - a proposal with none fails the validator, and every task
  `change-plan` writes has to name one.
- Skip `inferences`. Skip the interview rounds - one exchange, then return.
- Set `state: proposed`, validate, commit, hand back.

Nothing is lost by skipping the rest, because `change-plan` always runs the
three-alternatives floor on its own half.

## Exit condition

The proposal can answer: *what would make this the wrong problem to solve?* If it
cannot, it is not finished.

## Shape

Only the fields this skill owns. `change-plan` adds its own to the same frontmatter.

```yaml
---
id: 2026-08-08-csp-header
state: proposed           # drafted | proposed | planned | done
outcome: "Every HTML response carries a Content-Security-Policy header."
kill_criterion: "If the policy cannot be expressed without unsafe-inline, stop and re-scope."
non_goals:
  - "Not adding CSP reporting."
  - "Not touching the existing security headers middleware ordering."
requirements:             # ids are R followed by digits; at most 7, or split the change
  - id: R1
    text: "An HTML response from any route carries a content-security-policy header."
  - id: R2
    text: "The policy value is configurable per environment without a rebuild."
inferences:               # each needs sign-off before change-plan may rely on it
  - claim: "No inline scripts remain in the rendered templates."
    evidence: src/views/layout.html:12
    signed_off: false
unresolved: []            # non-empty blocks sign-off
---

Prose body is optional. Use it for context a future reader needs and the fields
cannot carry. Do not restate the fields in prose.
```

A killed change is moved to `<changes dir>/archive/<id>/`. There is no killed state.

## Prohibitions

- No approach, no file layout, no code, no task breakdown.
- Does not invent requirements to fill a gap. A gap goes in `unresolved` and stops.
- Does not mark itself `proposed`.
- Does not accept "this is too simple to propose". Either it is `--lite`, or it gets
  the full interview.
- No vague qualifiers in `outcome` or `requirements`. `validate.ts` holds the
  authoritative list and rejects them.
- Hands off to nothing except `change-plan`.
