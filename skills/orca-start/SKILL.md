---
name: orca-start
description: Start an Orca Run for one item from its shape - propose the Tasks and their dependencies, get the owner's approval, and hand the shape and the approved DAG unchanged to orca-start's script. Takes a shape from any producer that conforms to the shape schema.
disable-model-invocation: true
compatibility: Requires Bun
---

# orca-start

Turn one item's shape into an Orca Run: check the shape, propose the DAG, and once the owner
approves it, hand the shape and that DAG unchanged to `scripts/start.js`, which creates the Run
and its Tasks. Nothing is dispatched here; that is orca-tick's job. Run every script with `bun`
from this skill's root. Never run `orca` yourself.

First run `bun scripts/start.js help`: it names the arguments and the DAG's format.

## The shape

A YAML file conforming to the shape schema. Take its path from the argument. Without one, use the
shape file path the conversation names, and say which. When it names none, or more than one, ask
for the path. Assume nothing about what produced it.

Check it before proposing anything:

```bash
bun scripts/shape-check.js <shape.yaml>
```

It prints nothing and exits 0 on a shape. Otherwise each stderr line is `path: message`: show
them, propose nothing, and stop.

## The DAG

- **One Task per item by default.** Split only into parts that are independent and can run in
  parallel. A chain costs the owner a landing per link: a Task starts only once every Task it
  comes after has merged into main.
- **owns** - each requirement belongs to exactly one Task.
- **bears** - every non-goal and decision whose subject touches the Task's requirements or
  touchpoints. Include it when unsure: the Task's slice is all of the shape its worker sees.
- **after** - only the S IDs whose merged code the Task needs.

Show the DAG exactly as the script will receive it, and for a split, one line saying why the parts
are independent. The owner's reply in this conversation is the approval; nothing reaches Orca
before it. A changed DAG is a new proposal and needs approval again.

## Starting the Run

The script binds the terminal that runs it to the Run as its coordinator, so the owner starts this
skill in the terminal that will run orca-tick.

Write the approved DAG to a file in the system temp directory, then run the script with the shape
and that file.

- **Success** - stdout is JSON: `run`, `tasks` (each S ID's Task ID) and `surpriseCheck`. Report
  all three and point the owner to orca-tick.
- **Refused** - stderr starts `Refused; nothing was created in Orca.`, one problem per line after
  it. Revise the DAG and propose it again.
- **Stopped** - stderr starts `Stopped. Run <id> has ...`. Show the message verbatim. A call whose
  result is unknown may have created a Task the message cannot name, so the old Run is cancelled
  from its full Task list, never from the message. Offer, but never run, the commands for the
  owner: list the Run's Tasks, then cancel each one not already cancelled.

  ```bash
  orca orchestration task-list --run <run> --json
  orca orchestration task-update --run <run> --id <task> --status failed --result cancelled
  ```

  Once the owner has cancelled every Task, run the script again with the same approved DAG; it
  creates a new Run.
