const CATEGORIES = ["accomplishment", "blocker", "next_week"];
const MAX_REPORT_LINES = 20;

export function validateReport({
  items,
  confirmedEmptyCategories = [],
  sourceAvailability = "available",
  lineCount,
}) {
  const itemCategories = new Set(items.map(({ category }) => category));
  const unconfirmedCategories = CATEGORIES.filter(
    (category) =>
      !itemCategories.has(category) &&
      !confirmedEmptyCategories.includes(category) &&
      sourceAvailability !== "unavailable",
  );
  const issues = [];

  if (unconfirmedCategories.length > 0) {
    issues.push({
      code: "UNCONFIRMED_EMPTY_CATEGORIES",
      categories: unconfirmedCategories,
    });
  }
  if (lineCount > MAX_REPORT_LINES) {
    issues.push({ code: "REPORT_TOO_LONG", lineCount, maxLines: MAX_REPORT_LINES });
  }

  return Object.freeze({
    ready: issues.length === 0,
    issues,
  });
}
