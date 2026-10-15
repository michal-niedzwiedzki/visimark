// The two libraries docs/playground.html loads from a CDN, typed only as
// far as this application actually uses them. CodeMirror used to be the third;
// since #360 it is bundled (see ./editor.ts) and has real types.
//
// They are deliberately *not* dependencies: the page loads them as plain
// `<script src>` tags with SRI hashes, so they arrive as globals rather than
// as modules, and pulling their real `@types` packages in would add two
// devDependencies whose only consumer is a page that never imports them. A
// hand-written surface is smaller, and — unlike `any` — it still fails the
// typecheck when a call site drifts from the API.

declare const marked: { parse(markdown: string): string };

declare const confetti: ((options: Record<string, unknown>) => void) | undefined;
