import { hasVisimarkAction } from "./repo.js";

/**
 * How ready a repository looks to take a pull request (spec §4.2). Computed
 * from the full path list and the workflow texts, both of which the shells
 * already hold, so it costs the widget no API call.
 */
export interface Posture {
  available: boolean;
  contributing: boolean | null;
  prTemplate: boolean | null;
  license: boolean | null;
  actionUsed: boolean | null;
  /** YYYY-MM-DD of the scanned commit */
  lastCommit: string | null;
}

const IN_DOC_DIRS = (rest: RegExp) => new RegExp(`^((docs|\\.github)/)?${rest.source}$`, "i");
const CONTRIBUTING = IN_DOC_DIRS(/contributing(\.[^/]*)?/);
const PR_TEMPLATE = IN_DOC_DIRS(/pull_request_template\.md/);
const PR_TEMPLATE_DIR = /^\.github\/pull_request_template\//i;
const LICENSE = /^(licen[cs]e|copying)(\.[^/]*)?$/i;

export function computePosture(
  paths: string[],
  workflowTexts: string[] | null,
  lastCommit: string | null,
): Posture {
  if (workflowTexts === null) {
    return {
      available: false,
      contributing: null,
      prTemplate: null,
      license: null,
      actionUsed: null,
      lastCommit: null,
    };
  }
  return {
    available: true,
    contributing: paths.some((p) => CONTRIBUTING.test(p)),
    prTemplate: paths.some((p) => PR_TEMPLATE.test(p) || PR_TEMPLATE_DIR.test(p)),
    license: paths.some((p) => LICENSE.test(p)),
    actionUsed: hasVisimarkAction(workflowTexts),
    lastCommit,
  };
}
