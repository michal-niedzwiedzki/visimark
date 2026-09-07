import { type EngineInput, type EngineResult, registerEngine } from "../../src/artifact/index.js";

/**
 * A throwaway engine, registered only by tests.
 *
 * It exists to prove the criterion the design settled on: adding an engine is
 * a registry entry plus one file, with no change to dependency tracking,
 * anchoring, staleness, `check` or `fmt`. If this stub can be driven end to
 * end through the real pipeline, a future `line` engine can be too.
 */
export function stubEngine(input: EngineInput): EngineResult {
  const first = input.series[0]!;
  const total = first.values.reduce((a, b) => a.plus(b), first.values[0]!.mul(0));
  return {
    body: [`<title>${input.labels.join(",")}=${total.toString()}</title>`],
    height: 400,
  };
}

export function installStub(name: string): void {
  registerEngine(name, stubEngine);
}
