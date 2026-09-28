import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

// The community scanner runs this same ruleset against a release; linting here
// keeps its warnings (publicly visible on the plugin's Scorecard) from being a
// surprise. Tests and build scripts are outside the scanner's scope.
export default defineConfig([
  { ignores: ["main.js", "*.mjs", "test/**"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // The product's own name. The scanner runs the stock ruleset without this
      // option, so it will still flag "VisiMark" in UI text as a warning.
      "obsidianmd/ui/sentence-case": ["warn", { brands: ["VisiMark"] }],
    },
  },
]);
