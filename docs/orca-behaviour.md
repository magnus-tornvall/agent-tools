# Known Orca behaviour

What Orca actually does, found by running it or by reading its guide, `--help` and bundled code.
Each list names the Orca version it was checked on. Facts only: how this repo uses Orca lives in
the code and skills.

Terms: *the tick* is `src/orca/tick.ts`, the script that coordinates a Run on the owner's behalf. *The
trial repo* is `~/dev/me/ai/vscode`. *The scoped settings* are a committed `.claude/settings.json`
that allows `Read`, `Edit`, `Write`, `Bash(orca orchestration:*)` and
`Bash(git status|diff|add|commit:*)`, and denies `Bash(git push:*)`.

## Smoke-tested on Orca 1.4.220

- A worker keeps running after the session that started it closes, and its `worker_done` stays in
  the Run's mailbox until read. The payload carries `taskId`, `dispatchId` and `outcome`.
- `run-use` fences the previous consumer: only one terminal at a time may read a Run's inbox; any
  other terminal's `check`, even `--peek`, fails with `consumer_fenced`.
- An automation with `--precheck` that fails records `skipped_precheck`, dispatches nothing, and
  keeps its schedule. A manual `automations run` skips the precheck.
- `worker-release` closes the terminal and keeps the worktree and branch; remove them after merge
  or abandonment.
- `ask` timing out leaves the question pending; the worker resumes it by message ID.
- `gate-resolve --resolution` takes free text; `gate-create --options` is optional.

## Smoke-tested on Orca 1.4.221

- The tick needs no Orca terminal. A launchd job with no `ORCA_*` environment and no `caller` in
  `orca status` ran `task-list --run`, `worker-start --run --task --worktree --agent`,
  `worker-list --run` and `worker-release --dispatch`, all exiting 0. Passing `--run` on every
  call is enough; the tick never runs `run-use`, so it never fences the owner's terminal.
- `worker-start` moves the Task to `dispatched`, so the next tick's `task-list` no longer shows
  it as `ready`. That status, not a request ID, is what stops a second tick from starting it twice.
- `--retry-request` only accepts the UUID Orca issued for an earlier request; a caller-chosen key
  is refused with `invalid_argument`.
- Release what `worker-list` names: a settled worker's `projection.nextAction.argv` is
  `worker-release --dispatch <id>`. Its `terminalState` can be `retained` rather than
  `reclaimable` (it was after `worker-stop`), so filtering on `reclaimable` misses it.
- `worker-stop` settles the Dispatch as `failed` and leaves the Task `blocked`.
- A `worker_done` without `--dispatch-id` is rejected and settles nothing; the Task stays
  `dispatched`. It still reaches the Run's inbox as a `worker_done` whose payload carries
  `_orcaLifecycleRejection` (`missing_dispatch_id`), so only an inbox reader sees why.
- `orca terminal send` to a supervised worker's terminal is refused with `agent_prompt_blocked`.
  Talk to a worker through the orchestration verbs.
- A `claude` worker started without permission settings stopped at a prompt for its own
  `orca orchestration send`. `worker-start` has no permission flag: the worker launches as the
  owner's new-agent-tab setting says.
