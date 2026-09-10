# Test-suite sharding — a build tool reads this, not a person

CI needs to split the test suite across parallel runners so the slowest shard
finishes as close to the others as possible. Most teams keep that split in a
YAML matrix nobody remembers to update, so it drifts from the suite's actual
shape until one runner takes eleven minutes and the rest take two. This
document is the sharding policy, and it is also the thing CI reads to build
the matrix — there is no second file to forget.

## Measured suite time

Timings below are the median of the last 20 runs on `main`, updated by a
scheduled job that edits this table and nothing else.

| Suite        | Seconds |
|--------------|--------:|
| unit         |      42 |
| integration  |     311 |
| e2e-checkout |     498 |
| e2e-search   |     266 |
| e2e-admin    |     189 |
| contract     |      97 |

```vmark #suite
runners = 4

total_seconds  = SUM(Seconds)
avg_per_runner = total_seconds / runners
worst_case     = MAX(Seconds)

assert worst_case <= avg_per_runner * 2
```

Six suites total **1403**<!--vmark=suite.total_seconds--> seconds of
sequential test time. Split across **4**<!--vmark=suite.runners--> runners
that would be **350.75**<!--vmark=suite.avg_per_runner--> seconds each if the
split were perfect; no single suite may cost more than double that, which
`e2e-checkout` at 498 seconds still satisfies.

## The matrix CI actually consumes

CI does not read the table above — it cannot do bin-packing over Markdown
prose. It runs `visimark eval` and gets numbers a script can act on:

```console
$ visimark eval docs/example-ci-sharding.md --get suite.total_seconds
1403

$ visimark eval docs/example-ci-sharding.md --get suite.worst_case
498
```

A packaging script (outside VisiMark's scope — it consumes these numbers, it
does not produce them) greedily assigns each suite to the currently-lightest
runner and emits the matrix. The runner totals still live as a table column,
not four scalar additions, because `MAX` and `MIN` are reduces: they take one
column, never a list of expressions, so the audit trail stays a column a
reader can see rather than an inline sum hidden inside a function call.

| Runner | Assigned suites            | Seconds |
|--------|-----------------------------|--------:|
| 1      | e2e-admin, contract         |     286 |
| 2      | e2e-checkout                |     498 |
| 3      | integration, unit           |     353 |
| 4      | e2e-search                  |     266 |

```vmark #matrix
max_runner = MAX(Seconds)
min_runner = MIN(Seconds)
spread     = max_runner - min_runner

assert spread <= suite.avg_per_runner
```

The slowest runner finishes in **498**<!--vmark=matrix.max_runner--> seconds
against a fastest of **266**<!--vmark=matrix.min_runner--> — a spread of
**232**<!--vmark=matrix.spread--> seconds, inside the one-average tolerance
this policy sets for itself.

## Why a build tool reads a Markdown file

The alternative is the usual one: a `ci-matrix.yml` maintained by hand, next
to a `TIMINGS.md` nobody wires back into it. They agree on day one and
diverge on day forty, silently, because nothing checks them against each
other.

Here there is one artifact. `visimark check` fails the moment `e2e-checkout`
grows past the point where `worst_case <= avg_per_runner * 2` still holds —
before the matrix is regenerated, not after a runner starts timing out. The
matrix table is still hand-maintained (VisiMark has no bin-packing primitive
and should not grow one — see the vocabulary catalogue's stance on scope), but
it is now a **checked** hand-maintained table: `spread` is asserted, not
eyeballed, and `visimark eval --json` is the one interface both a human
reading the PR and the CI job configuring `strategy.matrix` read from.
