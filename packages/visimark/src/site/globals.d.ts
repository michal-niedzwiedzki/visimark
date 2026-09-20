// The CDN libraries the four docs/ pages load, typed only as far as those
// pages actually use them.
//
// Same reasoning as ../playground/app/globals.d.ts, and the same program:
// tsconfig.app.json covers both directories, because both are browser UI and
// neither belongs in the engine's Node-shaped world. `marked` is declared
// there rather than here — it is one program, so it is declared once, and the
// playground was first.

/** mermaid, for index.html's three structural diagrams. */
declare const mermaid:
  | {
      initialize(config: Record<string, unknown>): void;
      run(options: { querySelector: string }): void;
    }
  | undefined;

/** Swiper, for the landing page's three-slide preview cards. */
declare const Swiper: {
  new (el: Element | null, options: Record<string, unknown>): { slides: HTMLElement[] };
};
