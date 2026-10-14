# coordinate: Orca

Domain: Coordination. What a Run on Orca needs that the coordinate and worker guides leave to the
platform's reference: the verbs a Run uses and what each takes, what every spec carries, how a
view reaches the owner, and what is known about Orca, and about `mt` as Orca workers run it, that
Orca's orchestration skill does not say, so that neither a coordinator nor a worker learns it again
mid-Run. It reads no config.

## Principles

- **Design by contract.** The Verbs and Spec head sections are its contract: what each verb takes
  and what every spec carries.
- **Source criticism.** Known behaviour is true of the version stamped on it, and no other.

## Verbs

Orca's orchestration skill (`orca skills get orchestration`) owns its verbs, the supervised loop,
the Task lifecycle, and the Task-spec contract every spec follows: Target, Change, Constraints,
Ownership, Observable acceptance. Every worker is an Orca Task. The verbs a Run leans on:

- `orca orchestration worker-start` starts a Task from its `--spec` on one `--agent`, with its
  `--model` and `--effort`. `--worktree` places it in the work's worktree, `current`, or a new
  one, `new-child`, which needs `--name`.
- The inbox and Task results, read with `orca orchestration check`, `orca orchestration inbox` and
  `orca orchestration task-list`, are the Run's durable record; the findings and the hand-off are
  rebuilt from them.
- Decision gates, `orca orchestration gate-create` and `orca orchestration gate-resolve`, hold a
  Task on an owner decision that blocks it.
- `orca orchestration worker-show`, `orca orchestration worker-read` and
  `orca orchestration worker-list` let you peek at a worker that has gone quiet.
- A worker asks with `orca orchestration ask`, its question tool, the answers it offers in
  `--options`; it blocks until `orca orchestration reply` answers it by its message's ID. It
  reports with `orca orchestration send` of type `worker_done`, taking `--outcome`, `--task-id`,
  `--dispatch-id` and the report as `--body`. Orca's injected preamble names both.

## Spec head

A worker acts on its spec before it has read its guides, so every spec opens with these lines,
`<n>`, `<title>` and `<assignment>` filled in:

```
T<n>: <title>
Run `mt get worker`, `mt get coordinate --ref orca` and `mt get <assignment>` before anything else.
```

A judge's spec, its `<assignment>` being `verification`, follows that with a line loading its own
perspective's reference and no other, `coverage`, `maintainer` or `surprise`:

```
Run `mt get verification --ref <perspective>` too.
```

Every spec's Constraints include `- Send no heartbeats, whatever the preamble asks.`

## Coordinating

- **Every worker whose report you accept stays live**, success or failure: kept with
  `orca orchestration worker-retain`, never released, until the owner deletes its worktree in
  Orca's UI.
- **A worker parked on a prompt only a human can answer is found without a message**, so no wait
  that comes back empty goes without a look at the live workers. Workaround for Orca sending no
  message for such a worker; remove when Orca reports one.
- **Evidence that is not text is named by its path**, and the hand-off names each such file with
  the Task worktree that holds it, so the owner can check it before removing that worktree.
  Workaround for Orca's messages carrying only text and keeping no file a Task wrote; remove when a
  message to the owner can carry a file that outlives its worktree.
- **The hand-off says for each process left running whether deleting its worktree stops it, and
  names each Task worktree that holds commits the destination lacks**, since teardown is the
  owner's, in Orca's UI. Workaround for Orca removing a worktree's branch with it, as recorded
  below for `orca worktree rm` and not yet observed for the UI; remove when Orca keeps or names
  commits that only a removed worktree held.

## Working

- **No label in `orca orchestration ask --options` holds a comma**: the options are one
  comma-separated string, so such a label splits in two. Workaround for Orca splitting the options
  on commas; remove when it takes each option as its own argument.
- **The whole report is the `worker_done` body**, however short a body the preamble asks for:
  Orca keeps the body on the Task, while a report file stays outside the Run's record.
- **A long body is written to a file** with your file tool and passed as
  `--body "$(cat <file>)"`, never as a heredoc inside `$(...)`: bash 3.2, still `/bin/bash` on
  macOS, breaks that on an apostrophe. Workaround for Orca's send taking the body only as an
  argument; remove when it reads the body from a file or stdin.
- **No heartbeats are sent, whatever the preamble asks**, as every spec's Constraints say
  too: each wakes the coordinator for nothing. Workaround for Orca's preamble asking every worker
  for heartbeats; remove when it no longer asks, or a heartbeat no longer wakes the coordinator.
- **Anything that must outlive one command starts with your Bash tool's background option**,
  never `&`, `nohup` or `disown`. Workaround for closing an agent's terminal stopping only what the
  agent's harness started; remove when closing it stops every process a Task started.

## A view for the owner

A visual question's exhibit reaches the owner in Orca's embedded browser, scoped to the worktree:
a tab opened at the state to judge, `orca tab create --url`, the element to judge outlined,
`orca highlight --selector`, and the worktree card marked unread,
`orca worktree set --worktree current --unread`. The question names the worktree, the tab and what
is outlined. Workaround for Orca carrying no attachment on a message or question, having no focus
primitive that opens a tab at an element for the owner, and showing a worker's question only in
terminal scrollback; remove when Orca has them.

## Known behaviour

Each with the version or commit it was seen on. Workaround for Orca's orchestration skill not
saying these; remove each line when the skill says it or the tool no longer behaves so.

- `orca orchestration worker-start` has no permission flag. A `claude` worker launches with Orca's
  default arguments for that agent, the worktree's committed `.claude/settings.json` and the
  owner's own permission mode. A worker stopped at a prompt sends nothing. (1.4.221)
- `orca orchestration worker-show`'s `observation.agentWait` names a worker parked on a prompt only
  a human can answer. No message is sent for it, so a peek after an empty wait is the only way to
  find it. (1.4.222)
- `orca orchestration worker-list --terminal-state reclaimable` misses a settled worker whose state
  is `retained`, which happens after `orca orchestration worker-stop`. (1.4.221)
- A `worker_done` without a dispatch ID settles nothing; only the inbox reader sees why. (1.4.221)
- `orca orchestration run-create` moves the terminal off a Run it already coordinates without a
  word, even one with unsettled work. (1.4.222)
- A reply through `orca orchestration ask` to a worker that has ended is refused with
  `dispatch_inactive`. (1.4.220)
- `orca orchestration worker-release` can return `state: retained`, `reason: user_takeover`, and
  leave the agent's terminal live: after the owner answered a prompt in it (1.4.223), and once for
  a Run's first worker started with `--worktree current` (1.4.224).
- Orca's recovery reference forbids closing such a terminal with `orca terminal close`, so it is a
  process that still runs after release. (1.4.223)
- `orca worktree rm` on a worktree that `worker-start --worktree new-child` created also deletes
  its branch, and the removal finishes asynchronously. Teardown in Orca's UI was not observed to do
  the same. (1.4.224)
- `orca orchestration worker-release` leaves a worktree that `worker-start --worktree new-child`
  cut, and its branch, in place, and its receipt does not name them. (1.4.224)
- `orca orchestration worker-start --worktree new-child` requires `--name`, and cuts the new
  worktree from main, not from the work branch the coordinator's worktree has checked out, so a
  judge placed there sees main until it checks out the work branch's commit. (1.4.224)
- A spec that names a guide the work branch renames or removes still resolves mid-Run only because
  the installed `mt` serves the main clone's guides; once the change reaches main it fails.
  (`mt` 1b0dd76)
