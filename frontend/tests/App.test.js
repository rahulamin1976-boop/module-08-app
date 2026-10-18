import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { createServer } from "vite";

let vite;
let ApplicationRoutes;
let AppLayout;
let PageState;

before(async () => {
  vite = await createServer({
    configFile: "./vite.config.js",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  ({ ApplicationRoutes } = await vite.ssrLoadModule("/src/App.jsx"));
  ({ default: AppLayout } = await vite.ssrLoadModule(
    "/src/components/AppLayout.jsx",
  ));
  ({ default: PageState } = await vite.ssrLoadModule(
    "/src/components/PageState.jsx",
  ));
});

after(async () => {
  await vite?.close();
});

function renderRoute(path) {
  return renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: path },
      React.createElement(
        AppLayout,
        null,
        React.createElement(ApplicationRoutes),
      ),
    ),
  );
}

test("all application routes render a page heading inside semantic landmarks", () => {
  const routes = [
    ["/", "Weekly reports"],
    ["/reports/new", "Create a report"],
    ["/reports/example/review", "Review report"],
    ["/reports/example/publish", "Publish report"],
    ["/connection", "Atlassian connection"],
  ];

  for (const [path, heading] of routes) {
    const markup = renderRoute(path);
    assert.match(markup, /<main id="main-content"/);
    assert.match(markup, /<nav class="primary-nav"/);
    assert.ok(markup.includes(`<h1>${heading}</h1>`), `${path} heading`);
  }
});

test("navigation exposes keyboard-operable links to the primary screens", () => {
  const markup = renderRoute("/");
  assert.match(markup, /<nav class="primary-nav"/);
  assert.match(markup, /href="\/"/);
  assert.match(markup, /href="\/reports\/new"/);
  assert.match(markup, /href="\/connection"/);
  assert.match(markup, /Weekly reports/);
  assert.match(markup, /Create report/);
  assert.match(markup, /Atlassian connection/);
});

test("unknown routes render a clear not-found error state", () => {
  const markup = renderRoute("/missing");
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Page not found/);
});

test("shared page states expose accessible loading, empty, and error presentations", () => {
  const loading = renderToStaticMarkup(
    React.createElement(PageState, { kind: "loading", title: "Loading reports" }),
  );
  const empty = renderToStaticMarkup(
    React.createElement(PageState, { kind: "empty", title: "No reports" }),
  );
  const error = renderToStaticMarkup(
    React.createElement(PageState, { kind: "error", title: "Reports unavailable" }),
  );

  assert.match(loading, /role="status"/);
  assert.match(empty, /No reports/);
  assert.match(error, /role="alert"/);
});
