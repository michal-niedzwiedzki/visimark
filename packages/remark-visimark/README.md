# remark-lint-visimark

A [`unified`](https://unifiedjs.com)/[`remark`](https://remark.js.org) plugin
that runs [`visimark check`](https://github.com/michal-niedzwiedzki/visimark)
over a document already in your `remark`/`remark-lint` pipeline and reports
its findings as `VFile` messages — the same channel `remark-lint` rules
already use.

## Install

```sh
npm install --save-dev remark-lint-visimark
```

## Use

`.remarkrc.json`:

```json
{ "plugins": ["remark-preset-lint-recommended", "remark-lint-visimark"] }
```

or programmatically:

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkLintVisimark from "remark-lint-visimark";

const file = await unified()
  .use(remarkParse)
  .use(remarkStringify)
  .use(remarkLintVisimark)
  .process(vfile);
```

(`remark-stringify` is only there because `unified().process()` requires a
compiler to be registered; this plugin never uses the compiled output. A
pipeline already built on the `remark` package, or on `remark-cli`, already
has a compiler and needs no change.)

Every VisiMark finding with a source location becomes a `file.message()`
call: `fatal: true` for a stale number or any other check-failing finding,
`fatal` left unset (a warning, visible under `remark --frail`) for advice.
`ruleId` is per finding kind (`visimark-stale`, `visimark-assert`, …),
`source` is `"visimark"`.

This plugin takes no options and performs no autofix — see
[`docs/ci.md`](https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/ci.md)
in the main repository for the full write-up.
