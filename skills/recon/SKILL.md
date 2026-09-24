---
name: recon
description: Chart work too big for one session as a map of decisions toward a destination across the working repo and its local neighbours, then advance it one frontier node at a time through shape, spike, or research runs, settling AFK research itself. Keeps the map in a file or tracker the user names, so it survives between sessions.
disable-model-invocation: true
---

# recon

Chart work too big for one session as a map of decisions toward a destination, then advance it
one node at a time. Each node is one question that a single run settles: a shape run (`mvc`), a
spike, or research. Recon draws the map, keeps it, says what to settle next, and runs the research
the user hands it.

Recon plans and never implements. It writes no code and settles no shape or spike node. It writes
only the map and research findings, to the holder the user names - see [The holder](#the-holder).

## Vocabulary

- **Destination** - what is true once the whole map is settled. One sentence.
- **Node** - one question that one run can settle.
- **Working repo** - the repo recon runs in.
- **Neighbour** - another local repo upstream or downstream of the working repo, in a multi-module
  or microservice architecture. A package-manager dependency is not a neighbour.
- **Dependency graph** - the nodes and their `blocked_by` edges. A node is blocked until every
  node it names is settled.
- **Frontier** - the open nodes with nothing blocking them. These are the only nodes that can be
  settled next.
- **Fog of war** - unknowns that can't be stated precisely enough to be a node yet.
- **Critical path** - the chain of blocking that decides how soon the destination is reached. The
  frontier node on it unblocks the most.
- **Spike** - a timeboxed build of something throwaway, whose verdict unblocks a decision. It is
  not a deliverable.
- **Research** - reading and asking to find out facts, whose result is findings. Each finding is
  answered with provenance or is **dark** - looked for, not found.
- **AFK** - research recon runs itself through a subagent. **Manual** - research a person answers.

## Invariants

1. **Plans, never implements.** No code, no build, no task. Recon settles a research node only
   when the user picked it as AFK, and never settles a shape or spike node. A complete map hands
   nothing on.
2. **Recon proposes, the user decides.** It never settles a shape or spike node, picks the next
   node, sets a research node's mode, or admits a node, fog entry, or non-goal on the user's
   behalf.
3. **Settled is closed.** Reopening needs new information. Idempotent: re-invoked on a map, it
   reads the map back and asks nothing the map already settles.
4. **Append-only, stable IDs.** Node IDs are `N1`, `N2`, ... in creation order. A withdrawn or
   split node keeps its ID, and no ID is ever reused.
5. **One question per node.** A node whose question needs "and" is two nodes.
6. **One repo per shape or spike node.** A decision that spans repos is a shared contract node
   plus a node in each repo, blocked by it.
7. **Fail closed.** An unreachable holder means nothing is written - see
   [Failing closed](#failing-closed).

## The map

The map uses `mvc`'s vocabulary. `destination` is the one scalar; every other field is a
collection, and an empty one is a statement.

```yaml
destination: <one sentence - what is true once the map is settled>
repos:
  - remote: <git remote URL, or a name when there is no remote>
    relation: upstream | downstream
nodes:
  - id: N1
    question: <one question>
    kind: shape | spike | research
    repo: <a remote in repos>
    mode: afk | manual
    owner: <who can answer>
    blocked_by: [N2]
    status: open | settled | withdrawn
    link: <where the result lives>
    cause: <why it was withdrawn>
fog:
  - <an unknown not yet stated precisely>
non_goals:
  - item: <what the destination does not include>
    type: boundary | deferral
    reason: <the line that separates it, or why not now>
```

- **`kind`** is a closed set, and it decides how a node is settled. A **shape** node is settled
  by a shape run, whose result is a shape file. A **spike** node is settled by a spike, whose
  result is a verdict. A **research** node is settled by research, whose result is findings.
  Recon routes by kind, not by skill name. How a spike is run is the user's call.
- **`repos`** lists the neighbours, never the working repo, and never a local path. See
  [Neighbours](#neighbours).
- **`repo`** appears on a shape or spike node that lands in a neighbour, and names its entry in
  `repos`. Absent, the node lands in the working repo. A research node has no `repo`: it reads
  across the working repo and every listed neighbour.
- **`mode`** appears only on a research node. **`owner`** appears only on a manual research node
  that another party answers, and names who can.
- **`link`** is empty while the node is open. It is filled in when the node is settled - see
  [The holder](#the-holder) for what it points at.
- **`cause`** appears only on a withdrawn node.
- A **fog** entry has no kind and no ID. It graduates to a node with a fresh ID once its question
  can be stated precisely, and leaves the fog when it does.
- **Non-goals** are typed exactly as in `mvc`. A boundary prunes a branch of the map for good. A
  deferral parks it.

A node is sized to one run: one `mvc` run within its three-round timebox, one spike, or one
research candidate list. A node too big for that is two or more nodes. When in doubt at chart
time, draw the smaller nodes.

## Neighbours

A neighbour is identified by its git remote URL, or by a name when it has no remote, so the map
holds on any machine. Each session resolves every entry to a local clone, in this order:

1. a sibling of the working repo whose remote matches;
2. a location the repo's agent instructions (`AGENTS.md`, `CLAUDE.md`) give;
3. otherwise, ask the user once.

The resolved path lives only in context. A neighbour found after chart joins `repos` when it is
found, and recon says so.

## Research

A research node is bounded by its candidate list: the questions that settle it, written before any
investigation. It is done when each candidate is answered with provenance - `file:line` in a named
repo, a primary-source URL, or the person who answered - or is dark.

Recon proposes the mode from where the evidence lives, and the user decides:

- **AFK** - the working repo, the listed neighbours, or primary-source web can reach every answer.
- **Manual** - a person has to be asked. A fact another party owns is a manual node whose `owner`
  names who can answer it. A manual node waiting on its answer stays open and on the frontier.

AFK research runs as one subagent per node, given the node's question and candidate list. It:

- changes nothing - no writes, no code, no builds, no calls to live services;
- reads only the working repo and the listed neighbours, and never a secret-bearing file: `.env`
  files, keys and certificates, credential and secret stores;
- uses the web only for primary sources - vendor docs, specs, a package's own stated
  requirements - with two searches per candidate. No primary source means dark.

A dark finding that still blocks a decision is proposed as a new node or a fog entry. Findings
reach a shape run through its conversation: point `mvc` at the node's `link`.

## Chart

Chart runs when the holder has no map yet.

1. **Name the destination.** Take it from the user's argument and the conversation. If they
   don't determine it, ask. Every later step hangs off it.
2. **Find the neighbours.** Run one AFK sweep, under AFK research's rules, that follows
   cross-repo references: workspace and solution project references, submodules, compose files,
   service endpoints in config, shared contract repos, message topics, and whatever the repo's
   agent instructions name. Resolve each neighbour to a local clone, and ask once for any it can't
   locate. Record each in `repos` with its relation.
3. **Lay out the nodes.** List the questions standing between here and the destination. Give each
   node its question, kind, repo, and blocking, and each research node its proposed mode. What is
   unknown about a neighbour is a research node, not a guess. Read only enough to name the
   questions, not to answer them. Answering is the node's run: `mvc`'s round 0, the spike, and
   research do their own investigation.
4. **Put the rest in the fog.** An unknown that can't be phrased as one question yet goes in the
   fog, not in a vague node.
5. **Type the non-goals.** Record what the destination leaves out, each typed boundary or deferral
   with its reason. Leave out what nobody would have asked for.

Propose the map as a whole. The user corrects it, and corrections are free.

Chart closes when the frontier holds at least one unblocked node and every unknown the
conversation has raised is either a node or a fog entry. It doesn't wait for a complete graph -
the fog is where the rest of the map lives until it can be drawn. Once chart closes, write the map
to the holder and continue into advance.

## Advance

Advance runs when the holder already has a map, and right after chart.

1. **Read the map back.** Read it from the holder, never from memory of an earlier session.
   Resolve each neighbour - see [Neighbours](#neighbours).
2. **Record a result, if one is in hand.** Check whether the conversation holds a result for an
   open node: a shape file from a shape run, a spike verdict, or the answers to a manual research
   node's candidates. If it does, settle the node and fill its `link`.
   - **A split signal.** `mvc`'s exit 3 means the node was too big for one run. Withdraw it with
     the cause `split into <IDs>`, then add the child nodes with fresh IDs. Any node that was
     blocked by the parent is now blocked by the children that bear on it.
   - **Obsolete nodes.** A settled result can make another node obsolete. Propose withdrawing that
     node, stating the cause. A withdrawn node no longer blocks anything.
   - **New unknowns.** A result can surface new unknowns, dark findings among them. Propose each
     one as a node or a fog entry.
   - **New neighbours.** A result that names another local repo adds it to `repos`.
3. **Re-derive the frontier.** Rebuild the frontier from the graph. Check the fog for entries the
   new result lets you state precisely, and propose graduating them.
4. **Propose the next node.** Pick the frontier node on the critical path - the one whose
   settling unblocks the most open nodes, counting the whole chain behind it. Name it, its kind,
   its repo, and what it unblocks. The user decides and breaks ties, and may instead pick several
   AFK research nodes from the frontier.
5. **Run the pick.**
   - **AFK research** - dispatch one subagent per picked node, all at once, and wait until every
     one returns. Record the results one at a time as in step 2, re-deriving the frontier after
     each. A node a sibling's result made obsolete is still withdrawn with its cause, and its
     research is spent. Then return to step 4.
   - **Anything else** - a shape node, a spike node, or a manual research node. Recon stops: the
     user runs it - a shape run or spike in the node's repo, a manual node by asking its owner -
     then re-invokes recon with the result. Only AFK research nodes are ever picked together.

Write every change the user accepts back to the holder before proposing the next node.

With no new result and nothing changed, advance reports the frontier and the proposal. It asks
nothing.

**The map is complete** when no node is open and the fog is empty. Report that and stop. Recon
hands nothing on to implementation.

## The holder

The user names where the map lives, as the argument or in the conversation. Until they do, the map
lives only in context and nothing is written.

Recon only tells a file from a provider:

- **A file** - an argument ending in `.md` is a file path. Anything else names a provider.
- **A provider** - a tracker. How to reach it, and whether that's possible, comes from the repo's
  agent instructions (`AGENTS.md`, `CLAUDE.md`), never from recon. Recon holds no provider rules
  and never guesses a client.

The layout follows the holder:

- **File holder** - the map is one document: the map block as frontmatter, and no body. A settled
  shape node's `link` is the path to its shape file, relative to the root of the node's repo. A
  settled spike node's `link` is the verdict itself, in one or two sentences. A settled research
  node's `link` is `<map-stem>-<node-id>.md` beside the map: a findings file whose frontmatter is
  the block below, and no body.
- **Tracker holder** - one index item holds `destination`, `repos`, `fog`, `non_goals`, and a link
  to each node's item. Each node is its own item, titled with its ID and question, and its
  `blocked_by` uses the tracker's native blocking links. A settled node's shape, verdict, or
  findings is written into its own item, never linked to a local path.

```yaml
node: N3
question: <the node's question>
findings:
  - candidate: <one question from the candidate list>
    answer: <the answer, or dark>
    provenance: <file:line in a named repo, primary-source URL, or who answered>
```

## Failing closed

Check every holder by reading it before any write. The first check that fails says so, writes
nothing, and stops. Stopping is free: the map is still in context, and re-invoking recon asks
nothing already settled.

- **File** - the directory must already exist, because a missing path is a typo, so there is no
  `mkdir`. An existing file is replaced only if it's a map file, meaning it has frontmatter with
  `destination` and `nodes`. Otherwise name the file and stop. A findings file follows the same
  rules: an existing one is replaced only if its frontmatter names the same `node`.
- **Provider** - if the repo's agent instructions don't say how to reach it, stop. There is no
  fallback to `gh` and no fallback to a file. If the tracker can't be reached, or the index item
  can't be read, stop.

Report the absolute path, or the index item's link.

## Checklist

Beyond the invariants:

- The destination is one sentence; every node is one question with a kind of `shape`, `spike`, or
  `research`.
- No task node, and no node named after a skill.
- Neighbours are found by one sweep at chart and recorded by remote URL or name, never by path.
- Every shape or spike node lands in one repo; a shared contract is its own node.
- Every research node has a candidate list before investigation and a mode the user decided; a
  manual node another party answers names its `owner`.
- AFK research changes nothing, reads only listed repos and primary-source web, and never reads a
  secret-bearing file.
- Every unknown is a node or a fog entry; fog entries have no kind until they graduate. A dark
  finding that still blocks is one or the other.
- Every non-goal is typed boundary or deferral, with its reason.
- Chart closes on a non-empty frontier, not on a complete graph.
- Advance reads the map back from the holder, records a result only when one is in hand, and
  proposes one critical-path node. The user picks, and only AFK research nodes run together.
- Parallel results are recorded one at a time once every subagent returns, with the frontier
  re-derived after each.
- An exit-3 split withdraws the parent with its cause and adds children with fresh IDs.
- Withdrawn nodes carry a cause; no ID is reused.
- A tracker node's result is written into its own item.
- No write before the holder is read; no write to a provider without the repo's agent
  instructions saying how.
- A complete map is reported and handed nothing.
