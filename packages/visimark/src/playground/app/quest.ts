/**
 * The SCENARIO panel: what to look at per file, and the "Try this" checklist
 * that turns that guidance into something to actually do.
 *
 * Each step is detected for real — a tab click, an Infer/Build run, a genuine
 * change in what `eval` reports, or a substring appearing in the document —
 * not marked done on a timer. The step *schema* is documented on RawStep in
 * ./types.ts and the detection vocabulary in ./checks.ts; this module is the
 * engine that runs them.
 *
 * A step is never completed by clicking it — only "manual" steps can be, since
 * nothing else can complete them — but any completed step can be clicked to
 * reset it, so a visitor can repeat the action and watch it get detected again
 * rather than being stuck with it checked off forever.
 */

import type { EvalContext, RawStep, Scenarios, Step } from "./types.js";
import type { BadgeBoard } from "./badges.js";
import { byId, hideInstant, makeStatusFlasher, revealFadeIn } from "./dom.js";
import { CHECKS, PARAMETRIC_CHECKS } from "./checks.js";
import { copyText } from "./clipboard.js";

/** Turns one JSON step descriptor into the internal step shape the engine
 *  runs on. Throws on anything scenarios.json is not allowed to say. */
export function normalizeStep(raw: RawStep, index: number): Step {
  switch (raw.kind) {
    case "tab": {
      const tabAction = `tab:${raw.group}:${raw.tab}`;
      return { id: raw.id ?? tabAction, text: raw.text, action: tabAction };
    }
    case "action":
      return { id: raw.id ?? raw.action, text: raw.text, action: raw.action };
    case "eval": {
      const plain = CHECKS[raw.check];
      if (plain) return { id: raw.id ?? `eval:${index}`, text: raw.text, evalCheck: plain };
      const parametric = PARAMETRIC_CHECKS[raw.check];
      if (!parametric) throw new Error(`scenarios.json: unknown check "${raw.check}"`);
      const column = raw.column;
      if (column === undefined) {
        throw new Error(`scenarios.json: check "${raw.check}" needs a "column"`);
      }
      return {
        id: raw.id ?? `eval:${index}`,
        text: raw.text,
        evalCheck: (ctx) => parametric(ctx, column),
      };
    }
    case "text":
      return { id: raw.id ?? `text:${index}`, text: raw.text, textContains: raw.contains };
    case "manual":
      return { id: raw.id ?? `manual:${index}`, text: raw.text, manual: true };
    default: {
      const unknown = raw as { kind: string };
      throw new Error(`scenarios.json: unknown step kind "${unknown.kind}"`);
    }
  }
}

export function normalizeQuest(quest: RawStep[] | undefined): Step[] {
  return (quest ?? []).map(normalizeStep);
}

/**
 * Roughly how long the confetti "stars" burst takes to settle — three shoots
 * at 0/100/200ms, each 40+10 particles with ticks:50 decaying at 0.94, fully
 * faded by about 1.4s after the first shoot.
 */
const CONFETTI_SETTLE_MS = 1400;

export interface QuestDeps {
  scenarios: Scenarios;
  badges: BadgeBoard;
  /** Mirrors `visimark check FILE`'s STALE findings for the current document. */
  hasStale(source: string): boolean;
  /** The current editor buffer, for the "copy this document" reward. */
  documentText(): string;
  /** Opens the shared AI-agent popover under `host`. */
  showAgentPopover(host: HTMLElement, promptFn: () => string, flash: (text: string) => void): void;
  /** The KNOWLEDGE panel's current JSON, substituted into an agent reward. */
  knowledgeText(): string;
}

export interface Quest {
  /** Renders the scenario for `name` and restarts its quest. */
  render(name: string): void;
  /** UI-event steps: tab clicks, Infer/Build runs. */
  signal(action: string): void;
  /** Eval-driven steps, re-checked on every fresh pgEval result. */
  checkEval(evalResult: Record<string, unknown>, source: string): void;
}

