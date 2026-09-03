#!/usr/bin/env node
import { runCli } from "../dist/cli/main.js";

runCli(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err?.stack ?? String(err));
    process.exit(2);
  },
);
