import assert from "node:assert/strict";
import test from "node:test";
import { markdownToConfluenceStorage } from "../../src/services/publication-service.js";

test("Confluence storage conversion preserves the three headings, bullets, and safe HTTPS links", () => {
  const storage = markdownToConfluenceStorage([
    "## Accomplishments",
    "- Shipped the release",
    "",
    "## Blockers",
    "- [Risk details](https://example.com/issues/9)",
    "",
    "## Next week",
    "- Follow up",
  ].join("\n"));

  assert.equal(
    storage,
    "<h2>Accomplishments</h2><ul><li>Shipped the release</li></ul>" +
      "<h2>Blockers</h2><ul><li><a href=\"https://example.com/issues/9\">Risk details</a></li></ul>" +
      "<h2>Next week</h2><ul><li>Follow up</li></ul>",
  );
  assert.equal((storage.match(/<h2>/g) ?? []).length, 3);
  assert.equal((storage.match(/<li>/g) ?? []).length, 3);
});

test("Confluence storage conversion escapes user HTML and rejects non-approved Markdown structure", () => {
  const storage = markdownToConfluenceStorage(
    "## Accomplishments\n- <script>alert('x')</script>",
  );
  assert.match(storage, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  assert.throws(
    () => markdownToConfluenceStorage("A standalone summary"),
    { status: 400, code: "INVALID_REPORT_CONTENT" },
  );
});
