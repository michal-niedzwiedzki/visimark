import { GlobalRegistrator } from "@happy-dom/global-registrator";

// The root bunfig.toml's preload registers happy-dom for a run from the repo
// root; this one covers `bun test` run from this directory. Guarded the same
// way, since both can load in one process.
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register();
}
