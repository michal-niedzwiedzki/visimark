// The supported library surface: run the server, and read the two versions
// every envelope reports. Everything else — the write gate's mechanics, the
// tool tables, the envelope helpers, `createServer` — is internal and changes
// without notice. `createServer` stays off this list because its signature
// names the MCP SDK's `Server` and `Transport`, and the SDK is bundled into
// `dist/`, not installed beside it. Tests import from the modules themselves.
export { runServer } from "./main.js";
export { engineVersion, serverVersion } from "./version.js";
