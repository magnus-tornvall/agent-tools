# agent-tools

Skills for agents working in Orca, plus the shape schema: the contract for what any producer
hands to the skill that turns a shape into an Orca Run.

## The shape

A shape is one YAML document: the outcome, requirements keyed `R1…`, non-goals keyed
`N1…`, approach, constraints, touchpoints, and decisions keyed `D1…`. The Zod schema in
`src/shape/shape.ts` is the one definition; `src/shape/fixtures/example.yaml` is a
filled-in example.

Any producer whose shape passes `shape-check` is a valid producer. mvc is one producer,
not the contract.

```
$ bun src/shape/shape-check.ts <file>
```

It prints nothing and exits 0 on a shape, otherwise one `path: message` line per
violation and exits 1. Keys the schema does not define are violations.

`src/shape/shape.schema.json` is generated from the Zod schema for editors and for
anything not written in TypeScript. After changing the schema, run `bun run shape-schema`;
a test fails while the committed file is stale.

## Skills that run scripts

A skill shared through Orca must work without this repository, so each skill carries the
scripts and assets it runs in its own `scripts/` and `assets/`, built from `src/`:
`skills/mvc` gets `shape-check.js` and the filled-in example. They run with `bun`. After
changing anything they are built from, run `bun run build-skills`; a test fails while a
skill's copy is stale.

## Requirements

`bun`, plus `orca` on `PATH` for the skills that drive Orca.

```sh
npm install
bun test
npm run typecheck
```

## Layout

```
src/shape/shape.ts          the shape schema and parseShape
src/shape/shape-check.ts    checking a file against the shape schema
src/shape/shape.schema.json the JSON Schema generated from it
src/shape/shape.test.ts     tests, with the filled-in example in src/shape/fixtures
src/build-skills.ts         building each skill's scripts/ and assets/ from src/
skills/                     orca-worker, which workers follow, plus the commit and mvc skills,
                            with built files in skills/mvc
docs/                       known Orca behaviour, research
```
