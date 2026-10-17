import type { Rule } from "../types.js";
import { engineCheck } from "./engine-check.js";
import { engineInfer } from "./engine-infer.js";
import { lineProduct } from "./line-product.js";
import { totalRow } from "./total-row.js";

/**
 * Every rule an investigation runs, in the order merged findings list them.
 * A new rule is one file under `src/rules/`, one line here, and one
 * `test/fixtures/rules/<id>/` folder (test/registry.test.ts enforces it).
 */
export const RULES: readonly Rule[] = [totalRow, lineProduct, engineCheck, engineInfer];