- A scoped `.claude/settings.json` on the worktree's base branch is enough for an unattended
  `claude` worker. It allows `Read`, `Edit`, `Write`, `Bash(orca orchestration:*)` and
  `Bash(git status|diff|add|commit:*)`, and denies `Bash(git push:*)`. A Sonnet worker in a
  `new-top-level` worktree of the trial repo edited, committed and sent `worker_done` with no
  prompt. Its `git push --dry-run origin HEAD` was refused at once ("Permission to use Bash with
  command git push … has been denied"); git never ran and the remote was unchanged. A compound
  command containing the push was refused whole, so the worker split it and edited with `Write`.
  The deny matches the command prefix, so it stops an agent's ordinary push, not a determined one
  (`git -C . push` would not match).
- A settled `new-top-level` worker is releasable: `terminalState` `reclaimable`, `nextAction`
  `worker-release --dispatch <id>`, liveness still `live`. Releasing it left the worktree and its
  branch. Only a `--worktree current` worker reads `user_owned` with nothing to release.
- A valid `worker_done` settles the Task with no inbox reader. Nobody ran `check`; `task-list`
  showed the Task `completed` within ten seconds of the send, while the message sat in the Run
  mailbox unread, never delivered or acknowledged. Reading and acking it later changed no Task
  or Dispatch state. The tick reads Task state only; the inbox belongs to the owner.
- `run-create` binds the Run to the terminal it runs under, even from a child process with every
  `ORCA_*` variable removed: Orca identifies the caller by process, not environment. So the
  owner's terminal that runs `to-orca` is the Run's inbox reader. It ran `check` and `--ack`
  while `task-list`, `worker-list` and `worker-release` ran beside it, and was not fenced. Here
  those tick calls ran as children of the owner's terminal; the launchd test above ran them
  with no terminal at all.
- `worker-start --task … --retry-of <dispatch_id>` starts a fresh attempt on a Task left `blocked`
  by `worker-stop`.
- A worker that settled `succeeded` in `--worktree current` reads `resource.state: user_owned` with
  `nextAction` `none`, and its terminal stays live. `worker-list` names no release, so the tick
  leaves it.
- `worker_done --outcome failed` moves the Task straight to `failed` and leaves the Dispatch's
  `failure_count` at 0. Four such attempts in a row, chained with `--retry-of`, and a
  `worker-stop` among them, all left it at 0; each retry was accepted. A question costs nothing
  against Orca's limit, so there is nothing for a retry after an answer to reset.
- `failure_count` rises only when Orca itself sees the attempt end: the worker's terminal process
  exits without a report (`last_failure` "Agent process ended"), the terminal is closed, preamble
  injection fails, or (read from the bundle, not tested) an escalation arrives once the worker has
  settled. Killing only the agent process left the Dispatch `dispatched` and its liveness
  `unverifiable`; killing the pane's shell settled it `failed` with `failure_count` 1 and put the
  Task back to `ready`, not `failed`. Each such exit also put an `escalation` from Orca, "Agent
  exited unexpectedly", in the Run's inbox; reading and acking it later changed no count.
- The limit never trips through `worker-start`: each new Dispatch starts at 0, with or without
  `--retry-of`, so three crashes in a row gave three Dispatches at 1 and a `ready` Task. Only plain
  `dispatch` seeds a new Dispatch from the Task's highest count; two dispatches ended by closing
  the terminal went to 2, then 3, `circuit_broken`, Task `failed`. A circuit-broken Task cannot be
  retried: `worker-start --retry-of` refuses it with `task_not_startable`.
- `--retry-of` must name the latest settled Dispatch of a `failed` or `blocked` Task; a `ready`
  Task refuses it and starts with plain `worker-start --task`. A `failed` Task refuses plain
  `dispatch`, though `dispatch --dry-run` accepts it.
- `task-list`'s `result` for a reported Task carries the report's `outcome`, `subject`, `body` and
  `reportPath`; `worker-show` on an older Dispatch still returns its `lastFailure`, so a Task's
  attempts can be walked back through `retry_of_dispatch_id`.
- `worker-start --terminal` refuses a terminal Orca doesn't recognise as an agent
  (`agent_unconfigured`), even one running a process named `claude`.
- A Haiku worker given a vague spec improvised its own `worker_done` and stalled at a permission
  prompt for a command with a shell variable in it. A precise spec and the scoped settings
  avoided both.

## Smoke-tested on Orca 1.4.222

- A worker cannot open a gate on its own Task. Its `gate-create --task <own task> --from
  <handle>` failed with `run_required` ("No Run is bound"), and `gate-create` takes no `--run`
  (`invalid_argument`, unknown flag). Only `run-use` would bind it, and that fences the owner's
  inbox. The worker's `worker_done --outcome failed` still settled the attempt: Task `failed`,
  Dispatch `failed`, `failureCount` 0, `lastFailure` carrying the report's subject, body and
  `reportPath`, and `gate-list --status pending` empty.
- `gate-create` acts only on Tasks in the caller's bound Run: from a terminal bound to one Run, a
  Task in another Run is `task_not_found`. `gate-list --run` reads any Run.
- From the terminal bound to the Run, `gate-create` on a `failed` Task moves it to `blocked`, and
  `gate-list --run --status pending` lists the gate with its `task_id` and question.
- `gate-resolve` moves the Task to `ready`, whether it was `blocked` or `failed`. A `ready` Task
  refuses `worker-start --retry-of` (`task_not_startable`); plain `worker-start --task` starts the
  fresh attempt, with `retryOfDispatchId` null.
- A pending gate does not stop a retry: `worker-start --retry-of` on a `blocked` Task with a
  pending gate started an attempt. When that attempt reported `failed`, the Task went back to
  `failed` and the gate stayed pending. The gate, not the Task status, says a question is open.
- `worker-list --run` keeps released Dispatches with their `taskId` and `dispatchStatus`, so a
  Task's attempts can be counted from it.
- `run-list` and `run-show` carry no open or closed field: only `id`, `objective`,
  `coordinator_handle`, `consumer_generation` and timestamps. A Run is a namespace and an inbox,
  not something that opens and closes.
- A Sonnet `claude` worker in the trial repo, under the scoped settings, asked with the
  preamble's `ask --question … --timeout-ms 60000` and got no prompt. A timeout prints `ok: true`,
  `timedOut: true`, `answer: null` and the `messageId`, but **exits 1**. The worker committed
  more work, then `ask --resume <message_id>` at a checkpoint timed out the same way.
- Orca caps `--timeout-ms` at 1800000 (30 minutes). It silently lowered a requested 3600000 and
  reported the lower value in `timeoutMs`.
- A worker waits without polling by running `ask --resume <message_id>` as a background Bash
  command and ending its turn. Claude Code wakes it when the command exits. It sat idle 15 minutes
  with no turns, and resumed 11 seconds after the reply. The resume returned `answer`,
  `answerMessageId` and exit 0. A wait of hours costs one turn every 30 minutes to start the resume
  again.
- The coordinator saw the question with `check --peek` while the worker's `ask` was still
  blocking, and with a consuming `check`. Its payload carries `taskId`, `dispatchId` and the
  question text. Timeouts and resumes added no messages: one question is one inbox row however
  often it is resumed. `reply --id <message_id> --body` returned the question as `answered` and
  put a `status` message with `thread_id` set to the question's ID into the Dispatch's mailbox.
- No inbox row carries a question's state. An answered question is one that has a reply in its
  thread. A question whose asker is no longer live is closed.
- Replying to the question of an attempt that has ended (the worker asked, timed out, then sent
  `worker_done`) is refused with `dispatch_inactive` ("Question … is closed because its Dispatch is
  inactive"). Nothing is sent. Such an answer reaches the next attempt only as a message the coordinator sends it.
- One terminal coordinates one Run at a time. `run-create` rebinds the terminal to the new Run.
  After that, `check --peek --run <first run>` is `consumer_fenced`. `run-use --id <first run>`
  binds it back: `consumer_generation` went from 1 to 3, the second Run's `coordinator_handle`
  went to null, and the first Run's pending question was still there.
- `inbox` is read-only. It lists messages across every Run, with `run_id`, `type`, `read` and
  `payload`, and was never fenced. Both it and `check --peek --run` ran with the `ORCA_*`
  environment stripped, but as children of the bound terminal, so whether they work from launchd
  is untested.
- The report fits in `worker_done --body`. A Sonnet worker in the trial repo, under the scoped
  settings, sent a 12-line report through a quoted heredoc (`--body "$(cat <<'EOF' … EOF
  )"`) with no prompt. `task-list` returned it in `result.body` unchanged: backticks, quotes, `$`,
  a literal backslash, non-ASCII and blank lines intact. `result.reportPath` is null without
  `--report-path`. The worker's own copy turned a tab in the spec into spaces; Orca stored the
  tab in the spec and the body as sent.
- A retry gets its Task's earlier questions and answers through `send --to dispatch:<id>`. Three
  Sonnet `claude` attempts on one Task in the trial repo, under the scoped settings, each
  chained with `worker-start --retry-of` into the same worktree: the first asked, timed out and
  reported `failed`; the coordinator sent the second that Q1 had no answer yet and the third the answer blue,
  and the third wrote blue and reported `succeeded`.
- The message is never injected. Neither retry saw it in its context, and neither transcript
  had a user turn beyond the preamble. Each worker read it with its own consuming `check
  --terminal <handle>` as a `status` message (`to_handle` `dispatch:<id>`, `thread_id` null),
  then acked the delivery. A worker that never runs `check` never sees it.
- It arrives when sent before the worker's first turn. `worker-start` returns only once the
  agent's turn has started (`stage` `input_accepted`, `turnStart` `observed`), so the tick's send
  after it lands during the first turn. The Dispatch ID is in `worker-list --run` earlier, while
  the Dispatch is `pending` and its terminal still being created; a send then was accepted
  three seconds before `worker-start` returned and was in the worker's first `check`.
- A single `check` can miss a send that lands after it; `check --wait` doesn't. A worker whose
  first command was `check --terminal <handle> --wait --timeout-ms 100000 --json` blocked 30
  seconds with no prompt, until the coordinator's message arrived, then returned it. Its `check
  --ack <delivery_id>` acked that batch and returned the next message, sent two seconds later, as
  a new delivery; the ack after that returned none. A worker reads and acks until a check returns
  no `deliveryId`.
- `task-create --spec <text>` reads a spec that starts with `---` as a flag and refuses it
  (`invalid_argument`, "Unknown flag"). `--spec=<text>` is accepted, and `task-list` returns the
  spec unchanged, YAML frontmatter and line breaks included.
- `gate-create --question` returns the new gate under `result.gate`, with its `id`, `task_id`,
  `question` and `status` `pending`. `gate-list --status pending` returns `result.gates` with the
  same fields, `options` as a JSON string and `resolution` null. `gate-resolve` takes the gate as
  `--id`.

## Read, not smoke-tested, on Orca 1.4.221 and 1.4.222

- Task statuses are `pending, ready, dispatched, completed, failed, blocked`; `task-create --deps`
  takes a JSON array; `task-list --ready` lists what can start; `worker-start` refuses a Task with
  unmet dependencies (`task_not_startable`).
- `worker_done` takes `--report-path` alongside `--outcome`, and `--outcome` only `succeeded` or
  `failed`.
- The guide meant gates for coordinator-owned decisions on the Task DAG ("Do not create a gate
  merely to answer a worker's `ask`"); a worker uses `ask`. `gate-list` is scoped to one Run
  (`--run`).
- A pending ask and a reply have durable recovery identities.
- `--question` has no length limit and keeps line breaks. Orca stores it as the message body
  under the fixed subject `Question`; `check` prints a multi-line body line by line, `check
  --json` returns it unchanged, and `inbox` shows only the subject unless `--full`. `reply
  --body` has no length limit either.
- `inbox` reads the newest rows of every Run's messages with no check on the caller, so any
  terminal, a worker's included, can read every question and reply.
- `--timeout-ms` defaults to 600000.
- The coordinator consumes its Run's inbox with `check`, processes every row of the batch and acks
  it; `check --peek` reads without consuming.
- To cancel a Task: settle its worker with `worker-stop` or `worker-abandon`, then `task-update
  --status failed --result cancelled`. A cancelled Task is `failed`, so its dependants stay blocked.
- `gate-create` on a Task with a live Dispatch completes that Dispatch and revokes its capability
  (open issue stablyai/orca#13298), so a gate goes only on a Task with no live attempt.
- After an unknown result, a mutation is retried with the `--retry-request <uuid>` Orca reported,
  and `request-show` tells whether it took effect.
- Automations always launch an agent (`--prompt` and `--provider` are required), so a scheduled
  tick would be a script, not an automation.
- "Absence never authorizes stop, abandon, retry, or release": only proven exit or a finished
  transcript with no `worker_done` allows acting on a silent worker.
