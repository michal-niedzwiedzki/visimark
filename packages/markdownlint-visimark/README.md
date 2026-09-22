# markdownlint-rule-visimark

[`markdownlint`](https://github.com/DavidAnson/markdownlint) custom rules that
run [`visimark check`](https://github.com/michal-niedzwiedzki/visimark) over a
document and report its findings alongside every other rule your project
already runs — a wrong total fails the same lint run `MD013` does.

## Install

```sh
npm install --save-dev markdownlint-rule-visimark
```

## Use

`.markdownlint-cli2.jsonc`:

```jsonc
{
  "config": {
    "extends": "markdownlint-rule-visimark/recommended",
    "default": true
  },
  "customRules": ["markdownlint-rule-visimark"]
}
```

`extends` goes **inside** `config`. It is a `markdownlint` config property, not
a `markdownlint-cli2` one, and at the top level it is silently ignored.

```console
$ npx markdownlint-cli2 "docs/**/*.md"
docs/quote.md:7 error visimark-assert An `assert` statement evaluated false [assert spent <= budget: 5 <= 1 is false]

Summary: 1 issue in 1 file
$ echo $?
1
```

## The rules

One rule per VisiMark finding kind, named after it: `visimark-stale`,
`visimark-date`, `visimark-unit`, `visimark-undef`, `visimark-dup`,
`visimark-vector`, `visimark-cycle`, `visimark-type`, `visimark-sheet`,
`visimark-anchor`, `visimark-assert`, `visimark-precision`,
`visimark-artifact`, `visimark-import`, `visimark-warn`, `visimark-note`,
`visimark-coverage`. They are the same identifiers
[`remark-lint-visimark`](https://www.npmjs.com/package/remark-lint-visimark)
reports as its `ruleId`.

Three levers, all `markdownlint`'s own:

| `config` entry | Effect |
|---|---|
| `"visimark-date": false` | one finding kind off |
| `"visimark-advisory": false` | the advisory kinds (`WARN`, `NOTE`) off |
| `"visimark": false` | every VisiMark rule off |

## `recommended`

`markdownlint` has no non-fatal tier: every violation fails the run. VisiMark's
advisory findings do not fail `visimark check`, so reporting them here would
fail a lint run on a document `check` passes. `recommended` is one line —
`{ "visimark-advisory": false }` — and extending it gives you a run whose exit
code agrees with `check`'s. Without it you get everything, which is also a
reasonable choice; nothing is hidden from you either way.

The reported count still differs from `check`'s footer: stale prose anchors are
folded into one summary finding that this package does not report separately,
and `recommended` switches the advisory kinds off. The **exit codes agree in
every case** — only the headline number differs.

## Contract

No options, no autofix (`markdownlint-cli2 --fix` leaves these rules alone),
and a line number but no column highlight. Only `check` ever runs: `fmt`,
`infer`, `explain`, `eval` and `--json` are not reachable through this package.
See [`docs/ci.md`](https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/ci.md)
in the main repository for the full write-up.
