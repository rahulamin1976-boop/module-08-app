import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import React from "react";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:5173/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MutationObserver = dom.window.MutationObserver;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { cleanup, fireEvent, render, screen, waitFor } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { MemoryRouter, Route, Routes } = await import("react-router-dom");

const projectId = "50e26a1e-c471-4e54-a938-26269bd764b3";
const candidate = {
  issueId: "9",
  issueKey: "OPS-9",
  summary: "Service issue resolved",
  status: "Done",
  assignee: "Jordan",
  updatedAt: "2026-10-14T11:00:00.000Z",
  url: "https://example.atlassian.net/browse/OPS-9",
};

let vite;
let CreateReportPage;
let WeeklyReportsPage;
let ReviewReportPage;
let PublishReportPage;
let AtlassianConnectionPage;
let originalFetch;

before(async () => {
  vite = await createServer({
    configFile: "./vite.config.js",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  ({ default: CreateReportPage } = await vite.ssrLoadModule(
    "/src/pages/CreateReportPage.jsx",
  ));
  ({ default: WeeklyReportsPage } = await vite.ssrLoadModule(
    "/src/pages/WeeklyReportsPage.jsx",
  ));
  ({ default: ReviewReportPage } = await vite.ssrLoadModule(
    "/src/pages/ReviewReportPage.jsx",
  ));
  ({ default: PublishReportPage } = await vite.ssrLoadModule(
    "/src/pages/PublishReportPage.jsx",
  ));
  ({ default: AtlassianConnectionPage } = await vite.ssrLoadModule(
    "/src/pages/AtlassianConnectionPage.jsx",
  ));
});

after(async () => {
  await vite?.close();
  dom.window.close();
});

afterEach(() => {
  cleanup();
  if (originalFetch) globalThis.fetch = originalFetch;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installApi({
  connected = true,
  jiraFailure = false,
  reports = [],
  reviewReport = null,
  staleEdit = false,
  titleConflict = false,
  publicationFailure = false,
} = {}) {
  originalFetch = globalThis.fetch;
  const requests = [];
  let reportReads = 0;
  let firstPublish = true;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input), "http://127.0.0.1:5173");
    const method = options.method ?? "GET";
    requests.push({ path: url.pathname, search: url.search, method, body: options.body });

    if (url.pathname === "/api/v1/integrations/atlassian") {
      return jsonResponse(connected ? {
        connected: true,
        account: { id: "account-1", displayName: "Jordan" },
        capabilities: ["read:jira-work"],
      } : { connected: false });
    }
    if (url.pathname === "/api/v1/confluence/spaces") {
      return jsonResponse({
        items: [{ id: "space-1", key: "OPS", name: "Operations" }],
        nextCursor: null,
      });
    }
    if (url.pathname === "/api/v1/confluence/spaces/space-1/pages") {
      return jsonResponse({
        items: [{ id: "parent-1", title: "Leadership reports", parentId: null }],
        nextCursor: null,
      });
    }
    if (url.pathname === "/api/v1/reports/report-1/publish" && method === "POST") {
      if (titleConflict && firstPublish) {
        firstPublish = false;
        return jsonResponse({
          error: {
            code: "CONFLUENCE_TITLE_CONFLICT",
            message: "A different page already uses this title.",
          },
        }, 409);
      }
      if (publicationFailure) {
        return jsonResponse({
          error: {
            code: "PUBLICATION_UNCERTAIN",
            message: "Confluence may have created the page; retry to reconcile.",
          },
        }, 502);
      }
      const baseReport = reviewReport ?? createReviewReport({ status: "approved" });
      const requestBody = JSON.parse(options.body);
      const title = `OPS Weekly Status 2026-10-12 to 2026-10-16` +
        (requestBody.titleSuffix ? ` (${requestBody.titleSuffix})` : "");
      return jsonResponse({
        ...baseReport,
        status: "published",
        confluencePageId: "page-1",
        confluencePageTitle: title,
        confluencePageUrl: "https://example.atlassian.net/wiki/spaces/OPS/pages/page-1",
      });
    }
    if (url.pathname === "/api/v1/jira/projects") {
      return jsonResponse({
        items: [{ id: projectId, jiraProjectId: "101", key: "OPS", name: "Operations" }],
        nextCursor: null,
      });
    }
    if (url.pathname.endsWith("/updates")) {
      if (jiraFailure) {
        return jsonResponse({
          error: { code: "UPSTREAM_UNAVAILABLE", message: "Jira is temporarily unavailable." },
        }, 503);
      }
      return jsonResponse({ items: [candidate], nextCursor: null });
    }
    if (url.pathname === "/api/v1/reports/report-1/approve") {
      return jsonResponse({ ...reviewReport, status: "approved", version: 2 });
    }
    if (url.pathname === "/api/v1/reports/report-1" && method === "PATCH") {
      if (staleEdit) {
        return jsonResponse({
          error: {
            code: "STALE_VERSION",
            message: "The report changed in another session.",
            details: { latestVersion: 2 },
          },
        }, 409);
      }
      const payload = JSON.parse(options.body);
      return jsonResponse({
        ...reviewReport,
        version: 2,
        lastEditedByAccountId: "account-1",
        items: reviewReport.items.map((item) => ({
          ...item,
          ...payload.items.find(({ id }) => id === item.id),
          sourceType: "user_edited",
          editedByAccountId: "account-1",
        })),
      });
    }
    if (url.pathname === "/api/v1/reports/report-1" && method === "GET") {
      reportReads += 1;
      const baseReport = reviewReport ?? createReviewReport({ status: "approved" });
      return jsonResponse({
        ...baseReport,
        version: staleEdit && reportReads > 1 ? 2 : baseReport.version,
      });
    }
    if (url.pathname === "/api/v1/reports" && method === "POST") {
      return jsonResponse({ id: "report-1" }, 201);
    }
    if (url.pathname === "/api/v1/reports") {
      return jsonResponse({ items: reports, nextCursor: null });
    }
    return jsonResponse({ error: { code: "NOT_FOUND", message: "Not found." } }, 404);
  };
  return requests;
}

function renderCreatePage() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/reports/new"] },
      React.createElement(Routes, null,
        React.createElement(Route, {
          path: "/reports/new",
          element: React.createElement(CreateReportPage),
        }),
        React.createElement(Route, {
          path: "/reports/:reportId/review",
          element: React.createElement("h1", null, "Saved draft review"),
        }),
      ),
    ),
  );
}

