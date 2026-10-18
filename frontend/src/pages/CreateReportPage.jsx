import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import JiraCandidateList from "../components/JiraCandidateList.jsx";
import ManualUpdateForm from "../components/ManualUpdateForm.jsx";
import PageHeading from "../components/PageHeading.jsx";
import PageState from "../components/PageState.jsx";
import { apiRequest } from "../services/api-client.js";

const categories = [
  { value: "accomplishment", label: "Accomplishments" },
  { value: "blocker", label: "Blockers and risks" },
  { value: "next_week", label: "Next week" },
];

export default function CreateReportPage() {
  const navigate = useNavigate();
  const [connection, setConnection] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectCursor, setProjectCursor] = useState(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectSearchState, setProjectSearchState] = useState("loading");
  const [projectId, setProjectId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [candidates, setCandidates] = useState([]);
  const [candidateCursor, setCandidateCursor] = useState(null);
  const [candidateState, setCandidateState] = useState("idle");
  const [candidateError, setCandidateError] = useState("");
  const [selected, setSelected] = useState({});
  const [manualUpdates, setManualUpdates] = useState([]);
  const [confirmedEmptyCategories, setConfirmedEmptyCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/integrations/atlassian")
      .then((result) => {
        if (active) setConnection(result);
      })
      .catch((error) => {
        if (active) setConnectionError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!connection?.connected) return undefined;
    let active = true;
    setProjectSearchState("loading");
    apiRequest("/api/v1/jira/projects?limit=50")
      .then((result) => {
        if (active) {
          setProjects(result.items);
          setProjectCursor(result.nextCursor);
          setProjectSearchState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setProjectSearchState("error");
          setConnectionError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [connection]);

  useEffect(() => {
    setCandidates([]);
    setCandidateCursor(null);
    setCandidateState("idle");
    setCandidateError("");
    setSelected({});
    setConfirmedEmptyCategories([]);
  }, [projectId, periodStart, periodEnd, timezone]);

  const occupiedCategories = useMemo(() => {
    const occupied = new Set(manualUpdates.map((item) => item.category).filter(Boolean));
    Object.values(selected).forEach((item) => {
      if (item.category) occupied.add(item.category);
    });
    return occupied;
  }, [manualUpdates, selected]);

  const canConfirmEmpty = candidateState === "ready" && candidateCursor === null;

  async function searchProjects(event, cursor = null) {
    event?.preventDefault();
    setProjectSearchState(cursor ? "loading-more" : "loading");
    setConnectionError("");
    const params = new URLSearchParams({ limit: "50" });
    if (projectQuery.trim()) params.set("query", projectQuery.trim());
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await apiRequest(`/api/v1/jira/projects?${params}`);
      setProjects((current) => cursor ? [...current, ...result.items] : result.items);
      setProjectCursor(result.nextCursor);
      setProjectSearchState("ready");
    } catch (error) {
      setProjectSearchState("error");
      setConnectionError(error.message);
    }
  }

  async function loadUpdates(cursor = null) {
    if (!projectId || !periodStart || !periodEnd || !timezone.trim()) return;
    setCandidateState(cursor ? "loading-more" : "loading");
    setCandidateError("");
    const params = new URLSearchParams({
      from: periodStart,
      to: periodEnd,
      timezone: timezone.trim(),
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await apiRequest(
        `/api/v1/jira/projects/${encodeURIComponent(projectId)}/updates?${params}`,
      );
      setCandidates((current) => cursor ? [...current, ...result.items] : result.items);
      setCandidateCursor(result.nextCursor);
      setCandidateState("ready");
    } catch (error) {
      setCandidateState("error");
      setCandidateError(error.message);
    }
  }

  function toggleCandidate(candidate, checked) {
    setSelected((current) => {
      const next = { ...current };
      if (checked) {
        next[candidate.issueId] = { ...candidate, category: "" };
      } else {
        delete next[candidate.issueId];
      }
      return next;
    });
  }

  function changeCandidateCategory(candidate, category) {
    setSelected((current) => ({
      ...current,
      [candidate.issueId]: { ...current[candidate.issueId], category },
    }));
    setConfirmedEmptyCategories((current) =>
      current.filter((value) => value !== category),
    );
  }

  function changeManualUpdates(updates) {
    setManualUpdates(updates);
    const populated = new Set(updates.map((item) => item.category).filter(Boolean));
    setConfirmedEmptyCategories((current) =>
      current.filter((category) => !populated.has(category)),
    );
  }

  function toggleEmptyCategory(category, checked) {
    setConfirmedEmptyCategories((current) =>
      checked
        ? [...new Set([...current, category])]
        : current.filter((value) => value !== category),
    );
  }

  async function submitReport(event) {
    event.preventDefault();
    setSaveError("");
    if (!projectId) {
      setSaveError("Choose a Jira project.");
      return;
    }
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setSaveError("Choose a valid reporting date range.");
      return;
    }
    if (Object.values(selected).some((item) => !item.category)) {
      setSaveError("Choose a report category for every selected Jira issue.");
      return;
    }
    if (manualUpdates.some((item) =>
      !item.category ||
      !item.text.trim() ||
      item.text.trim().length > 2000 ||
      item.owner.trim().length > 120,
    )) {
      setSaveError("Complete each manual update and stay within its field limits.");
      return;
    }

    setSaving(true);
    try {
      const report = await apiRequest("/api/v1/reports", {
        method: "POST",
        body: {
          projectId,
          periodStart,
          periodEnd,
          timezone: timezone.trim(),
          jiraUpdates: Object.values(selected).map(
            ({ issueId, issueKey, category }) => ({ issueId, issueKey, category }),
          ),
          manualUpdates: manualUpdates.map(({ category, text, owner }) => ({
            category,
            text: text.trim(),
            ...(owner.trim() ? { owner: owner.trim() } : {}),
          })),
          confirmedEmptyCategories,
        },
      });
      navigate(`/reports/${encodeURIComponent(report.id)}/review`);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="STEP 1 OF 3"
        title="Create a report"
        description="Choose a project and reporting period, then select verified updates."
      />
      {connectionError && (
        <PageState kind="error" title="Atlassian data is unavailable">
          {connectionError}
        </PageState>
      )}
      {!connection && !connectionError && (
        <PageState kind="loading" title="Checking Atlassian connection" />
      )}
      {connection && !connection.connected && (
        <PageState kind="error" title="Connect Atlassian before creating a report">
          <Link className="text-link" to="/connection">Open connection settings</Link>
        </PageState>
      )}
      <form className="panel workflow-panel" onSubmit={submitReport}>
        <div className="panel-heading">
          <div>
            <h2>Report details</h2>
            <p>Choose the Jira project, reporting dates, and timezone.</p>
          </div>
          <span className="tag">Draft setup</span>
        </div>
        {connection?.connected && (
          <div className="project-search">
            <label>
              Search Jira projects
              <input
                name="projectQuery"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                maxLength={100}
              />
            </label>
            <button
              className="button button-secondary"
              type="button"
              onClick={(event) => searchProjects(event)}
              disabled={projectSearchState === "loading" || projectSearchState === "loading-more"}
            >
              Search projects
            </button>
          </div>
        )}
        <div className="form-grid">
          <label>
            Jira project
            <select
              name="projectId"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={!connection?.connected || projectSearchState === "loading"}
              required
            >
              <option value="">Choose a project</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.key} — {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time zone
            <input
              name="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="UTC"
              required
            />
          </label>
          <label>
            Period start
            <input
              name="periodStart"
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              required
            />
          </label>
          <label>
            Period end
            <input
              name="periodEnd"
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              min={periodStart || undefined}
              required
            />
          </label>
        </div>
        {projectCursor && (
          <button
            className="text-button"
            type="button"
            onClick={(event) => searchProjects(event, projectCursor)}
            disabled={projectSearchState === "loading-more"}
          >
            Load more projects
          </button>
        )}
        {connection?.connected && (
          <section className="candidate-section" aria-labelledby="candidate-heading">
            <div className="section-title-row">
              <div>
                <h2 id="candidate-heading">Jira updates</h2>
                <p>Select issues and explicitly place each one in the report.</p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => loadUpdates()}
                disabled={
                  !projectId ||
                  !periodStart ||
                  !periodEnd ||
                  !timezone.trim() ||
                  periodStart > periodEnd ||
                  candidateState === "loading" ||
                  candidateState === "loading-more"
                }
              >
                {candidateState === "loading" ? "Loading updates…" : "Load Jira updates"}
              </button>
            </div>
            {candidateState === "loading" && (
              <PageState kind="loading" title="Loading Jira updates" />
            )}
            {candidateState === "error" && (
              <PageState kind="error" title="Jira updates could not be loaded">
                {candidateError}
              </PageState>
            )}
            {(candidateState === "ready" || candidateState === "loading-more") && (
              <>
                <JiraCandidateList
                  candidates={candidates}
                  selected={selected}
                  onSelect={toggleCandidate}
                  onCategoryChange={changeCandidateCategory}
                />
                {candidateCursor && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => loadUpdates(candidateCursor)}
                    disabled={candidateState === "loading-more"}
                  >
                    {candidateState === "loading-more"
                      ? "Loading more Jira updates…"
                      : "Load more Jira updates"}
                  </button>
                )}
                <fieldset
                  className="empty-confirmations"
                  disabled={!canConfirmEmpty}
                >
                  <legend>Confirm empty sections</legend>
                  <p>Only confirm a section after reviewing all Jira result pages.</p>
                  {categories.map(({ value, label }) => (
                    <label key={value}>
                      <input
                        name={`confirmEmpty.${value}`}
                        type="checkbox"
                        checked={confirmedEmptyCategories.includes(value)}
                        disabled={occupiedCategories.has(value)}
                        onChange={(event) =>
                          toggleEmptyCategory(value, event.target.checked)
                        }
                      />
                      No {label.toLowerCase()} to report
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {candidateState === "idle" && (
              <p className="muted-copy">
                Choose a project and date range, then load Jira updates.
              </p>
            )}
          </section>
        )}
        {connection?.connected && candidateState === "error" && (
          <p className="inline-warning" role="status">
            Jira is unavailable. You can still save a report with manual updates;
            the backend will persist an unavailable-source warning.
          </p>
        )}
        <ManualUpdateForm updates={manualUpdates} onChange={changeManualUpdates} disabled={saving} />
        {saveError && <PageState kind="error" title="Report was not saved">{saveError}</PageState>}
        <button
          className="button button-primary"
          type="submit"
          disabled={saving || !connection?.connected}
        >
          {saving ? "Saving draft…" : "Save draft"}
        </button>
      </form>
    </>
  );
}
