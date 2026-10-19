// A consumer of the packed engine and lint plugins, typechecked in ci.yml's
// smoke-node job with `skipLibCheck` off: every published `.d.ts` these
// imports reach has to resolve against what the tarballs install, and nothing
// else. In-repo code typechecks against engine *source* through tsconfig
// `paths`, so this is the only place a packed declaration is ever compiled
// (review 2026-10-15 §2.11).
import { analyze, check, build, locate, type CheckResult, type Finding } from "visimark";
import remarkLintVisimark from "remark-lint-visimark";
import markdownlintVisimark from "markdownlint-rule-visimark";

const findings: Finding[] = analyze("# x\n").result.findings;
const result: CheckResult = check(build(locate("# x\n")));
const transformer = remarkLintVisimark();
const rules = markdownlintVisimark;
console.log(findings.length, result.findings.length, typeof transformer, rules.length);
