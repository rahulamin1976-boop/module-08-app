const SECTIONS = Object.freeze([
  { category: "accomplishment", title: "Accomplishments" },
  { category: "blocker", title: "Blockers" },
  { category: "next_week", title: "Next week" },
]);

export function renderReport({
  items,
  confirmedEmptyCategories = [],
  sourceAvailability = "available",
}) {
  const byCategory = new Map(SECTIONS.map(({ category }) => [category, []]));
  for (const item of items) {
    byCategory.get(item.category)?.push(item);
  }

  const sections = {};
  const blocks = SECTIONS.map(({ category, title }) => {
    const categoryItems = byCategory.get(category) ?? [];
    const lines = categoryItems.map((item) => `- ${normalizeLine(item.text)}`);

    if (
      lines.length === 0 &&
      confirmedEmptyCategories.includes(category)
    ) {
      lines.push("- No items reported.");
    } else if (lines.length === 0 && sourceAvailability === "unavailable") {
      lines.push("- Jira data unavailable; manually confirm this section.");
    } else if (lines.length === 0) {
      lines.push("- Confirm whether this section has any items.");
    }

    sections[title] = lines;
    return [`## ${title}`, ...lines].join("\n");
  });
  const markdown = blocks.join("\n\n");

  return Object.freeze({
    sections: Object.freeze(sections),
    markdown,
    lineCount: markdown.split("\n").length,
  });
}

function normalizeLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}
