#!/usr/bin/env node
// Executed as an argument by the `sh` launcher beside it (`node
// bin/visimark-mcp.js`), never as the `bin` target — see
// .agents/rules/runtime-parity.md.
import { runServer } from "../dist/main.js";

runServer(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err?.stack ?? String(err));
    process.exit(2);
  },
);
