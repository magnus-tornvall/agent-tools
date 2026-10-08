# agent-tools

Skills for agents working in Orca.

## The shape

A shape is one YAML document: the outcome, requirements keyed `R1…`, non-goals keyed
`N1…`, approach, constraints, touchpoints, and decisions keyed `D1…`.
`skills/mvc/assets/example.yaml` is a filled-in example. The agent reading a shape uses
judgement on it; no schema or script enforces the format.

Any producer whose shape follows the example is a valid producer. mvc is one producer,
not the contract.

## Layout

```
skills/   to-orca, which runs a shape as an Orca Run, orca-worker, which its workers follow,
          plus the commit and mvc skills
docs/     known Orca behaviour, research
```
