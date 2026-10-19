# coordinate: Orca

Domain: Coordination. What a Run on Orca needs that the coordinate guide leaves to the
platform's reference: the verbs a Run uses and what each takes, what every spec carries, how a
view reaches the owner, and what is known about Orca, and about `mt` as Orca workers run it, that
Orca's orchestration skill does not say, so that neither a coordinator nor a worker learns it again
mid-Run. It reads no config.

## Principles

- **Design by contract.** The Verbs, Spec head and A view for the owner sections are its contract:
  what each verb takes, what every spec carries and how a view reaches the owner.
- **Source criticism.** Known behaviour is true of the version stamped on it, and no other: a
  later Orca may have fixed it, so a line is relied on past its version only once seen again.

## Verbs

Orca's orchestration skill (`orca skills get orchestration`) owns its verbs, the supervised loop,
the Task lifecycle, and the Task-spec contract every spec follows: Target, Change, Constraints,
Ownership, Observable acceptance. Every worker is an Orca Task. The verbs a Run leans on:

- `orca orchestration worker-start` starts a Task from its `--spec` on one `--agent`, with its
  `--model` and `--effort`. `--worktree` places it in the work's worktree, `current`, or a new
  one, `new-child`, which needs `--name` and is created with the worker's agent.
- The inbox and Task results, read with `orca orchestration check`, `orca orchestration inbox` and
  `orca orchestration task-list`, are the Run's durable record; the findings and the hand-off are
  rebuilt from them.
- Decision gates, `orca orchestration gate-create` and `orca orchestration gate-resolve`, hold a
  Task on an owner decision that blocks it.
- `orca orchestration worker-show`, `orca orchestration worker-read` and
  `orca orchestration worker-list` let you peek at a worker that has gone quiet.
- A worker asks with `orca orchestration ask`, the answers it offers in `--options`, and blocks
  until `orca orchestration reply` answers it by its message's ID, so on Orca a worker waits for
  its answer rather than ending its Task with the question. It reports with
  `orca orchestration send` of type `worker_done`, taking `--outcome`, `--task-id`,
  `--dispatch-id` and the report as `--body`. Orca's injected preamble names both IDs.

### Agents, models and efforts

**Every worktree a Run creates starts with its agent, launched on the model and effort the Run
chose.** A worktree created with its agent gets the behaviour Orca gives a new agent tab, which a
bare `orca worktree create` skips; `orca orchestration worker-start` with `--worktree new-child`
creates one so. The model and effort are named, never left to the agent's own default, so a Task
runs on what the Run chose rather than on whatever the owner's agent config holds; the cost is that
the Run picks a model for every Task, and a model id its provider retires fails the launch.

Orca prints no list of the agents it launches, the model ids each takes or the efforts it accepts,
and a `copilot` or `opencode` model id, named in the worker's own command below, is an opaque
provider id Orca passes through unchecked, so a Run picks from these, each seen to launch with the
model and the effort beside it on Orca 1.4.229, with Claude Code 2.1.303, Copilot CLI 1.0.98 and
opencode 2.0.30. Workaround for Orca printing no agents, models or efforts; remove when a verb
prints them.

| `--agent` | `--model`, with the effort it was seen on |
|---|---|
| `claude` | `opus` (`xhigh`), `sonnet` (`high`, `medium`) |
| `copilot` | `claude-opus-5.5` (`high`), `gpt-6.1-sol` (`xhigh`), `grok-4.7` (`medium`) |
| `opencode` | `github-copilot/gpt-6.1-sol` (`xhigh`), `github-copilot/grok-4.7` (`medium`), `github-copilot/gemini-4-argon` (`high`) |

`--effort` is `medium`, `high` or `xhigh`, and needs `--model` beside it: Orca refuses an effort
on an agent's default model. For `claude`, Orca checks the effort against the model before it
launches anything, so a pairing the model does not support fails at once, never running on another
effort; a pairing the table does not show may still launch, as `opus` on `medium` did. `haiku` is
left out because the effort is always named: Orca refuses every effort on it, so it cannot launch
with one. Workaround for Orca taking no effort for `haiku`; remove when Orca takes one and `haiku`
is seen to launch on it.

Copilot and opencode take no model when their worktree is created, so their worktree is the one
exception to the rule: it is created with no agent yet, by `orca worktree create --name <name>`
without `--agent`, and the worker's own terminal, started in it with
`orca terminal create --command`, runs the agent on its model and effort and is then started as a
Task with `worker-start --terminal <handle> --worktree <that worktree>`, since a `--worktree` of
`current` means the coordinator's own. That worktree misses what agent-first creation
gives; the owner chose that over a Run not using these agents. No other worktree is created
without its agent.

- **Copilot.** `orca worktree create --agent copilot --model` is refused, "Agent copilot does not
  support launch-time model selection" (1.4.229), and `worker-start --agent copilot` refuses
  `--model` (1.4.227). The command is `copilot --model <id> --reasoning-effort <level>`. The
  worker answers the trust-the-folder prompt Copilot opens in a new worktree, which
  `orca terminal wait --for tui-idle` never sees past. Copilot's status line names the model but
  not the effort; its `/model` picker marks the session's model with a tick and shows the effort
  beside it. Workaround for Orca not passing a model to Copilot; remove when
  `orca worktree create --agent copilot --model --effort` is accepted.
