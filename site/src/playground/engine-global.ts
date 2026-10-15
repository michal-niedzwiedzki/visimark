import type { VisiMarkApi } from "./types.js";

/**
 * `visimark`, as the playground bundle sees it (#360). codemirror-visimark
 * imports the engine by name; build-playground.ts resolves that name here,
 * and here is the engine the page already loaded as `window.VisiMark` — so
 * one copy of the engine is on the page, not two.
 *
 * **Every export is a function that reads the global when called, never at
 * import.** main.ts reports a missing engine (a `file://` visit, a failed
 * script) through the boot overlay; a module that touched `window.VisiMark`
 * on load would throw before main.ts could say anything.
 *
 * engine-global.test.ts fails when the extension starts importing a name
 * this file does not export.
 */
const vm = (): VisiMarkApi => window.VisiMark;

export const locate: VisiMarkApi["locate"] = (...args) => vm().locate(...args);
export const build: VisiMarkApi["build"] = (...args) => vm().build(...args);
export const check: VisiMarkApi["check"] = (...args) => vm().check(...args);
export const memoryReader: VisiMarkApi["memoryReader"] = (...args) => vm().memoryReader(...args);
export const topoOrder: VisiMarkApi["topoOrder"] = (...args) => vm().topoOrder(...args);
export const planFmt: VisiMarkApi["planFmt"] = (...args) => vm().planFmt(...args);
export const describeFinding: VisiMarkApi["describeFinding"] = (...args) =>
  vm().describeFinding(...args);
