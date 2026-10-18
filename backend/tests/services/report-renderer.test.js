import assert from "node:assert/strict";
import test from "node:test";
import { renderReport } from "../../src/services/report-renderer.js";
import { validateReport } from "../../src/services/report-validation.js";

test("report renderer emits the three ordered sections and exact confirmed-empty bullet", () => {
  const report = renderReport({
    items: [
      { category: "next_week", text: "Plan next milestone" },
      { category: "accomplishment", text: "Completed first step" },
    ],
    confirmedEmptyCategories: ["blocker"],
  });

  assert.deepEqual(Object.keys(report.sections), [
    "Accomplishments",
    "Blockers",
    "Next week",
  ]);
  assert.equal(report.sections.Blockers[0], "- No items reported.");
  assert.match(report.markdown, /^## Accomplishments\n- Completed first step\n\n## Blockers/m);
  assert.match(report.markdown, /## Blockers\n- No items reported\.\n\n## Next week/);
});

test("unavailable source is represented by a warning, not an empty result", () => {
  const report = renderReport({
    items: [],
    sourceAvailability: "unavailable",
  });
  assert.equal(report.markdown.includes("- No items reported."), false);
  assert.ok(report.markdown.includes("- Jira data unavailable; manually confirm this section."));
});

test("report completeness blocks unconfirmed empty sections and over-limit content", () => {
  const items = Array.from({ length: 18 }, (_value, index) => ({
    category: index % 3 === 0
      ? "accomplishment"
      : index % 3 === 1
        ? "blocker"
        : "next_week",
    text: `Report item ${index}`,
  }));
  const rendered = renderReport({
    items,
    confirmedEmptyCategories: [],
  });
  const validation = validateReport({
    items,
    confirmedEmptyCategories: [],
    sourceAvailability: "available",
    lineCount: rendered.lineCount,
  });

  assert.equal(rendered.lineCount, 23);
  assert.equal(validation.ready, false);
  assert.ok(validation.issues.some(({ code }) => code === "REPORT_TOO_LONG"));
});

test("a report at the 20-line threshold remains within the specified limit", () => {
  const items = Array.from({ length: 15 }, (_value, index) => ({
    category: index % 3 === 0
      ? "accomplishment"
      : index % 3 === 1
        ? "blocker"
        : "next_week",
    text: `Report item ${index}`,
  }));
  const rendered = renderReport({
    items,
    confirmedEmptyCategories: [],
  });

  assert.equal(rendered.lineCount, 20);
  assert.equal(validateReport({
    items,
    confirmedEmptyCategories: [],
    sourceAvailability: "available",
    lineCount: rendered.lineCount,
  }).ready, true);
});
