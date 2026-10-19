import { GlobalRegistrator } from "@happy-dom/global-registrator";

// `bun test` runs from this directory (the root `test` script runs each
// workspace from its own), so this is the only DOM these tests get. Guarded
// in case a preload ever runs twice in one process.
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register();
}
