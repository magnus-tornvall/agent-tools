# Charter

What an agent changing this repo needs to know about any part of it, whether a guide under
`guides/` with its references, a skill under `skills/`, or the code under `cli/` and `src/`: its
domain, what a part must contain, what is fixed and what is the agent's own judgment, and which
values are config.

## Purpose

The toolbox should get leaner as models improve, not go stale. Parts cut by workflow role encode a
workflow a stronger agent can't improve on. Parts cut by domain hold stable principles a stronger
agent composes better.

## Domains

| Domain | Principles from |
|---|---|
| Intent | commander's intent, observable end state, MVP deletion test, non-goals |
| Decision | reversibility (one-/two-way doors), value of information |
| Verification | test oracle, separation of duties, Goodhart's law, falsifiability |
| Change | minimal change, root cause by the scientific method |
| Evidence | source criticism, evidence hierarchy |
| Coordination | mission command, single writer per change, attention as the bottleneck |
| Tools | Unix philosophy, mechanism not policy, design by contract |
| Toolbox | Bitter Lesson, earned existence |

Each part declares its own domain, so the mapping lives in the parts rather than in a list that
goes stale. A guide, each of its references and the commit skill begin the first paragraph after
their title with `Domain: <domain>.` A stub skill that only loads a guide declares none; it is its
guide's part. The code under `cli/` and `src/` is Tools. So are the shape format's two examples,
`mt get mvc --ref example` and `mt get oracle --ref example`, which carry no line and belong with
the schema in `src/shape/`.

This charter is the home of Toolbox's principles. Research notes and behaviour records under
`docs/` are inputs, not parts.

## Fixed

Each fixed rule has one home part and is marked as fixed there with a sentence that ends the rule:
`Fixed: changing it is the owner's call.` This charter points to it. A coordinator in another repo
reads guides through `mt get` and never sees this repo's `AGENTS.md`, so the rule must live in the
part. Only the owner changes a fixed rule.

- **Acceptance obligations** hold on the final branch, fix commits included: the repo's checks
  pass; evidence is as strong as each requirement; oracles pass and none is tampered; nothing in
  the diff would stop a maintainer merging; nothing surprises the owner. Which Tasks meet them is
  composed. Home: the to-orca guide (`mt get to-orca`).
- **A separate actor per verification perspective**, each naming what it withholds, so work is
  never judged by whoever made it. Home: the verification guide (`mt get verification`), and each
  perspective's reference for what that perspective is given and withholds.
- **One-way doors go to the owner.** A one-way door is asked of whoever owns the decision.
  Home: the door-rule guide (`mt get door-rule`).
- **Surprise review always runs.** Home: the to-orca guide. A judge separate from the author is a
  principle (separation of duties); "always runs" is a workaround: workers decide one-way doors
  without asking, and the judge holding the least found the most (`docs/guides-behaviour.md`).
  Remove when Runs show workers no longer deciding one-way doors without asking, and the owner
  decides to remove it. A Run without such a door is not evidence.
- **The shape's format and validation.** Home: `mt`'s schema and examples, which `mt shape check`
  enforces in place of a mark. Principles for writing good intent belong to the mvc guide. Other
  parts name the shape's keys and never restate its structure or field rules.
- **Lifecycle bookkeeping belongs in tools or Orca.** Until one owns a step, the step stays in
  guide prose as a tagged workaround naming the gap. Home: this charter.
  Fixed: changing it is the owner's call.

Everything else is composed by the agent: which parts a task needs, which perspectives judge a
change, and the model and effort for each Task.

## Part template

Every part contains:

- its domain, declared at the start of its first paragraph;
- its purpose;
- principles that still hold for an agent ten times as capable, named in established terms;
- its contract at the seams;
- the config it reads;
- workarounds tagged inline with what they compensate for and when to remove them, each ending
  `Workaround for <gap>; remove when <condition>.`

A part states objectives, never the steps of a workflow or their order: how to get there is the
agent's own judgment. A mark adds a sentence to the part's prose, never a step.

Sorting a number:

- owner policy → config;
- contract or operational value (formats, exit codes, timeouts, rate limits) → stated where it's
  owned;
- a limit another tool enforces → not restated;
- a value the agent can choose → deleted, its purpose kept; choosing it is the agent's own
  judgment.

A part not yet reworked may still state such a value. Sort it by these rules as it stands: a
default, count or cap the agent could choose, however worded, is the agent's own judgment until
the rework deletes it, such as a number of rounds, questions per round or searches per fact, or a
fallback location; a cap another tool enforces is that tool's, not the part's.

## Config rule

- Config holds standing owner policy for unattended work: values the owner holds that no task can
  reveal, such as budget, risk tolerance and permission. A limit the owner sets for one task
  belongs in that task's shape or draft.
- One per-user TOML file under `~/.config/mt/`, printed by `mt`, listing its keys. No per-repo
  overrides until a repo needs one.
- Each key is binding or advisory.
- Precedence: the owner's explicit choice for a Run beats config. An agent never overrides a
  binding key.
- A missing or invalid binding key: `mt` says so and the agent asks the owner. No built-in
  default.
- Agents propose changes with evidence; only the owner makes them.

## Where it lives

Here, in the root `AGENTS.md`, which the root `CLAUDE.md` imports. Nothing under `guides/`, because
`mt list` lists every top-level Markdown file there as a tool. `test/guides.sh` checks that each
`mt` command and `mt get` guide this file mentions still exists.
