import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeading from "../components/PageHeading.jsx";
import PageState from "../components/PageState.jsx";
import ReportItemEditor from "../components/ReportItemEditor.jsx";
import { ApiError, apiRequest } from "../services/api-client.js";

const categories = [
  { value: "accomplishment", label: "Accomplishments" },
  { value: "blocker", label: "Blockers" },
  { value: "next_week", label: "Next week" },
];

export default function ReviewReportPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [items, setItems] = useState([]);
  const [confirmedEmptyCategories, setConfirmedEmptyCategories] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState("");
  const [action, setAction] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(`/api/v1/reports/${encodeURIComponent(reportId)}`);
      setReport(result);
      setItems(result.items);
      setConfirmedEmptyCategories(result.confirmedEmptyCategories);
      setConflict("");
      setActionError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest(`/api/v1/reports/${encodeURIComponent(reportId)}`)
      .then((result) => {
        if (active) {
          setReport(result);
          setItems(result.items);
          setConfirmedEmptyCategories(result.confirmedEmptyCategories);
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
  }, [reportId]);

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/integrations/atlassian")
      .then((result) => {
        if (active) setConnection(result);
      })
      .catch((requestError) => {
        if (active) setConnectionError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const sourceAvailability = report?.sourceSnapshot?.jiraStatus === "unavailable"
    ? "unavailable"
    : "available";
  const markdown = useMemo(() => report
    ? renderMarkdown(items, confirmedEmptyCategories, sourceAvailability)
    : "", [items, confirmedEmptyCategories, report, sourceAvailability]);
  const lineCount = markdown ? markdown.split("\n").length : 0;
  const itemCategories = new Set(items.map(({ category }) => category));
  const unconfirmed = categories
    .filter(({ value }) =>
      !itemCategories.has(value) &&
      !confirmedEmptyCategories.includes(value) &&
      sourceAvailability !== "unavailable",
    )
    .map(({ label }) => label);
  const ready = unconfirmed.length === 0 && lineCount <= 20;
  const dirty = Boolean(report) && (
    JSON.stringify(items) !== JSON.stringify(report.items) ||
    JSON.stringify(confirmedEmptyCategories) !==
      JSON.stringify(report.confirmedEmptyCategories)
  );

  function changeItem(itemId, patch) {
    setItems((current) => current.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item,
    ));
    if (patch.category) {
      setConfirmedEmptyCategories((current) =>
        current.filter((category) => category !== patch.category),
      );
    }
  }

  function removeItem(itemId) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function toggleEmptyCategory(category, checked) {
    setConfirmedEmptyCategories((current) => checked
      ? [...new Set([...current, category])]
      : current.filter((value) => value !== category));
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!report || !dirty) return;
    setAction("save");
    setActionError("");
    setConflict("");
    try {
      const updated = await apiRequest(`/api/v1/reports/${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        body: {
          version: report.version,
          items: items.map(({ id, category, text, owner }) => ({
            id,
            category,
            text: text.trim(),
            ...(owner ? { owner: owner.trim() } : {}),
          })),
          confirmedEmptyCategories,
        },
      });
      setReport(updated);
      setItems(updated.items);
      setConfirmedEmptyCategories(updated.confirmedEmptyCategories);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === "STALE_VERSION") {
        setConflict(requestError.message);
      } else {
        setActionError(requestError.message);
      }
    } finally {
      setAction("");
    }
  }

  async function approve() {
    if (!report || !ready || dirty || !connection?.connected) return;
    setAction("approve");
    setActionError("");
    try {
      const updated = await apiRequest(
        `/api/v1/reports/${encodeURIComponent(report.id)}/approve`,
        { method: "POST", body: { confirm: true } },
      );
      setReport(updated);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setAction("");
    }
  }

  async function withdraw() {
    if (!report) return;
    if (!window.confirm("Withdraw approval and return this report to draft?")) return;
    setAction("withdraw");
    setActionError("");
    try {
      const updated = await apiRequest(
        `/api/v1/reports/${encodeURIComponent(report.id)}/withdraw-approval`,
        { method: "POST", body: { confirm: true } },
      );
      setReport(updated);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setAction("");
    }
  }

  async function removeReport() {
    const remoteNote = report?.confluencePageId
      ? " The published Confluence page will remain in place."
      : "";
    if (!window.confirm(`Delete this local report and its audit history?${remoteNote}`)) {
      return;
    }
    setAction("delete");
    setActionError("");
    try {
      await apiRequest(`/api/v1/reports/${encodeURIComponent(report.id)}`, {
        method: "DELETE",
        body: { confirm: true },
      });
      navigate("/");
    } catch (requestError) {
      setActionError(requestError.message);
      setAction("");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="STEP 2 OF 3"
        title="Review report"
        description="Review source facts, correct the draft, and confirm its empty sections."
      />
      {loading && <PageState kind="loading" title="Loading report" />}
      {!loading && error && <PageState kind="error" title="Draft review is unavailable">{error}</PageState>}
      {!loading && report && (
        <>
          <section className="panel report-summary">
            <div>
              <p className="report-project">{report.project.key} · {report.project.name}</p>
              <h2>{report.periodStart} to {report.periodEnd}</h2>
              <p className="report-meta">Time zone: {report.timezone} · Report version {report.version}</p>
            </div>
            <span className={`tag report-status report-status-${report.status}`}>
              {report.status.replaceAll("_", " ")}
            </span>
            <dl className="report-actors">
              <div><dt>Created by</dt><dd>{report.createdByAccountId}</dd></div>
              <div><dt>Last edited by</dt><dd>{report.lastEditedByAccountId || "No edits yet"}</dd></div>
              <div><dt>Approved by</dt><dd>{report.approvedByAccountId || "Not approved"}</dd></div>
              <div>
                <dt>Acting account</dt>
                <dd>{connection?.connected
                  ? connection.account.displayName || connection.account.id
                  : "Not connected"}
                </dd>
              </div>
            </dl>
          </section>
          {connectionError && (
            <PageState kind="error" title="Acting account could not be verified">{connectionError}</PageState>
          )}
          {report.warnings.length > 0 && (
            <aside className="inline-warning" aria-label="Report source warnings">
              <strong>Source warning</strong>
              {report.warnings.map((warning, index) => (
                <span key={`${warning.code}-${index}`}>{warning.message}</span>
              ))}
            </aside>
          )}
          {conflict && (
            <>
              <PageState kind="error" title="This draft changed elsewhere">
                {conflict}
              </PageState>
              <button className="button button-secondary" type="button" onClick={loadReport}>
                Reload latest report
              </button>
            </>
          )}
          {actionError && <PageState kind="error" title="Report action failed">{actionError}</PageState>}
          {report.status === "draft" ? (
            <form className="panel workflow-panel review-panel" onSubmit={saveDraft}>
              <div className="panel-heading">
                <div>
                  <h2>Report items</h2>
                  <p>Source snapshots stay unchanged when you edit report wording.</p>
                </div>
                <span className="tag">{items.length} update{items.length === 1 ? "" : "s"}</span>
              </div>
              {items.length > 0 ? items.map((item) => (
                <ReportItemEditor
                  item={item}
                  key={item.id}
                  onChange={changeItem}
                  onRemove={removeItem}
                />
              )) : <p className="muted-copy">No report items. Add facts on the create-report screen.</p>}
              <fieldset
                className="empty-confirmations"
                disabled={sourceAvailability === "unavailable"}
              >
                <legend>Confirm empty sections</legend>
                <p>Confirm only sections with no items after reviewing the available source data.</p>
                {categories.map(({ value, label }) => (
                  <label key={value}>
                    <input
                      name={`confirmEmpty.${value}`}
                      type="checkbox"
                      checked={confirmedEmptyCategories.includes(value)}
                      disabled={itemCategories.has(value)}
                      onChange={(event) =>
                        toggleEmptyCategory(value, event.target.checked)
                      }
                    />
                    No items in {label.toLowerCase()}
                  </label>
                ))}
              </fieldset>
              {unconfirmed.length > 0 && (
                <p className="inline-warning" role="status">
                  Confirm or add items for: {unconfirmed.join(", ")}.
                </p>
              )}
              {lineCount > 20 && (
                <p className="inline-warning" role="alert">
                  Preview has {lineCount} lines. Remove or shorten content before approval.
                </p>
              )}
              <section className="markdown-preview" aria-labelledby="markdown-heading">
                <div className="preview-heading">
                  <h2 id="markdown-heading">Markdown preview</h2>
                  <span>{lineCount}/20 lines</span>
                </div>
                <pre>{markdown}</pre>
              </section>
              <div className="review-actions">
                <button
                  className="button button-secondary"
                  type="submit"
                  disabled={!dirty || action === "save"}
                >
                  {action === "save" ? "Saving draft…" : "Save draft"}
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={approve}
                  disabled={
                    !ready ||
                    dirty ||
                    !connection?.connected ||
                    Boolean(action)
                  }
                >
                  {action === "approve" ? "Approving…" : "Approve draft"}
                </button>
              </div>
            </form>
          ) : (
            <section className="panel workflow-panel review-panel">
              <section className="markdown-preview" aria-labelledby="markdown-heading">
                <div className="preview-heading">
                  <h2 id="markdown-heading">Approved report</h2>
                  <span>{lineCount}/20 lines</span>
                </div>
                <pre>{markdown}</pre>
              </section>
              <div className="review-actions">
                {report.status === "approved" && (
                  <>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={withdraw}
                      disabled={Boolean(action)}
                    >
                      Withdraw approval to edit
                    </button>
                    <Link
                      className="button button-primary"
                      to={`/reports/${encodeURIComponent(report.id)}/publish`}
                    >
                      Choose destination and publish
                    </Link>
                  </>
                )}
                {report.confluencePageUrl && (
                  <a
                    className="button button-secondary"
                    href={report.confluencePageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open published Confluence page
                  </a>
                )}
              </div>
            </section>
          )}
          <div className="review-footer">
            <Link className="text-link" to="/">Back to weekly reports</Link>
            <button
              className="text-button text-button-danger"
              type="button"
              onClick={removeReport}
              disabled={report.status === "publishing" || Boolean(action)}
            >
              Delete local report
              {report.confluencePageId && " (Confluence page remains)"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function renderMarkdown(items, confirmed, sourceAvailability) {
  return categories.map(({ value, label }) => {
    const categoryItems = items.filter((item) => item.category === value);
    const lines = categoryItems.map(({ text }) => `- ${String(text).replace(/\s+/g, " ").trim()}`);
    if (lines.length === 0 && confirmed.includes(value)) {
      lines.push("- No items reported.");
    } else if (lines.length === 0 && sourceAvailability === "unavailable") {
      lines.push("- Jira data unavailable; manually confirm this section.");
    } else if (lines.length === 0) {
      lines.push("- Confirm whether this section has any items.");
    }
    return [`## ${label}`, ...lines].join("\n");
  }).join("\n\n");
}