async function chooseProjectAndPeriod(user) {
  await screen.findByRole("option", { name: /OPS — Operations/ });
  await user.selectOptions(screen.getByLabelText("Jira project"), projectId);
  fireEvent.change(screen.getByLabelText("Period start"), {
    target: { value: "2026-10-12" },
  });
  fireEvent.change(screen.getByLabelText("Period end"), {
    target: { value: "2026-10-16" },
  });
}

test("user selects and categorizes Jira evidence before creating a draft", async () => {
  const requests = installApi();
  const user = userEvent.setup();
  renderCreatePage();
  await chooseProjectAndPeriod(user);

  await user.click(screen.getByRole("button", { name: "Load Jira updates" }));
  const issueCheckbox = await screen.findByRole("checkbox", { name: /OPS-9/ });
  await user.click(issueCheckbox);
  await user.selectOptions(screen.getByLabelText("Report category"), "accomplishment");
  assert.equal(screen.getByLabelText("Report category").value, "accomplishment");

  await user.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("heading", { name: "Saved draft review" });
  const createRequest = requests.find((request) =>
    request.path === "/api/v1/reports" && request.method === "POST",
  );
  assert.ok(createRequest);
  const payload = JSON.parse(createRequest.body);
  assert.deepEqual(payload.jiraUpdates, [{
    issueId: "9",
    issueKey: "OPS-9",
    category: "accomplishment",
  }]);
  assert.equal(payload.periodStart, "2026-10-12");
  assert.equal(payload.periodEnd, "2026-10-16");
  assert.equal(payload.timezone, "UTC");
});

test("Jira failure remains visible while the user creates a trimmed manual-only draft", async () => {
  const requests = installApi({ jiraFailure: true });
  const user = userEvent.setup();
  renderCreatePage();
  await chooseProjectAndPeriod(user);
  await user.click(screen.getByRole("button", { name: "Load Jira updates" }));

  assert.match(
    (await screen.findByRole("alert")).textContent,
    /Jira updates could not be loaded/,
  );
  assert.match(screen.getByRole("status").textContent, /Jira is unavailable/);

  await user.click(screen.getByRole("button", { name: "Add update" }));
  await user.selectOptions(screen.getByLabelText("Category"), "blocker");
  fireEvent.change(screen.getByLabelText(/Update text/), {
    target: { value: "  Waiting for an external review.  " },
  });
  fireEvent.change(screen.getByLabelText("Owner (optional)"), {
    target: { value: "  Jordan  " },
  });
  await user.click(screen.getByRole("button", { name: "Save draft" }));

  await screen.findByRole("heading", { name: "Saved draft review" });
  const createRequest = requests.find((request) =>
    request.path === "/api/v1/reports" && request.method === "POST",
  );
  assert.ok(createRequest);
  const payload = JSON.parse(createRequest.body);
  assert.deepEqual(payload.manualUpdates, [{
    category: "blocker",
    text: "Waiting for an external review.",
    owner: "Jordan",
  }]);
});

