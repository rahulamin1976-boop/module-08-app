const categories = [
  { value: "accomplishment", label: "Accomplishment" },
  { value: "blocker", label: "Blocker / risk" },
  { value: "next_week", label: "Next week" },
];

export default function ManualUpdateForm({ updates, onChange, disabled = false }) {
  function update(index, patch) {
    onChange(updates.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ));
  }

  function remove(index) {
    onChange(updates.filter((_item, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="manual-updates" aria-labelledby="manual-updates-heading">
      <div className="section-title-row">
        <div>
          <h2 id="manual-updates-heading">Manual updates</h2>
          <p>Add facts that are not represented by a selected Jira issue.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={disabled}
          onClick={() => onChange([...updates, { category: "", text: "", owner: "" }])}
        >
          Add update
        </button>
      </div>
      {updates.map((item, index) => (
        <fieldset className="manual-update" key={`manual-${index}`}>
          <legend>Manual update {index + 1}</legend>
          <label>
            Category
            <select
              value={item.category}
              onChange={(event) => update(index, { category: event.target.value })}
              required
              disabled={disabled}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option value={category.value} key={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Update text
            <textarea
              value={item.text}
              onChange={(event) => update(index, { text: event.target.value })}
              maxLength={2000}
              rows="3"
              required
              disabled={disabled}
            />
            <small>{item.text.length}/2000 characters</small>
          </label>
          <label>
            Owner (optional)
            <input
              value={item.owner}
              onChange={(event) => update(index, { owner: event.target.value })}
              maxLength={120}
              disabled={disabled}
            />
          </label>
          <button
            className="text-button"
            type="button"
            onClick={() => remove(index)}
            disabled={disabled}
          >
            Remove update
          </button>
        </fieldset>
      ))}
      {updates.length === 0 && (
        <p className="muted-copy">No manual updates added.</p>
      )}
    </section>
  );
}
