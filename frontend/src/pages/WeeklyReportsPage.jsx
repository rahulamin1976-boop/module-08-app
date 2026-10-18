import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeading from "../components/PageHeading.jsx";
import PageState from "../components/PageState.jsx";
import StepList from "../components/StepList.jsx";
import { apiRequest } from "../services/api-client.js";

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/reports?limit=50")
      .then((result) => {
        if (active) {
          setReports(result.items);
          setCursor(result.nextCursor);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const params = new URLSearchParams({ limit: "50", cursor });
      const result = await apiRequest(`/api/v1/reports?${params}`);
      setReports((current) => [...current, ...result.items]);
      setCursor(result.nextCursor);
    } catch (requestError) {
      setMoreError(requestError.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="REPORTING WORKSPACE"
        title="Weekly reports"
        description="Prepare evidence-based updates for your leadership team."
      >
        <Link className="button button-primary" to="/reports/new">
          Create a report <span aria-hidden="true">→</span>
        </Link>
      </PageHeading>
      {loading && <PageState kind="loading" title="Loading reports" />}
      {!loading && error && (
        <PageState kind="error" title="Reports could not be loaded">{error}</PageState>
      )}
      {!loading && !error && reports.length === 0 && (
        <>
          <PageState kind="empty" title="Your reports will appear here">
            Connect Atlassian and create a report to review saved projects, reporting
            periods, and publication status.
          </PageState>
          <p>
            <Link className="text-link" to="/connection">
              Set up Atlassian connection
            </Link>
          </p>
        </>
      )}
      {!loading && !error && reports.length > 0 && (
        <section className="report-list" aria-label="Saved weekly reports">
          {reports.map((report) => (
            <article className="panel report-card" key={report.id}>
              <div>
                <p className="report-project">
                  {report.project.key} · {report.project.name}
                </p>
                <h2>
                  {report.periodStart} to {report.periodEnd}
                </h2>
                <p className="report-meta">
                  Time zone: {report.timezone} · Updated {formatDateTime(report.updatedAt)}
                </p>
              </div>
              <span className={`tag report-status report-status-${report.status}`}>
                {formatStatus(report.status)}
              </span>
              <Link
                className="button button-secondary"
                to={`/reports/${encodeURIComponent(report.id)}/review`}
              >
                Open report
              </Link>
            </article>
          ))}
          {moreError && <PageState kind="error" title="More reports could not be loaded">{moreError}</PageState>}
          {cursor && (
            <button
              className="button button-secondary"
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading reports…" : "Load more reports"}
            </button>
          )}
        </section>
      )}
      <section className="section-block" aria-labelledby="workflow-title">
        <p className="eyebrow" id="workflow-title">REPORT WORKFLOW</p>
        <StepList steps={[
          { number: "01", title: "Choose project and period", description: "Select Jira evidence and add manual updates." },
          { number: "02", title: "Review your draft", description: "Check sources, correct facts, and confirm empty sections." },
          { number: "03", title: "Approve and publish", description: "Choose a Confluence destination and confirm publication." },
        ]} />
      </section>
    </>
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "time unavailable" : date.toLocaleString();
}

function formatStatus(status) {
  return status.replaceAll("_", " ");
}
