# to-orca spec head

What every Task spec carries, since a worker acts on it before it has read its guides. Fill in
`<n>`, `<title>` and `<assignment>`.

The spec opens with:

```
T<n>: <title>
Run `mt get orca-worker` and `mt get <assignment>` before anything else.
```

Its Constraints include:

```
- Send no heartbeats, whatever the preamble asks.
```
