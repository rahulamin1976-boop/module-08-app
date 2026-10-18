import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";

const navigation = [
  { to: "/", label: "Weekly reports", end: true },
  { to: "/reports/new", label: "Create report" },
  { to: "/connection", label: "Atlassian connection" },
];

export default function AppLayout({ children }) {
  const [backendState, setBackendState] = useState("checking");

  useEffect(() => {
    let current = true;
    fetch("/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend health check failed.");
        }
        return response.json();
      })
      .then((result) => {
        if (current) {
          setBackendState(result.status === "ok" ? "online" : "unavailable");
        }
      })
      .catch(() => {
        if (current) {
          setBackendState("unavailable");
        }
      });

    return () => {
      current = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Application navigation">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>
            <strong>Weekly Status</strong>
            <small>Atlassian automation</small>
          </span>
        </Link>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="primary-nav">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`status-dot ${backendState}`} aria-hidden="true" />
          <span>
            Backend{" "}
            {backendState === "checking"
              ? "checking"
              : backendState === "online"
                ? "online"
                : "unavailable"}
          </span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <span>Leadership reporting</span>
          <span className="local-badge">Local prototype</span>
        </header>
        <main id="main-content" className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
