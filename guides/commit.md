# commit

Domain: Change. Turn the changes in a working tree into commits a reader can trust: each one a
single change they can explain, with a message that says what changed and why, pushed only where
the session allows a push. It supplements the built-in commit behaviour, whose safety
defaults stay: no destructive operations, no skipped hooks. This guide owns what is staged, the
message format and whether to push. It takes a working tree, the session's instructions and
requests, and the pushes they ask for; it returns commits on the current branch, pushed or not, and
a report. It reads no config.

## Principles

- **Atomic commits**, from minimal change. A commit holds one logical change, whole: the code, its
  tests and the config it needs go together, unrelated concerns go apart. Each can then be
  reviewed, reverted or bisected on its own.
- **Commit only what you can explain.** The tree may hold work that is not yours. What is staged
  is chosen file by file, and what cannot be accounted for is named, never swept in.
- **The history is evidence.** A later reader, or `git bisect`, trusts a message for what changed
  and why; the diff already shows which lines did.
- **Reversibility.** A commit is a two-way door until it leaves the machine. A push is an external
  effect: once fetched it cannot be recalled (`mt get door-rule`). So a push is made only on the
  owner's word given in the session, never by default and never on a standing instruction.

## Objectives

- **Nothing is committed over an unfinished state.** A rebase in progress or unmerged paths are
  reported with the files they hold, and nothing is committed; a clean tree is reported as nothing
  to commit.
- **A commit on the repo's default branch, or on a branch the owner's instructions protect, is the
  owner's choice**, asked before it is made unless the instructions or the request already settle
  it: commit there, or branch out. A request for a pull request settles it as a new branch, since a
  pull request needs a head other than its base. The default branch is the one `origin` names as
  its HEAD on the remote, not the local `origin/HEAD` ref, so it is unknown only when `origin`
  cannot be reached or names no HEAD. While it is unknown, a commit on a branch that could be the
  default is the owner's choice too.
- **Every untracked file is a decision**: committed, ignored or left alone. Ignoring one is its own
  concern, so its own commit. Anything that reads as a credential (`.env`, `*.pem`, `*.key`,
  `credentials*`), a build artifact or scratch output is reported, not staged.
- **Staging is by explicit path**, never all of the tree, `.` or by hunk. A file carrying two
  concerns is committed once with an honest message, or its split is handed to the owner: hunks
  picked by an agent are unverifiable.
- **What is staged is what you meant**: the unit you intended, with no conflict markers, debug
  logging or focused tests in it.
- **A rejected commit is retried, not bypassed.** When a hook rejects it, no commit was created.
  What a hook rewrote is re-staged by path and committed with the same message; what a hook
  reports is fixed at its cause. `--no-verify` is never used.
- **A commit is amended only when the owner asks and it is unpushed.** Otherwise a correction is a
  new commit.

## Message

The format is owned here: [Conventional Commits](https://www.conventionalcommits.org/).

    <type>(<scope>): <subject>

    - <why, and what it ruled out>

    BREAKING CHANGE: <what breaks, and the migration>

- **Type**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf` or `ci`.
- **Scope**: the subsystem touched, matching the scopes in the repo's `git log`; left out only
  when the change spans everything.
- **Subject**: imperative mood, lowercase, no trailing period, at most 72 characters. It says what
  changed, never with a vague verb (`update`, `change`, `modify`, `improve`).
- **Body**: a blank line, then `- ` bullets wrapped at 72 columns, saying why and what the change
  ruled out. A body that names the files or restates the subject wastes a line, and `various
  improvements` or `misc fixes` says nothing. Anything beyond a simple fix, rename or config tweak
  has one.
- **Breaking change**: `!` after the type or scope, and a `BREAKING CHANGE:` footer saying what
  breaks and how to migrate; the `!` alone withholds the part that matters.

Good: `feat(auth): add token-refresh endpoint`. Bad: `add endpoint` (no type), `fix: Fixed the
bug.` (past tense, capitalized, period).

The message reaches git on stdin (`git commit -F -`) from a heredoc with a quoted delimiter, which
keeps `"`, `'`, `` ` `` and `$(…)` literal; a message committed more than once may come from a file
instead. Never `-m` with a command substitution. Workaround for bash 3.2, still `/bin/bash` on
macOS, misreading a heredoc inside `"$(…)"`, so that one `"` in the message ends the command with
``unexpected EOF while looking for matching `)'``; remove when no agent runs commands in bash 3.2.

## Push

Push authority comes from the session.

- **In an interactive session a push is the owner's word, given in that session**: a request to
  push, or a pull request chosen as the work's destination. A standing instruction grants none,
  however it is worded, so a branch no request in the session covers stays unpushed and the report
  says no push was asked for. A standing instruction or a request that forbids a push still holds.
- **A request to push covers that branch for the rest of the session.** Each later push to it that
  only adds to what is pushed is made without asking again. It covers no other branch and no later
  session.
- **A pull request chosen in the session as the destination covers its head branch from when it is
  chosen, before it is opened, until it is merged or closed.** The head is pushed to the branch of
  the same name on the remote the pull request's head lives on, with an upstream set when it has
  none. A new pull request's head goes to the remote the request names; when it names none and the
  repo has more than one remote, the owner is asked which. Each later push to it that only adds to
  what is pushed is made without asking. Once the pull request is merged or closed, only a request
  to push covers the branch. It never covers the base branch or another person's pull request
  branch: a pull request someone else opened is not this change's, so pushing to its head needs a
  request to push.
- **The default branch, or a branch the owner's instructions protect, is pushed only by a request
  for that push.** Neither a pull request nor an earlier request to push covers it beyond the push
  asked for; each push there needs its own request. While the default branch is unknown, a request
  to push covers only the push it asks for; a pull request still covers its head branch.
- **A dispatched Task pushes only as its spec and the platform's reference say**, whatever these
  rules would allow in a session.
- **A rejected push is reported, not forced.** A non-fast-forward rejection means the upstream
  moved. `--force` and `--force-with-lease` are used only when the owner asks for them by name.

## Report

Each commit's hash and subject, verbatim from `git log --oneline`, with its branch; whether each
branch was pushed, naming any left unpushed and why; and every file reported rather than staged,
with why.
