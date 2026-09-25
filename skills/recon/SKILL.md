---
name: recon
description: Chart work too big for one session as a map of decisions and research toward a destination across the repos the user names, then advance it one frontier node at a time, settling AFK research itself and handing decisions to the user. Keeps the map in the file the user names, so it survives between sessions.
disable-model-invocation: true
---

# recon

Chart work too big for one session as a map of nodes toward a destination, then advance it one
frontier node at a time. Recon draws the map, keeps it, proposes what to settle next, and runs the
AFK research the user picks.

The argument is the holder, every time - see [The holder](#the-holder). Destination, scope, and
results come from the conversation.

## Vocabulary

- **Destination** - what is true once the map is settled. One sentence.
- **Scope** - the repos the map covers, named by the user.
- **Node** - one question that one run settles.
- **Run** - one session of work outside recon. A node too big for one run is two or more nodes.
- **Settle** - close a node with its result. A decision is settled by someone choosing, research
  by findings. Settled is closed.
- **Decision** - a node the user settles, in a run elsewhere. How that run works is not recon's
  concern.
- **Research** - a node settled by finding out facts. Its result is findings: each candidate
  answered with provenance, or **dark** - looked for, not found.
- **Candidate list** - the questions that settle a research node, written before any
  investigation. It bounds the research.
- **Provenance** - `file:line` in a repo in scope, a primary-source URL, or the person who
  answered.
- **AFK** - research recon settles itself through a subagent. **Manual** - research a person
  settles, by asking or by trying something.
- **Blocked** - a node is blocked until every node in its `blocked_by` is settled or withdrawn.
- **Frontier** - the open nodes that are not blocked. Only these can be settled next.
- **Fog** - unknowns that can't be stated as one question yet.
- **Critical path** - the chain of blocking that decides how soon the destination is reached. The
  frontier node on it unblocks the most, counting the whole chain behind it.
- **Holder** - the file the map lives in.

## Invariants

1. **Plans, never implements.** No code, no build, no task. Recon settles only AFK research the
   user picked. A complete map hands nothing on.
2. **Recon proposes, the user decides.** It never settles a decision, picks the next node, or
   changes the map on the user's behalf. Findings from AFK research are the one exception: recon
   writes them without asking.
3. **Settled is closed.** Reopening needs new information. Idempotent: re-invoked on a map, recon
   reads it back and asks nothing the map already settles.
4. **Append-only, stable IDs.** Node IDs are `N1`, `N2`, ... in creation order. A withdrawn or
   split node keeps its ID, and no ID is ever reused.
5. **One question per node.** A node whose question needs "and" is two nodes.
6. **Fail closed.** An unreachable holder means nothing is written - see
   [Failing closed](#failing-closed).

## The map

`destination` is the one scalar; every other field is a collection, and an empty one is a
statement.

```yaml
destination: <one sentence>
repos:
  - <git remote URL, or a name when there is no remote>
nodes:
  - id: N1
    question: <one question>
    kind: decision | research
    mode: afk | manual
    owner: <who can answer>
    blocked_by: [N2]
    status: open | settled | withdrawn
    result: <where the result lives, or the outcome itself>
    cause: <why it was withdrawn>
fog:
  - <an unknown not yet stated as one question>
non_goals:
  - item: <what the destination does not include>
    type: boundary | deferral
    reason: <the line that separates it, or why not now>
```

- **`mode`** appears only on a research node. **`owner`** appears only on a manual research node
  another party answers, and names who can.
- **`result`** is filled in when the node is settled. For a decision: a repo in `repos` and a
  path from its root, or the outcome in one or two sentences. For research: the findings file -
  see [The holder](#the-holder).
- **`cause`** appears only on a withdrawn node.
- A **fog** entry has no ID. It graduates to a node with a fresh ID once it can be stated as one
  question.
- A **non-goal** is a **boundary**, which prunes a branch for good, or a **deferral**, which parks
  it. Each carries its reason.

When in doubt at chart time, draw the smaller nodes.

## Scope

The user names the scope as repos or folders; a folder stands for every git repo in it. The map
records each repo by its git remote URL, or by a name when it has no remote, so the map holds on
any machine. Never a local path.

Each session resolves the map's repos to local clones by matching remotes against the git repos in
the working directory and in any folder the user names this session. It asks once for any left
unresolved. Resolved paths live only in context.

A finding that names a repo outside the scope is proposed for admission. What needs knowing about
it becomes research nodes. If the user declines, a question about it that still blocks becomes
manual research or a fog entry.

## Research

Recon proposes the mode from where the evidence lives; the user's pick confirms it:

- **AFK** - the repos in scope or primary-source web can reach every candidate.
- **Manual** - a person has to be asked, or has to try something to find out. A manual node
  waiting on its answer stays open and on the frontier.

AFK research runs as one subagent per node, given the question and the candidate list. It:

- changes nothing - no writes, no code, no builds, no calls to live services;
- reads only the repos in scope, and never a secret-bearing file: `.env` files, keys and
  certificates, credential and secret stores;
- uses the web only for primary sources - vendor docs, specs, a package's own stated
  requirements - with two searches per candidate. No primary source means dark.

A dark finding that still blocks a decision is proposed as a new node or a fog entry. A proposed
node names the `result` of each research node it was blocked by, so its run can read the findings.

## Chart

Chart runs when the holder has no map yet.

1. **Propose the destination and the scope** from the argument, the conversation, and the git
   repos in the working directory. Ask only when they don't determine it.
2. **Lay out the nodes.** List the questions standing between here and the destination, each with
   its kind, its blocking, and, for research, its proposed mode and candidate list. Read only
   enough to name the questions, not to answer them.
3. **Put the rest in the fog.** An unknown that isn't one question yet goes in the fog, not in a
   vague node.
4. **Type the non-goals.** Leave out what nobody would have asked for.

Propose the map as a whole. The user corrects it, and corrections are free.

Chart closes when the frontier is non-empty and every unknown the conversation has raised is a
node or a fog entry. It doesn't wait for a complete graph - the fog is where the rest of the map
lives. Write the map to the holder and continue into advance.

## Advance

Advance runs when the holder has a map, and right after chart.

1. **Read the map back** from the holder, never from memory of an earlier session. Resolve the
   scope.
2. **Record a result, if the conversation holds one** for an open node: a decision's outcome, or
   the answers to a manual node's candidates.
   - **It settles the node.** Settle it and fill its `result`.
   - **It doesn't.** Propose the move it points to:
     - **split** - withdraw the node with the cause `split into <IDs>` and add the children with
       fresh IDs. A node blocked by the parent is now blocked by the children that bear on it;
     - **withdraw** - the question is moot;
     - **block** - add what must be known first as a new node the open node is blocked by;
     - **leave open** - nothing changed.
   - **Obsolete nodes.** Propose withdrawing any node the result makes moot, with its cause.
   - **New unknowns.** Propose each, dark findings among them, as a node or a fog entry.
3. **Re-derive the frontier.** Check the fog for entries the result lets you state as one
   question, and propose graduating them.
4. **Propose the next node** - the frontier node on the critical path. Name it, its kind, and what
   it unblocks. The user picks and breaks ties, and may instead pick several AFK research nodes
   from the frontier. Only AFK research nodes are ever picked together.
5. **Run the pick.**
   - **AFK research** - dispatch one subagent per picked node, all at once, and wait until every
     one returns. Write each node's findings, then record the results one at a time as in step 2,
     re-deriving the frontier after each. A node a sibling's result made obsolete is still
     withdrawn, and its research is spent. Return to step 4.
   - **Anything else** - recon stops. The user settles it, then re-invokes recon with the result.

Write every accepted change to the holder before proposing the next node.

With no result and nothing changed, advance reports the frontier and the proposal, and asks
nothing.

**The map is complete** when no node is open and the fog is empty. Report that and stop.

## The holder

The argument is a path ending in `.md`. Without one the map lives only in context and nothing is
written.

The map is one document: the map block as frontmatter, and no body. A settled research node's
`result` is `<map-stem>-<node-id>.md` beside the map: a findings file whose frontmatter is the
block below, and no body.

```yaml
node: N3
question: <the node's question>
findings:
  - candidate: <one question from the candidate list>
    answer: <the answer, or dark>
    provenance: <file:line in a named repo, primary-source URL, or who answered>
```

## Failing closed

Read the holder before any write. The first check that fails says so, writes nothing, and stops.
Stopping is free: the map is still in context, and re-invoking recon asks nothing already settled.

- The directory must already exist, because a missing path is a typo, so there is no `mkdir`.
- An existing file is replaced only if it's a map file: frontmatter with `destination` and
  `nodes`. Otherwise name the file and stop.
- An existing findings file is replaced only if its frontmatter names the same `node`.

Report the absolute path.