- **opencode.** `orca worktree create --agent opencode --model` is refused, "OpenCode model
  selection requires an existing worktree", and in a worktree that exists Orca refuses its effort
  (1.4.229). The command is
  `XDG_STATE_HOME="$(mktemp -d)" OPENCODE_CONFIG_CONTENT='{"model":"<model>#<effort>"}' opencode --standalone`.
  opencode's TUI takes no model flag, so the model reaches it only through that config.
  `--standalone` gives the terminal its own server, which reads the config, where the shared
  background service, started without it, would not. The fresh state folder matters because
  opencode remembers the effort last picked for a model, and that beats the config's:
  `gpt-6.1-sol#medium` launched on `high`, the effort remembered for it, and with a fresh state
  folder `gpt-6.1-sol#xhigh` took. That folder outlives the worker, a leftover of each opencode
  Task, and every command the worker runs inherits `XDG_STATE_HOME`, so a tool that keeps its
  state there would start empty too. On an Orca-managed opencode data account it also bypasses
  that account: Orca owns such a pane only while `XDG_STATE_HOME` is the account's state folder
  (read in Orca's code, not run). The model is named with its provider, so opencode must be
  signed in to that provider, here GitHub Copilot. The effort is one of the model's variants; a
  variant the model lacks is dropped without a word, so the TUI's status line,
  `Build · <model> GitHub Copilot · <effort>`, is what shows the effort took. Workaround for Orca
  not passing a model and effort to opencode at worktree creation; remove when
  `orca worktree create --agent opencode --model --effort` is accepted.

## Spec head

A worker acts on its spec before it has read its guides, so every spec opens with these lines,
`<n>`, `<title>` and `<assignment>` filled in:

```
T<n>: <title>
Run `mt get coordinate --ref orca` before anything else.
```

A spec whose assignment has a guide, `oracle` or `verification`, follows that with a line loading
it, and a judge's also loads its own perspective's reference and no other, `coverage` or
`surprise`:

```
Run `mt get <assignment>` too.
Run `mt get verification --ref <perspective>` too.
```

Every spec's Constraints include `- Send no heartbeats, whatever the preamble asks.`, since a
worker's first command may run before it has read the line below.

## Coordinating

- **Every worker whose report you accept stays live**, success or failure, kept with
  `orca orchestration worker-retain` and never released, until the owner deletes its worktree in
  Orca's UI: its worktree may hold the only copy of its commits and its evidence, and teardown is
  the owner's.
- **A worker parked on a prompt only a human can answer is found without a message**, so an
  empty wait is followed by a look at the live workers. Workaround for Orca sending no message
  for such a worker; remove when Orca reports one.
- **Evidence that is not text, a process left running and commits the destination lacks are
  named by the Task worktree that holds them**, and the hand-off says whether deleting that
  worktree stops the process, so that the owner can check and keep what they need before removing
  it. Workaround for Orca's messages carrying only text, keeping no file a Task wrote, and, as
  recorded below for `orca worktree rm` and not yet observed for the UI, removing a worktree's
  branch with it; remove when a message to the owner can carry a file that outlives its worktree
  and Orca keeps or names commits that only a removed worktree held.

## Working

- **No label in `orca orchestration ask --options` holds a comma**: the options are one
  comma-separated string, so such a label splits in two. Workaround for Orca splitting the options
  on commas; remove when it takes each option as its own argument.
- **The whole report is the `worker_done` body**, however short a body the preamble asks for:
  Orca keeps the body on the Task, while a report file stays outside the Run's record. A long
  body is written to a file with your file tool and passed as `--body "$(cat <file>)"`, never as
  a heredoc inside `$(...)`: bash 3.2, still `/bin/bash` on macOS, breaks that on an apostrophe.
  Workaround for Orca's send taking the body only as an argument; remove when it reads the body
  from a file or stdin.
- **No heartbeats are sent, whatever the preamble asks**: each wakes the coordinator for nothing.
  Workaround for Orca's preamble asking every worker for heartbeats; remove when it no longer
  asks, or a heartbeat no longer wakes the coordinator.
- **Anything that must outlive one command starts with your Bash tool's background option**,
  never `&`, `nohup` or `disown`. Workaround for closing an agent's terminal stopping only what the
  agent's harness started; remove when closing it stops every process a Task started.

## A view for the owner

What a question shows the owner for the eye to judge reaches them in Orca's embedded browser,
scoped to the worktree: a tab opened at the state to judge, `orca tab create --url`, the element
to judge outlined, `orca highlight --selector`, and the worktree card marked unread,
`orca worktree set --worktree current --unread`. The question names the worktree, the tab and what
is outlined. Workaround for Orca carrying no attachment on a message or question, having no focus
primitive that opens a tab at an element for the owner, and showing a worker's question only in
terminal scrollback; remove when Orca has them.

A prototype is served from the worktree and opened in such a tab rather than published as a public
link.

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
