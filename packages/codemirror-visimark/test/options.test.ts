import { expect, test } from "bun:test";
import type { VisimarkOptions } from "../src/index.js";

type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const keys: Exactly<
  keyof VisimarkOptions,
  "active" | "path" | "readImport" | "recompute" | "focusableMarks"
> = true;

test("E13: the options interface is closed at exactly five keys", () => {
  expect(keys).toBe(true); // the real check is `tsc --noEmit`: a sixth key makes `keys` a type error
});