test("disconnected state links to connection settings and prevents draft submission", async () => {
  installApi({ connected: false });
  renderCreatePage();

  await screen.findByRole("link", { name: "Open connection settings" });
  assert.equal(screen.getByRole("button", { name: "Save draft" }).disabled, true);
});

test("weekly reports load summaries and link each report to review", async () => {
  installApi({
    reports: [{
      id: "report-1",
      project: { id: projectId, key: "OPS", name: "Operations" },
      periodStart: "2026-10-12",
      periodEnd: "2026-10-16",
      timezone: "UTC",
      status: "draft",
      version: 1,
      updatedAt: "2026-10-18T12:00:00.000Z",
    }],
  });
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(WeeklyReportsPage),
    ),
  );

  await screen.findByText("OPS · Operations");
  const openLink = screen.getByRole("link", { name: "Open report" });
  assert.equal(openLink.getAttribute("href"), "/reports/report-1/review");
});

test("weekly reports expose actionable API errors", async () => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    error: { code: "DATABASE_UNAVAILABLE", message: "Reports could not be loaded." },
  }, 503);
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(WeeklyReportsPage),
    ),
  );

  await waitFor(() => {
    assert.match(screen.getByRole("alert").textContent, /Reports could not be loaded/);
  });
});

function createReviewReport(overrides = {}) {
  return {
    id: "report-1",
    version: 1,
    status: "draft",
    project: { id: projectId, jiraProjectId: "101", key: "OPS", name: "Operations" },
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    timezone: "UTC",
    createdByAccountId: "creator-account",
    approvedByAccountId: null,
    lastEditedByAccountId: null,
    approvedAt: null,
    publishedAt: null,
    confluencePageId: null,
    confluencePageUrl: null,
    updatedAt: "2026-10-18T12:00:00.000Z",
    sourceSnapshot: { jiraStatus: "available" },
    items: [{
      id: "d5be7c1e-86ad-4f96-bae9-5e5cf07b6553",
      category: "accomplishment",
      text: "Completed verified delivery",
      sourceType: "jira",
      sourceReference: "OPS-9",
      sourceSnapshot: {
        issueId: "9",
        issueKey: "OPS-9",
        summary: "Completed verified delivery",
        status: "Done",
        assignee: "Jordan",
        updatedAt: "2026-10-14T11:00:00.000Z",
        url: "https://example.atlassian.net/browse/OPS-9",
      },
      editedByAccountId: null,
      owner: "Jordan",
      sourceUpdatedAt: "2026-10-14T11:00:00.000Z",
      position: 0,
      createdAt: "2026-10-18T12:00:00.000Z",
      updatedAt: "2026-10-18T12:00:00.000Z",
    }],
    sections: {
      Accomplishments: ["- Completed verified delivery"],
      Blockers: ["- No items reported."],
      "Next week": ["- No items reported."],
    },
    markdown: "## Accomplishments\n- Completed verified delivery\n\n## Blockers\n- No items reported.\n\n## Next week\n- No items reported.",
    lineCount: 8,
    validation: { ready: true, issues: [] },
    confirmedEmptyCategories: ["blocker", "next_week"],
    warnings: [],
    ...overrides,
  };
}

function renderReviewPage() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/reports/report-1/review"] },
      React.createElement(Routes, null,
        React.createElement(Route, {
          path: "/reports/:reportId/review",
          element: React.createElement(ReviewReportPage),
        }),
        React.createElement(Route, {
          path: "/",
          element: React.createElement("h1", null, "Weekly reports"),
        }),
      ),
    ),
  );
}

function renderPublishPage() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/reports/report-1/publish"] },
      React.createElement(Routes, null,
        React.createElement(Route, {
          path: "/reports/:reportId/publish",
          element: React.createElement(PublishReportPage),
        }),
      ),
    ),
  );
}

test("review edits save without allowing the client to replace source provenance", async () => {
  const reviewReport = createReviewReport();
  const requests = installApi({ reviewReport });
  const user = userEvent.setup();
  renderReviewPage();

  await screen.findByText(/Report version 1/);
  assert.match(screen.getByText("Source details").textContent, /Source details/);
  fireEvent.change(screen.getByLabelText(/Update text/), {
    target: { value: "Reworded verified delivery" },
  });
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText(/Report version 2/);

  const patch = requests.find((request) =>
    request.path === "/api/v1/reports/report-1" && request.method === "PATCH",
  );
  assert.ok(patch);
  const body = JSON.parse(patch.body);
  assert.equal(body.version, 1);
  assert.deepEqual(body.items, [{
    id: "d5be7c1e-86ad-4f96-bae9-5e5cf07b6553",
    category: "accomplishment",
    text: "Reworded verified delivery",
    owner: "Jordan",
  }]);
});