export function createQuest(deps: QuestDeps): Quest {
  const panelEl = byId("scenario-panel");
  const bodyEl = byId("scenario-body");
  const listEl = byId("quest-list");
  const completeEl = byId("quest-complete");
  const rewardBoxEl = byId("reward-box");
  const rewardCtaEl = byId("reward-cta");
  const rewardCtaHostEl = byId("reward-cta-host");
  const flashRewardStatus = makeStatusFlasher(byId("reward-status"));

  let state = emptyState();
  let revealTimers: ReturnType<typeof setTimeout>[] = [];
  let currentReward: Scenarios[string]["reward"] | null = null;

  function emptyState() {
    return {
      name: "",
      steps: [] as Step[],
      done: {} as Record<string, boolean>,
      baselineEvalJson: null as string | null,
      baselineHasStale: false,
      baselineSource: null as string | null,
    };
  }

  function clearRevealTimers(): void {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
  }

  function scheduleReveal(fn: () => void, delay: number): void {
    revealTimers.push(setTimeout(fn, delay));
  }

  /**
   * The canvas-confetti "stars" preset (kirilv.com/canvas-confetti/#stars),
   * fired across the whole screen when a badge is newly earned. confetti's
   * canvas covers the whole viewport and its `origin` is normalized to that
   * (0,0 top-left, 1,1 bottom-right) — the default {x:0.5, y:0.5} bursts from
   * screen center. Aim it at the SCENARIO panel instead, where the badge that
   * was just earned actually appears.
   */
  function fireBadgeConfetti(): void {
    if (typeof confetti !== "function") return;
    const rect = panelEl.getBoundingClientRect();
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ["FFE400", "FFBD00", "E89400", "FFCA6C", "FDFFB8"],
    };
    const shoot = (): void => {
      confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ["star"] });
      confetti({ ...defaults, particleCount: 10, scalar: 0.75, shapes: ["circle"] });
    };
    shoot();
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  }

  function fillReward(reward: NonNullable<Scenarios[string]["reward"]>): void {
    currentReward = reward;
    rewardCtaEl.textContent = reward.text;
  }

  function revealReward(): void {
    const reward = deps.scenarios[state.name]?.reward;
    if (!reward) return;
    fillReward(reward);
    revealFadeIn(rewardBoxEl);
  }

  /**
   * The completion sequence for a quest that just went from "not all done" to
   * "all done". A first-time badge fires confetti immediately and holds "Nice
   * work", the badge and the reward back until the stars settle, so the reveal
   * lands together right as the screen clears; a repeat completion (badge
   * already earned, no confetti to wait for) reveals all three at once.
   */
  function revealCompletion(): void {
    clearRevealTimers();
    const badge = deps.badges.forFile(state.name);
    const isNewBadge = Boolean(badge) && !deps.badges.earned(state.name);
    if (isNewBadge) fireBadgeConfetti();
    scheduleReveal(
      () => {
        revealFadeIn(completeEl);
        deps.badges.award(state.name);
        revealReward();
      },
      isNewBadge ? CONFETTI_SETTLE_MS : 0,
    );
  }

  function markDone(id: string): void {
    if (state.done[id]) return;
    state.done[id] = true;
    const li = listEl.querySelector(`[data-id="${id}"]`);
    if (li) {
      li.classList.add("done", "pop");
      setTimeout(() => li.classList.remove("pop"), 400);
    }
    if (state.steps.length > 0 && state.steps.every((step) => state.done[step.id])) {
      revealCompletion();
    }
  }

  function unmarkDone(id: string): void {
    if (!state.done[id]) return;
    state.done[id] = false;
    listEl.querySelector(`[data-id="${id}"]`)?.classList.remove("done");
    // Undoing a step retracts "Nice work" and the reward (and any reveal still
    // in flight) — the badge, once shown, stays: it is permanently earned, not
    // a reflection of the checklist's current state, the same policy a revisit
    // applies.
    clearRevealTimers();
    hideInstant(completeEl);
    hideInstant(rewardBoxEl);
  }

  /** The first not-yet-done step, or null once every step is done — the one
   *  step signal() and checkEval() are allowed to test on a given call, so
   *  steps are always worked through in order and a later one can never
   *  complete while an earlier one is still outstanding. */
  function firstIncompleteStep(): Step | null {
    return state.steps.find((step) => !state.done[step.id]) ?? null;
  }

  function startQuest(name: string, steps: Step[]): void {
    state = { ...emptyState(), name, steps };
    listEl.innerHTML = "";
    clearRevealTimers();
    hideInstant(completeEl);
    hideInstant(rewardBoxEl);
    currentReward = null;
    deps.badges.render(deps.badges.earned(name) ? deps.badges.forFile(name) : undefined);

    steps.forEach((step, i) => {
      const li = document.createElement("li");
      li.className = "quest-step";
      li.dataset.id = step.id;
      const check = document.createElement("span");
      check.className = "quest-check";
      check.textContent = "✓";
      const text = document.createElement("span");
      text.className = "quest-text";
      text.textContent = step.text;
      li.appendChild(check);
      li.appendChild(text);
      if (step.manual) li.classList.add("manual");
      li.addEventListener("click", () => {
        if (state.done[step.id]) unmarkDone(step.id);
        else if (step.manual) markDone(step.id);
      });
      listEl.appendChild(li);
      // Reveal each step 0.5s apart, first one included, instead of the whole
      // checklist appearing at once — clearRevealTimers() above cancels any
      // reveal still in flight from a scenario this one is replacing.
      scheduleReveal(() => li.classList.add("show"), (i + 1) * 500);
    });
  }

  rewardCtaEl.addEventListener("click", (e) => {
    const reward = currentReward;
    if (!reward) return;
    if (reward.kind === "link" && reward.link) {
      window.open(reward.link, "_blank", "noopener");
    } else if (reward.kind === "gist") {
      // No API token lives in this static page, so there is no way to actually
      // create the gist — copy the document and hand the visitor off to a
      // blank one to paste it into, the same best-effort handoff Instagram
      // sharing uses.
      copyText(deps.documentText()).then(
        () => flashRewardStatus("Document copied — paste it into your new Gist."),
        () => flashRewardStatus("Couldn't reach the clipboard — copy the document by hand."),
      );
      window.open("https://gist.github.com/", "_blank", "noopener");
    } else if (reward.kind === "agent") {
      e.stopPropagation();
      // Substitutes the current KNOWLEDGE JSON into the reward's own prompt
      // template — same shape as the KNOWLEDGE panel's own prompt, but the
      // wording is per-scenario data rather than a hardcoded string.
      const promptFn = (): string => (reward.prompt ?? "").replace("{json}", deps.knowledgeText());
      deps.showAgentPopover(rewardCtaHostEl, promptFn, flashRewardStatus);
    }
  });

  return {
    render(name) {
      const s = deps.scenarios[name];
      panelEl.hidden = !s;
      if (!s) {
        // No scenario data for this file (e.g. one just created via + New) —
        // hide the whole panel rather than showing a generic placeholder.
        // Still reset the quest engine so a stale badge from the
        // previously-open file can't linger, invisible, behind the hidden
        // panel.
        bodyEl.innerHTML = "";
        startQuest(name, []);
        return;
      }
      bodyEl.innerHTML = "";
      const body = document.createElement("p");
      body.textContent = s.body;
      bodyEl.appendChild(body);
      startQuest(name, normalizeQuest(s.quest));
    },

    signal(action) {
      const step = firstIncompleteStep();
      if (step && step.action === action) markDone(step.id);
    },

    /**
     * Re-checked against the file's baseline snapshot on every fresh pgEval
     * result — the first call after a file loads only captures that baseline,
     * it can't complete a step against itself. Tests only the first
     * not-yet-done step: a single edit can easily satisfy several steps'
     * conditions at once (e.g. pasting in a whole finished example), and steps
     * complete one at a time, in order, rather than the whole list jumping to
     * done together.
     */
    checkEval(evalResult, source) {
      const hasStale = deps.hasStale(source);
      const isBaseline = state.baselineEvalJson === null;
      const ctx: EvalContext | null = isBaseline
        ? null
        : {
            evalResult,
            baselineJson: state.baselineEvalJson!,
            hasStale,
            baselineHasStale: state.baselineHasStale,
            sourceChanged: source !== state.baselineSource,
          };
      const step = firstIncompleteStep();
      if (step) {
        // "text" steps don't need a baseline — they're just a substring check
        // against whatever's in the document right now. evalCheck steps can't
        // complete on the call that establishes the baseline, since there's
        // nothing yet to compare against.
        const textMatch = Boolean(step.textContains) && source.includes(step.textContains!);
        const evalMatch = ctx !== null && step.evalCheck !== undefined && step.evalCheck(ctx);
        if (textMatch || evalMatch) markDone(step.id);
      }
      if (isBaseline) {
        state.baselineEvalJson = JSON.stringify(evalResult);
        state.baselineHasStale = hasStale;
        state.baselineSource = source;
      }
    },
  };
}
