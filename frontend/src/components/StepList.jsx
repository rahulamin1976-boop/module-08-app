export default function StepList({ steps }) {
  return (
    <ol className="step-list">
      {steps.map((step) => (
        <li key={step.title}>
          <span className="step-number" aria-hidden="true">{step.number}</span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
