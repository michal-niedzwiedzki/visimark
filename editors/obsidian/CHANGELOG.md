# Changelog

The plugin's version is its own. It is not the version of the `visimark` npm
packages and does not move with them: an Obsidian release goes through a human
registry review, and coupling an engine patch to that latency would either
stall the engine or ship plugin versions nobody changed
([`obsidian-plugin-spec.md`](../../docs/design/obsidian-plugin-spec.md) §2.2).
Each entry says which engine version the bundle carries.

## Unreleased

- The audience-B finding vocabulary (`src/findings.ts`) — one translation of
  the engine's seventeen-code taxonomy into sentences, so that the findings
  view, the popover, the sweep and the status bar cannot come to say different
  things. No red, no codes, no "1 problem". No surface uses it yet.

- The vault-backed reader (`src/snapshot.ts`) — what lets a note's declared
  CSV imports and generated chart artifacts resolve out of an Obsidian vault,
  whose API is asynchronous, through a `ReaderPort` that is synchronous. No
  surface uses it yet; the rows that call `check` will.

## 0.1.0 - 2026-09-23

First build. Not published to the community registry — see the README for
side-loading, and `docs/design/obsidian-plugin-spec.md` §2.2 for why the
registry waits until v1 is complete.

- The plugin builds as a single `main.js` with **no `node:` specifier in it**,
  so it loads on Obsidian mobile as well as desktop.
- Activation is opt-in per note: nothing appears anywhere unless the active
  note contains a ```` ```vmark ```` block. A vault of ordinary notes is
  indistinguishable from one without the plugin installed.
- The only surface is a status bar item reading `VisiMark` while the gate is
  open. Decorations, the popover, the commands, the findings view and the
  ribbon are each their own v1 row and are not here.

Bundles engine 0.1.7.
