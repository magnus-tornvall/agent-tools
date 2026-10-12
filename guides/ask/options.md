# options

Domain: Decision. A closed set of answers for a decision whose every possible answer can be listed:
which of named branches, environments or channels, whether a gate opens. The person asked answers
with a pick, and can see the list is whole. It rests on a closed question whose options are
mutually exclusive and collectively exhaustive. It reads no config.

- **Every answer the set holds is an option.** A set the question tool cannot hold is not closed,
  or is two questions.
- **The stance is a ranking.** The recommended option comes first, with the reasoning for it;
  the rest follow in order.
- **Each option says what choosing it does**, citing what makes it live.
- **The free answer stays open.** An answer outside the options is still the answer.

In the question tool, each option is one option with what choosing it does as its description,
the recommended one first and marked so. Stance, Wrong if and any Risk or One-way door line go in
the text just before the tool. Workaround for question tools lacking a field for a position; remove
when the asker's question tool carries one.

## Example

```
Q2. The nightly export reaches finance by SFTP (`reports/OrderExport.php:30`) and by the
reporting API (`reports/OrderExport.php:44`). Which of them carries cancel_reason?

1. Both (recommended) - finance gets the reason whichever feed it reads; both formats gain a
   column.
2. SFTP only - the file finance imports gains the column; API clients see no change.
3. API only - the file keeps its columns; finance's import never sees the reason.

Stance: Both. Finance imports the file (`docs/finance.md:12`), and the API serves the same rows
from the same query (`reports/OrderExport.php:40`), so leaving one out splits one report in two.
Wrong if: an API client rejects a field it does not know.
Rules out: leaving either feed's format unchanged.
One-way door: consumers - finance's import reads the file's columns by position
(`docs/finance.md:14`).
```
