# Security policy

## Supported versions

VisiMark is pre-1.0. Only the latest release published to npm, the VS Code
Marketplace, and Open VSX receives security fixes. Older versions do not.

## Reporting a vulnerability

Report privately through GitHub's
[private vulnerability reporting](https://github.com/michal-niedzwiedzki/visimark/security/advisories/new)
— do not open a public issue for a suspected vulnerability.

If that is unavailable, email <michal@epsi.pl> with `VisiMark security` in the
subject.

Please include what you were doing, what happened, and a Markdown document or
command that reproduces it. Expect an acknowledgement within a week. Once a fix
is released the advisory is published with credit unless you ask otherwise.

## Scope

VisiMark reads Markdown files and evaluates the formulas written in their
`vmark` blocks. A document that causes `visimark` to execute code outside that
evaluator, read or write files it was not asked to, or hang the process on
input of a reasonable size is in scope. A formula that merely produces a wrong
number is a correctness bug — open a normal issue.
