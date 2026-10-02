// Library smoke for the two lint plugins, run by ci.yml's smoke-node and
// smoke-bun from a scratch project that has the *packed* tarballs installed.
// Neither package has a `bin`, so this is what "the published artifact works"
// means for them: the bare specifier resolves, the engine it wraps loads, and
// a document with a false `assert` produces a finding through each.
import remarkLintVisimark from "remark-lint-visimark";
import rules from "markdownlint-rule-visimark";
import { lint } from "markdownlint/promise";

const doc = "# smoke\n\n```vmark #s\nx = 1\nassert x > 2\n```\n";
let failed = false;
const fail = (msg) => {
  console.error(`::error::${msg}`);
  failed = true;
};

// remark-lint-visimark: a unified plugin is a function returning a
// transformer; drive it with the two things it touches (`file.value` and
// `file.message`) so the check does not depend on unified being hoisted.
const messages = [];
const file = {
  value: doc,
  message(reason, _place, ruleId) {
    const message = { reason, ruleId };
    messages.push(message);
    return message;
  },
};
remarkLintVisimark()({}, file);
if (!messages.some((m) => m.ruleId === "visimark:visimark-assert" && m.fatal === true)) {
  fail(
    `remark-lint-visimark: expected a fatal visimark-assert message, got ${JSON.stringify(messages)}`,
  );
} else {
  console.log("remark-lint-visimark ok — visimark-assert reported");
}

// markdownlint-rule-visimark, through markdownlint itself.
const result = await lint({ strings: { doc }, customRules: rules });
const hits = result.doc.map((e) => e.ruleNames[0]);
if (!hits.includes("visimark-assert")) {
  fail(`markdownlint-rule-visimark: expected visimark-assert, got ${JSON.stringify(hits)}`);
} else {
  console.log("markdownlint-rule-visimark ok — visimark-assert reported");
}

process.exit(failed ? 1 : 0);
