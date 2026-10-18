import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeading from "../components/PageHeading.jsx";
import PageState from "../components/PageState.jsx";
import { apiRequest } from "../services/api-client.js";

export default function PublishReportPage() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [spaces, setSpaces] = useState([]);
  const [spaceCursor, setSpaceCursor] = useState(null);
  const [spaceQuery, setSpaceQuery] = useState("");
  const [spaceState, setSpaceState] = useState("loading");
  const [spaceId, setSpaceId] = useState("");
  const [pages, setPages] = useState([]);
  const [pageCursor, setPageCursor] = useState(null);
  const [pageQuery, setPageQuery] = useState("");
  const [pageState, setPageState] = useState("idle");
  const [parentPageId, setParentPageId] = useState("");
  const [titleSuffix, setTitleSuffix] = useState("");
  const [titleConflict, setTitleConflict] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest(`/api/v1/reports/${encodeURIComponent(reportId)}`)
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reportId]);

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/integrations/atlassian")
      .then((result) => {
        if (active) setConnection(result);
      })
      .catch((error) => {
        if (active) setActionError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!connection?.connected) return undefined;
    let active = true;
    setSpaceState("loading");
    apiRequest("/api/v1/confluence/spaces?limit=50")
      .then((result) => {
        if (active) {
          setSpaces(result.items);
          setSpaceCursor(result.nextCursor);
          setSpaceState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setSpaceState("error");
          setActionError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [connection]);

  async function searchSpaces(cursor = null) {
    setSpaceState(cursor ? "loading-more" : "loading");
    setActionError("");
    const params = new URLSearchParams({ limit: "50" });
    if (spaceQuery.trim()) params.set("query", spaceQuery.trim());
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await apiRequest(`/api/v1/confluence/spaces?${params}`);
      setSpaces((current) => cursor ? [...current, ...result.items] : result.items);
      setSpaceCursor(result.nextCursor);
      setSpaceState("ready");
    } catch (error) {
      setSpaceState("error");
      setActionError(error.message);
    }
  }

  async function searchParentPages(cursor = null) {
    if (!spaceId) return;
    setPageState(cursor ? "loading-more" : "loading");
    setActionError("");
    const params = new URLSearchParams({ limit: "50" });
    if (pageQuery.trim()) params.set("query", pageQuery.trim());
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await apiRequest(
        `/api/v1/confluence/spaces/${encodeURIComponent(spaceId)}/pages?${params}`,
      );
      setPages((current) => cursor ? [...current, ...result.items] : result.items);
      setPageCursor(result.nextCursor);
      setPageState("ready");
    } catch (error) {
      setPageState("error");
      setActionError(error.message);
    }
  }

  async function publish() {
    if (
      !report ||
      report.status !== "approved" ||
      !connection?.connected ||
      !spaceId ||
      !parentPageId
    ) {
      return;
    }
    setPublishing(true);
    setActionError("");
    setTitleConflict(false);
    try {
      const result = await apiRequest(
        `/api/v1/reports/${encodeURIComponent(report.id)}/publish`,
        {
          method: "POST",
          body: {
            spaceId,
            parentPageId,
            ...(titleSuffix.trim() ? { titleSuffix: titleSuffix.trim() } : {}),
          },
        },
      );
      setReport(result);
    } catch (error) {
      setActionError(error.message);
      if (error.code === "CONFLUENCE_TITLE_CONFLICT") setTitleConflict(true);
    } finally {
      setPublishing(false);
    }
  }

  const pageTitle = report
    ? `${report.project.key} Weekly Status ${report.periodStart} to ${report.periodEnd}` +
      (titleSuffix.trim() ? ` (${titleSuffix.trim()})` : "")
    : "";

  return (
    <>
      <PageHeading
        eyebrow="STEP 3 OF 3"
        title="Publish report"
        description="Choose a Confluence parent page and confirm the report destination."
      />
      {loading && <PageState kind="loading" title="Loading approved report" />}
      {!loading && loadError && (
        <PageState kind="error" title="Publication is unavailable">{loadError}</PageState>
      )}
      {!loading && report && report.status === "draft" && (
        <PageState kind="error" title="Approve the report before publishing">
          <Link className="text-link" to={`/reports/${encodeURIComponent(report.id)}/review`}>
            Review and approve this report
          </Link>
        </PageState>
      )}
      {!loading && report && (
        <>
          {connection && !connection.connected && (
            <PageState kind="error" title="Connect Atlassian before publishing">
              <Link className="text-link" to="/connection">Open connection settings</Link>
            </PageState>
          )}
          {actionError && <PageState kind="error" title="Publication needs attention">{actionError}</PageState>}
          {report.warnings.length > 0 && (
            <aside className="inline-warning" aria-label="Report source warnings">
              <strong>Report warning</strong>
              {report.warnings.map((warning, index) => (
                <span key={`${warning.code}-${index}`}>{warning.message}</span>
              ))}
            </aside>
          )}
          <section className="panel workflow-panel publication-panel">
            <div className="publication-actor">
              Publishing as{" "}
              <strong>
                {connection?.connected
                  ? connection.account.displayName || connection.account.id
                  : "unavailable"}
              </strong>
            </div>
            <label>
              Search Confluence spaces by key
              <input
                value={spaceQuery}
                onChange={(event) => setSpaceQuery(event.target.value)}
                maxLength={100}
                disabled={report.status !== "approved"}
              />
            </label>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => searchSpaces()}
              disabled={
                report.status !== "approved" ||
                spaceState === "loading" ||
                spaceState === "loading-more"
              }
            >
              Search spaces
            </button>
            {spaceState === "loading" && <PageState kind="loading" title="Loading Confluence spaces" />}
            {spaceState === "error" && <PageState kind="error" title="Spaces could not be loaded">{actionError}</PageState>}
            <label>
              Confluence space
              <select
                value={spaceId}
                onChange={(event) => {
                  setSpaceId(event.target.value);
                  setParentPageId("");
                  setPages([]);
                  setPageCursor(null);
                  setPageState("idle");
                }}
                disabled={report.status !== "approved"}
                required
              >
                <option value="">Choose a space</option>
                {spaces.map((space) => (
                  <option value={space.id} key={space.id}>
                    {space.key} — {space.name}
                  </option>
                ))}
              </select>
            </label>
            {spaceCursor && (
              <button
                className="text-button"
                type="button"
                onClick={() => searchSpaces(spaceCursor)}
                disabled={spaceState === "loading-more"}
              >
                {spaceState === "loading-more" ? "Loading spaces…" : "Load more spaces"}
              </button>
            )}
            {spaceId && (
              <>
                <label>
                  Search parent pages
                  <input
                    value={pageQuery}
                    onChange={(event) => setPageQuery(event.target.value)}
                    maxLength={100}
                    disabled={report.status !== "approved"}
                  />
                </label>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => searchParentPages()}
                  disabled={
                    report.status !== "approved" ||
                    pageState === "loading" ||
                    pageState === "loading-more"
                  }
                >
                  Load parent pages
                </button>
                {pageState === "loading" && <PageState kind="loading" title="Loading parent pages" />}
                {pageState === "error" && <PageState kind="error" title="Parent pages could not be loaded">{actionError}</PageState>}
                {pageState === "ready" && (
                  <label>
                    Parent page
                    <select
                      value={parentPageId}
                      onChange={(event) => setParentPageId(event.target.value)}
                      required
                    >
                      <option value="">Choose a parent page</option>
                      {pages.map((page) => (
                        <option value={page.id} key={page.id}>{page.title}</option>
                      ))}
                    </select>
                  </label>
                )}
                {pageCursor && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => searchParentPages(pageCursor)}
                    disabled={pageState === "loading-more"}
                  >
                    {pageState === "loading-more" ? "Loading pages…" : "Load more parent pages"}
                  </button>
                )}
              </>
            )}
            <div className="proposed-title">
              <span>Proposed page title</span>
              <strong>{pageTitle}</strong>
              <small>{pageTitle.length}/255 characters</small>
            </div>
            {titleConflict && (
              <label>
                Add a disambiguating title suffix after reviewing the collision
                <input
                  value={titleSuffix}
                  onChange={(event) => setTitleSuffix(event.target.value)}
                  maxLength={150}
                  required
                />
              </label>
            )}
            <section className="markdown-preview" aria-labelledby="publication-preview-heading">
              <div className="preview-heading">
                <h2 id="publication-preview-heading">Report preview</h2>
                <span>{report.lineCount}/20 lines</span>
              </div>
              <pre>{report.markdown}</pre>
            </section>
            {report.status === "published" ? (
              <div className="publication-result" role="status">
                <strong>Publication confirmed</strong>
                <a href={report.confluencePageUrl} target="_blank" rel="noreferrer">
                  Open {report.confluencePageTitle || "published Confluence page"}
                </a>
              </div>
            ) : (
              <button
                className="button button-primary"
                type="button"
                onClick={publish}
                disabled={
                  report.status !== "approved" ||
                  !connection?.connected ||
                  !spaceId ||
                  !parentPageId ||
                  publishing
                }
              >
                {publishing ? "Publishing…" : "Publish approved report"}
              </button>
            )}
            <p>
              <Link className="text-link" to={`/reports/${encodeURIComponent(report.id)}/review`}>
                Back to report review
              </Link>
            </p>
          </section>
        </>
      )}
    </>
  );
}
