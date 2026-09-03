export interface Settings {
  enable: boolean;
  check: { debounce: number };
  format: { fixDates: boolean };
  inlayHints: { enable: boolean };
  codeLens: { enable: boolean };
}

export const DEFAULTS: Settings = {
  enable: true,
  check: { debounce: 300 },
  format: { fixDates: false },
  inlayHints: { enable: true },
  codeLens: { enable: true },
};

/** Merge a partial `visimark.*` configuration onto the defaults, one level deep. */
export function mergeSettings(next: unknown): Settings {
  const p = (next ?? {}) as Partial<Settings>;
  return {
    enable: p.enable ?? DEFAULTS.enable,
    check: { ...DEFAULTS.check, ...p.check },
    format: { ...DEFAULTS.format, ...p.format },
    inlayHints: { ...DEFAULTS.inlayHints, ...p.inlayHints },
    codeLens: { ...DEFAULTS.codeLens, ...p.codeLens },
  };
}
