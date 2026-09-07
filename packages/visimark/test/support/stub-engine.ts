import { type EngineInput, type EngineResult, registerEngine } from "../../src/artifact/index.js";
import { marker } from "../../src/artifact/stale.js";

/**
 * A throwaway engine, registered only by tests.
 *
 * It exists to prove the criterion the design settled on: adding an engine is
 * a registry entry plus one file, with no change to dependency tracking,
 * anchoring, staleness, `check` or `fmt`. If this stub can be driven end to
 * end through the real pipeline, a future `line` engine can be too.
 */
export function stubEngine(sheetId: string, chart: string) {
  return (input: EngineInput): EngineResult => {
    const total = input.series[0]!.values.reduce((a, b) => a.plus(b), input.series[0]!.values[0]!.mul(0));
    return {
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">` +
        marker(sheetId, chart) +
        `<title>${input.labels.join(",")}=${total.toString()}</title>` +
        `</svg>\n`,
    };
  };
}

/** register under a name no built-in uses */
export function installStub(name: string, sheetId: string, chart: string): void {
  registerEngine(name, stubEngine(sheetId, chart));
}
