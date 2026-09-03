import { analyze, type CheckResult, type DocModel } from "visimark";

export interface Analysis {
  model: DocModel;
  result: CheckResult;
  /** false when the document contains no vmark block — VisiMark stays silent */
  applicable: boolean;
}

interface Entry {
  version: number;
  analysis: Analysis;
}

const cache = new Map<string, Entry>();

/**
 * Analyse a document, reusing the previous result while its version is
 * unchanged. Every provider calls this, so a single keystroke costs one
 * parse no matter how many features are active.
 */
export function analyzeDocument(
  uri: string,
  version: number,
  text: string,
): Analysis {
  const hit = cache.get(uri);
  if (hit && hit.version === version) return hit.analysis;

  const { model, result } = analyze(text);
  const analysis: Analysis = {
    model,
    result,
    applicable: model.located.blocks.length > 0,
  };
  cache.set(uri, { version, analysis });
  return analysis;
}

export function forgetDocument(uri: string): void {
  cache.delete(uri);
}
