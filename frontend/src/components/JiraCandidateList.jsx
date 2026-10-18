export default function JiraCandidateList({
  candidates,
  selected,
  onSelect,
  onCategoryChange,
}) {
  if (candidates.length === 0) {
    return <p className="muted-copy">No Jira updates match this reporting period.</p>;
  }

  return (
    <ul className="candidate-list">
      {candidates.map((candidate) => {
        const selection = selected[candidate.issueId];
        const selectionId = `select-${candidate.issueId}`;
        const categoryId = `category-${candidate.issueId}`;
        return (
          <li className="candidate-item" key={candidate.issueId}>
            <label className="candidate-select" htmlFor={selectionId}>
              <input
                id={selectionId}
                type="checkbox"
                checked={Boolean(selection)}
                onChange={(event) =>
                  onSelect(candidate, event.target.checked)
                }
              />
              <span>
                <strong>{candidate.issueKey}</strong>
                <span>{candidate.summary}</span>
                <small>
                  {candidate.status || "Status unavailable"}
                  {candidate.assignee ? ` · ${candidate.assignee}` : ""}
                  {candidate.updatedAt
                    ? ` · Updated ${new Date(candidate.updatedAt).toLocaleString()}`
                    : ""}
                </small>
              </span>
            </label>
            {selection && (
              <label className="candidate-category" htmlFor={categoryId}>
                Report category
                <select
                  id={categoryId}
                  value={selection.category}
                  onChange={(event) =>
                    onCategoryChange(candidate, event.target.value)
                  }
                  required
                >
                  <option value="">Choose a category</option>
                  <option value="accomplishment">Accomplishment</option>
                  <option value="blocker">Blocker / risk</option>
                  <option value="next_week">Next week</option>
                </select>
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}
