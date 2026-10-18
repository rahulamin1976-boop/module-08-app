const categories = [
  { value: "accomplishment", label: "Accomplishments" },
  { value: "blocker", label: "Blockers and risks" },
  { value: "next_week", label: "Next week" },
];

export default function ReportItemEditor({ item, onChange, onRemove }) {
  const textId = `item-text-${item.id}`;
  const categoryId = `item-category-${item.id}`;
  const ownerId = `item-owner-${item.id}`;
  const sourceLabel = item.sourceType === "jira"
    ? `Jira issue ${item.sourceReference}`
    : item.sourceType === "user_edited"
      ? "User-edited update"
      : "Manual update";

  return (
    <article className="report-item-editor">
      <div className="report-item-heading">
        <div>
          <strong>{sourceLabel}</strong>
          <span>{item.editedByAccountId ? `Last edited by ${item.editedByAccountId}` : "Original source details preserved"}</span>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onRemove(item.id)}
        >
          Remove update
        </button>
      </div>
      <label htmlFor={categoryId}>
        Category
        <select
          id={categoryId}
          value={item.category}
          onChange={(event) => onChange(item.id, { category: event.target.value })}
        >
          {categories.map((category) => (
            <option value={category.value} key={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={textId}>
        Update text
        <textarea
          id={textId}
          value={item.text}
          maxLength={2000}
          required
          rows="3"
          onChange={(event) => onChange(item.id, { text: event.target.value })}
        />
        <small>{item.text.length}/2000 characters</small>
      </label>
      <label htmlFor={ownerId}>
        Owner (optional)
        <input
          id={ownerId}
          value={item.owner ?? ""}
          maxLength={120}
          onChange={(event) => onChange(item.id, { owner: event.target.value })}
        />
      </label>
      {item.sourceSnapshot && (
        <details className="source-details">
          <summary>Source details</summary>
          <dl>
            <div><dt>Issue</dt><dd>{item.sourceSnapshot.issueKey}</dd></div>
            <div><dt>Summary at retrieval</dt><dd>{item.sourceSnapshot.summary}</dd></div>
            <div><dt>Status at retrieval</dt><dd>{item.sourceSnapshot.status}</dd></div>
            <div><dt>Assignee at retrieval</dt><dd>{item.sourceSnapshot.assignee || "Unassigned"}</dd></div>
            <div><dt>Last updated at source</dt><dd>{item.sourceSnapshot.updatedAt}</dd></div>
            {isSafeUrl(item.sourceSnapshot.url) && (
              <div>
                <dt>Source link</dt>
                <dd>
                  <a href={item.sourceSnapshot.url} target="_blank" rel="noreferrer">
                    Open Jira issue
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </article>
  );
}

function isSafeUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
