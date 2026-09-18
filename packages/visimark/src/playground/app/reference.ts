/**
 * The REFERENCE tab: static and document-independent — every builtin
 * mapper/aggregate, alphabetically, rendered from the same
 * describeFunction/precisionPhrase data the language server's hover and
 * `visimark ref` read. Never hand-copied, so it cannot drift from what the
 * engine actually does.
 */

import type { VisiMarkApi } from "../browser-entry.js";
import { byId, escapeHtml } from "./dom.js";

function refInline(s: string): string {
  return escapeHtml(s).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function refCapitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function renderReference(VM: VisiMarkApi): void {
  const tbody = byId("reference-body");
  for (const name of VM.functionNames().slice().sort()) {
    const e = VM.describeFunction(name);
    // Unreachable: the names come from functionNames(), which reads the same
    // table describeFunction looks in. Stated rather than asserted away, so a
    // future split between the two shows up as a missing row and not a crash.
    if (!e) continue;
    const sig = `${e.name}(${e.params.map((p) => p.name).join(", ")})`;
    const kind = e.kind === "reduce" ? "Aggregate" : "Mapper";

    const lines: string[] = [];
    lines.push(
      `<div class="ref-line"><span class="ref-kind">${kind}</span> — ${refInline(refCapitalize(e.summary))}.</div>`,
    );
    for (const p of e.params) {
      lines.push(
        `<div class="ref-line">— <code>${escapeHtml(p.name)}</code> (${escapeHtml(p.type)}) — ${refInline(p.note)}</div>`,
      );
    }
    lines.push(`<div class="ref-line">returns: ${refInline(e.returns)}</div>`);
    lines.push(
      `<div class="ref-line">precision: ${refInline(VM.precisionPhrase(e.precision))}</div>`,
    );
    if (e.rounding) {
      lines.push(`<div class="ref-line">rounding: ${refInline(e.rounding)}</div>`);
    }
    if (e.errors.length > 0) {
      const errLines = e.errors
        .map(
          (x) =>
            `<div class="ref-line">— ${refInline(x.when)} → <code>${escapeHtml(x.code)}</code></div>`,
        )
        .join("");
      lines.push(`<div class="ref-errors">errors:${errLines}</div>`);
    }

    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.className = "ref-name";
    nameCell.innerHTML = `<code>${escapeHtml(sig)}</code>`;
    const descCell = document.createElement("td");
    descCell.innerHTML = lines.join("");
    row.appendChild(nameCell);
    row.appendChild(descCell);
    tbody.appendChild(row);
  }
}
