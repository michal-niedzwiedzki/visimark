/**
 * docs/mcp-server.html — TOC wiring and navigation.
 *
 * The page itself is pre-rendered at build time by gen-docs.ts, so this
 * script only handles interactivity: the TOC dialog and link navigation.
 */

import { createToc, scrollToHash } from "./toc.js";

createToc();
scrollToHash();
