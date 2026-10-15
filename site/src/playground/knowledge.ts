/** The KNOWLEDGE action bar: copy the JSON, or hand it to an AI agent. */

import type { Pipeline } from "./pipeline.js";
import type { ShowAgentPopover } from "./agents.js";
import { byId } from "./dom.js";
import { wireCopyButton } from "./clipboard.js";

export function createKnowledgePanel(
  pipeline: Pipeline,
  flash: (text: string) => void,
  showAgentPopover: ShowAgentPopover,
): void {
  const bodyEl = byId("knowledge-body");
  const hostEl = byId("knowledge-agent-host");

  wireCopyButton(
    byId("knowledge-copy-btn"),
    flash,
    bodyEl,
    "Couldn't reach the clipboard — select and copy the JSON by hand.",
  );

  const prompt = (): string =>
    "I used VisiMark to extract those figures from a Markdown document. " +
    "Can you guess what it is without looking?\n" +
    pipeline.knowledgeText();

  byId("knowledge-agent-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    showAgentPopover(hostEl, prompt, flash);
  });
}
