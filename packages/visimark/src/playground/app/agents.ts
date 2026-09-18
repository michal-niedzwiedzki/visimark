/**
 * The "feed to an AI agent" popover.
 *
 * Each agent's chat UI is a moving target and none of these publish a stable
 * prefill contract, so the `q` query param is a best effort, not a promise:
 * the click handler copies the prompt first regardless, and the status line
 * says so either way.
 *
 * The popover is a single DOM node shared by every trigger (KNOWLEDGE's own
 * button, and an "agent"-kind reward). Opening it reparents it under whichever
 * host triggered it and remembers that trigger's prompt/status-flasher pair,
 * so the option list itself stays written once.
 */

import { byId } from "./dom.js";
import { copyText } from "./clipboard.js";

const AI_AGENTS: Record<string, { label: string; url: string }> = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/?q=" },
  claude: { label: "Claude", url: "https://claude.ai/new?q=" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app?q=" },
  grok: { label: "Grok", url: "https://grok.com/?q=" },
  perplexity: { label: "Perplexity", url: "https://www.perplexity.ai/search?q=" },
};

export type ShowAgentPopover = (
  host: HTMLElement,
  promptFn: () => string,
  flash: (text: string) => void,
) => void;

export function createAgentPopover(fallbackFlash: (text: string) => void): ShowAgentPopover {
  const popoverEl = byId("agent-popover");
  let activePromptFn: (() => string) | null = null;
  let activeFlash: ((text: string) => void) | null = null;

  function close(): void {
    popoverEl.hidden = true;
    activePromptFn = null;
    activeFlash = null;
  }

  popoverEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>(".agent-option");
    if (!btn?.dataset.agent) return;
    const agent = AI_AGENTS[btn.dataset.agent];
    const promptFn = activePromptFn;
    const flash = activeFlash ?? fallbackFlash;
    close();
    if (!agent || !promptFn) return;
    const prompt = promptFn();
    copyText(prompt).then(
      () => flash(`Prompt copied — paste it if ${agent.label} opens empty.`),
      () =>
        flash(
          `Opening ${agent.label} — paste the prompt yourself, the clipboard didn't cooperate.`,
        ),
    );
    window.open(agent.url + encodeURIComponent(prompt), "_blank", "noopener");
  });

  document.addEventListener("click", (e) => {
    if (!popoverEl.hidden && !(e.target as HTMLElement | null)?.closest(".agent-popover-host")) {
      close();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return (host, promptFn, flash) => {
    if (!popoverEl.hidden && popoverEl.parentElement === host) {
      close();
      return;
    }
    if (popoverEl.parentElement !== host) host.appendChild(popoverEl);
    activePromptFn = promptFn;
    activeFlash = flash;
    popoverEl.hidden = false;
  };
}
