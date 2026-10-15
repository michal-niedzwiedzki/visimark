/**
 * The one clipboard path every copy button on the page goes through.
 *
 * `navigator.clipboard` only exists in a secure context (https, or localhost
 * during local dev). This playground is often opened from a plain http mirror,
 * where the API is simply undefined and every copy silently does nothing.
 * `execCommand("copy")` is deprecated but still broadly supported, needs no
 * permission prompt, and works in exactly the contexts the modern API refuses
 * — so it is the fallback, not an afterthought.
 */

function copyTextFallback(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Off-screen rather than hidden: execCommand("copy") only ever copies an
    // actual, rendered selection.
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "-9999px";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    if (ok) resolve();
    else reject(new Error("execCommand(copy) failed"));
  });
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => copyTextFallback(text));
  }
  return copyTextFallback(text);
}

/** Wires a copy button to the text content of `sourceEl`, reporting either
 *  outcome on `statusEl`'s flasher. */
export function wireCopyButton(
  btnEl: HTMLElement,
  flash: (text: string) => void,
  sourceEl: HTMLElement,
  failure = "Couldn't reach the clipboard — select and copy the text by hand.",
): void {
  btnEl.addEventListener("click", () => {
    copyText(sourceEl.textContent ?? "").then(
      () => flash("Copied!"),
      () => flash(failure),
    );
  });
}
