export default function PageState({ kind, title, children }) {
  if (!["loading", "empty", "error"].includes(kind)) {
    throw new Error(`Unsupported page state: ${kind}`);
  }

  return (
    <section
      className={`panel page-state page-state-${kind}`}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </section>
  );
}