test("stale review edits prompt a reload and do not claim the save succeeded", async () => {
  const reviewReport = createReviewReport();
  installApi({ reviewReport, staleEdit: true });
  const user = userEvent.setup();
  renderReviewPage();

  await screen.findByText(/Report version 1/);
  fireEvent.change(screen.getByLabelText(/Update text/), {
    target: { value: "A stale edit" },
  });
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText(/changed elsewhere/);
  assert.equal(screen.getByText(/Report version 1/).textContent.includes("Report version 1"), true);

  await user.click(screen.getByRole("button", { name: "Reload latest report" }));
  await screen.findByText(/Report version 2/);
  assert.equal(screen.getByLabelText(/Update text/).value, "Completed verified delivery");
});

test("account replacement requires confirmation and connection UI does not expose tokens", async () => {
  installApi();
  const user = userEvent.setup();
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/connection"] },
      React.createElement(AtlassianConnectionPage),
    ),
  );

  await screen.findByText("Jordan");
  const switchCheckbox = screen.getByRole("checkbox", {
    name: /confirm that connecting another account will replace the current account/i,
  });
  const connectButton = screen.getByRole("button", { name: "Connect a different account" });
  assert.equal(connectButton.disabled, true);
  await user.click(switchCheckbox);
  assert.equal(connectButton.disabled, false);
  assert.doesNotMatch(document.body.textContent, /access_token|refresh_token/i);
});

test("approved report can be published to a chosen Confluence parent page", async () => {
  const requests = installApi();
  const user = userEvent.setup();
  renderPublishPage();

  await screen.findByRole("option", { name: "OPS — Operations" });
  await user.selectOptions(screen.getByLabelText("Confluence space"), "space-1");
  await user.click(screen.getByRole("button", { name: "Load parent pages" }));
  await user.selectOptions(
    await screen.findByLabelText("Parent page"),
    "parent-1",
  );
  await user.click(screen.getByRole("button", { name: "Publish approved report" }));

  const publishedLink = await screen.findByRole("link", {
    name: "Open OPS Weekly Status 2026-10-12 to 2026-10-16",
  });
  assert.equal(
    publishedLink.getAttribute("href"),
    "https://example.atlassian.net/wiki/spaces/OPS/pages/page-1",
  );
  const request = requests.find(({ path, method }) =>
    path === "/api/v1/reports/report-1/publish" && method === "POST",
  );
  assert.deepEqual(JSON.parse(request.body), {
    spaceId: "space-1",
    parentPageId: "parent-1",
  });
});

test("title collision requires a reviewed suffix before retrying publication", async () => {
  const requests = installApi({ titleConflict: true });
  const user = userEvent.setup();
  renderPublishPage();

  await screen.findByRole("option", { name: "OPS — Operations" });
  await user.selectOptions(screen.getByLabelText("Confluence space"), "space-1");
  await user.click(screen.getByRole("button", { name: "Load parent pages" }));
  await user.selectOptions(
    await screen.findByLabelText("Parent page"),
    "parent-1",
  );
  await user.click(screen.getByRole("button", { name: "Publish approved report" }));

  await screen.findByText("A different page already uses this title.");
  const suffix = screen.getByLabelText(
    "Add a disambiguating title suffix after reviewing the collision",
  );
  await user.type(suffix, "October");
  assert.ok(screen.getByText("OPS Weekly Status 2026-10-12 to 2026-10-16 (October)"));
  await user.click(screen.getByRole("button", { name: "Publish approved report" }));
  await screen.findByRole("link", {
    name: "Open OPS Weekly Status 2026-10-12 to 2026-10-16 (October)",
  });

  const requestsToPublish = requests.filter(({ path, method }) =>
    path === "/api/v1/reports/report-1/publish" && method === "POST",
  );
  assert.equal(requestsToPublish.length, 2);
  assert.deepEqual(JSON.parse(requestsToPublish[1].body), {
    spaceId: "space-1",
    parentPageId: "parent-1",
    titleSuffix: "October",
  });
});

test("uncertain publication response is shown as recoverable, not as success", async () => {
  installApi({ publicationFailure: true });
  const user = userEvent.setup();
  renderPublishPage();

  await screen.findByRole("option", { name: "OPS — Operations" });
  await user.selectOptions(screen.getByLabelText("Confluence space"), "space-1");
  await user.click(screen.getByRole("button", { name: "Load parent pages" }));
  await user.selectOptions(
    await screen.findByLabelText("Parent page"),
    "parent-1",
  );
  await user.click(screen.getByRole("button", { name: "Publish approved report" }));

  await screen.findByText("Confluence may have created the page; retry to reconcile.");
  assert.equal(screen.queryByText("Publication confirmed"), null);
  assert.ok(screen.getByRole("button", { name: "Publish approved report" }));
});
