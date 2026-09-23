/**
 * Two prompts, deliberately.
 *
 * **A prompt earns its place when it encodes an ordering the agent gets wrong
 * unsupplied.** VisiMark has exactly two, and the skill documents both as
 * traps (spec §2.8).
 *
 * The change-an-input-and-watch-it-break probe is **not** a third prompt. It
 * is a step inside both of these, and splitting it out invites an agent to
 * treat it as optional.
 */
export interface PromptDef {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly arguments: readonly { name: string; description: string; required: boolean }[];
  render(args: Record<string, string>): string;
}

const target = (args: Record<string, string>): string =>
  args["path"] ? `\`${args["path"]}\`` : "the document you are working on";

export const PROMPTS: readonly PromptDef[] = [
  {
    name: "visimark/take-over",
    title: "Adopt an existing document",
    description:
      "Take over a Markdown document that already has its numbers. Runs `infer` first, " +
      "because hand-authoring rules for a document that already computed its values is how " +
      "you end up encoding the wrong ones.",
    arguments: [{ name: "path", description: "The document to adopt.", required: false }],
    render: (args) =>
      [
        `Adopt ${target(args)} as a VisiMark document.`,
        "",
        "Read `visimark://skill` first if you have not.",
        "",
        "1. Run `visimark_infer` on it. Do not hand-author rules before you have seen what",
        "   the document's own numbers already imply — the numbers are the evidence, and",
        "   inventing a rule that disagrees with them silently rewrites the document's",
        "   meaning.",
        "2. Read every proposal. A proposal marked weak, or one whose `disagreement` names a",
        "   row, is the document telling you its numbers do not all follow one rule. Decide",
        "   which is right before writing anything; do not average them.",
        "3. Apply the ones you accept, then run `visimark_check`.",
        "4. A green check at this point proves the stored numbers agree with the rules you",
        "   just derived *from those numbers*. That is circular, and it is the trap the",
        "   skill names. Change one input, run `visimark_fmt`, and confirm everything",
        "   downstream moves. If something does not move, it is not derived — it is a",
        "   literal wearing a rule's name.",
        "5. Leave the document clean under `visimark_check`.",
      ].join("\n"),
  },
  {
    name: "visimark/author",
    title: "Write a new document",
    description:
      "Write a new VisiMark document in the order that works: table, then `vmark` block, " +
      "then anchors, then prose, then `fmt`. Prose written before the rules exist is prose " +
      "full of numbers you typed yourself.",
    arguments: [
      {
        name: "subject",
        description: "What the document is — an invoice, a budget.",
        required: false,
      },
      { name: "path", description: "Where it will live.", required: false },
    ],
    render: (args) =>
      [
        `Write a VisiMark document${args["subject"] ? ` for ${args["subject"]}` : ""}` +
          `${args["path"] ? `, at \`${args["path"]}\`` : ""}.`,
        "",
        "Read `visimark://skill` first if you have not. `visimark://example/invoice` is a",
        "finished document in this shape if you want one to look at.",
        "",
        "In this order, and not another:",
        "",
        "1. **The table.** Inputs only — the numbers that come from outside. Leave every",
        "   computed cell empty.",
        "2. **The `vmark` block.** One rule per computed column, then the scalars. Never",
        "   write a number you calculated yourself; if it follows from other numbers, it is",
        "   a rule. Use `visimark_ref` rather than guessing what a builtin does.",
        "3. **The anchors.** Every number that will appear in prose gets one, so the prose",
        "   is generated rather than transcribed.",
        "4. **The prose.** Written around the anchors, never around numbers you typed.",
        "5. **`visimark_fmt`**, then apply its plan. The tool fills the computed cells and",
        "   the anchors. You do not.",
        "6. **`visimark_check`**, and then the probe: change one input, re-run `fmt`, and",
        "   confirm every derived number moved. A green check on numbers you wrote yourself",
        "   proves only that you copied them consistently.",
      ].join("\n"),
  },
];

export function promptFor(name: string): PromptDef | undefined {
  return PROMPTS.find((p) => p.name === name);
}
