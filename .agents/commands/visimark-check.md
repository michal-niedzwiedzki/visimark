---
description: Verify every vmark formula in the Markdown files this session touched, and report any number that no longer matches its formula.
---

Run `visimark check` over every Markdown file changed in this session (or,
with no changes yet, over every `.md` file in the workspace). Use `npx -y
visimark check <files...>` if the project has no `visimark` dependency of
its own, or the project's own installed CLI (`bunx visimark check ...` /
`npx visimark check ...`) if it does.

Report the output verbatim. If it reports `STALE` values, `UNDEF` names, a
`CYCLE`, or a `DATE` error, do not consider the task finished — fix the
formula or the number so they agree again (or ask which one is wrong when
it's ambiguous), then re-run `visimark check` to confirm it's clean before
finishing.

Reference: https://github.com/michal-niedzwiedzki/visimark
