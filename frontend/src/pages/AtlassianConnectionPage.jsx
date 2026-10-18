import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PageHeading from "../components/PageHeading.jsx";
import PageState from "../components/PageState.jsx";
import { apiRequest } from "../services/api-client.js";

const oauthOutcomes = {
  connected: { kind: "success", text: "Atlassian account connected." },
  authorization_denied: { kind: "warning", text: "Atlassian authorization was declined." },
  authorization_failed: { kind: "error", text: "Atlassian authorization could not be completed." },
  invalid_state: { kind: "error", text: "The sign-in session expired or could not be verified. Start again." },
  account_switch_confirmation_required: {
    kind: "warning",
    text: "The connected account was not changed. Confirm the account switch and try again.",
  },
  site_selection_required: {
    kind: "error",
    text: "This Atlassian account must have exactly one accessible Jira site.",
  },
};

export default function AtlassianConnectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [outcomeMessage, setOutcomeMessage] = useState("");
  const [outcomeKind, setOutcomeKind] = useState("info");
  const [switchConfirmed, setSwitchConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/integrations/atlassian")
      .then((result) => {
        if (active) setConnection(result);
      })
      .catch((error) => {
        if (active) setActionError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const outcome = searchParams.get("oauth");
    if (!outcome) return;
    const result = oauthOutcomes[outcome];
    setOutcomeKind(result?.kind ?? "info");
    setOutcomeMessage(
      result?.text ?? "Atlassian returned an unknown authorization result. Start again if needed.",
    );
    navigate(location.pathname, { replace: true });
  }, [location.pathname, navigate, searchParams]);

  async function startConnection() {
    setAction("connect");
    setActionError("");
    try {
      const result = await apiRequest("/api/v1/integrations/atlassian/oauth/start", {
        method: "POST",
        body: connection?.connected
          ? { confirmAccountSwitch: true }
          : {},
      });
      const authorizationUrl = new URL(result.authorizationUrl);
      if (
        authorizationUrl.protocol !== "https:" ||
        authorizationUrl.hostname !== "auth.atlassian.com"
      ) {
        throw new Error("The server returned an invalid Atlassian authorization URL.");
      }
      window.location.assign(authorizationUrl.toString());
    } catch (error) {
      setActionError(error.message);
      setAction("");
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this Atlassian account from the local app?")) {
      return;
    }
    setAction("disconnect");
    setActionError("");
    setOutcomeMessage("");
    try {
      const result = await apiRequest("/api/v1/integrations/atlassian", {
        method: "DELETE",
      });
      setConnection({ connected: false });
      setSwitchConfirmed(false);
      setOutcomeKind("warning");
      setOutcomeMessage(
        result.providerRevoked
          ? "Disconnected. Atlassian confirmed token revocation."
          : "Disconnected locally. Atlassian token revocation could not be confirmed.",
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setAction("");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="INTEGRATIONS"
        title="Atlassian connection"
        description="Authorize this local app to read Jira updates and publish approved reports."
      />
      {loading && <PageState kind="loading" title="Checking Atlassian connection" />}
      {!loading && actionError && (
        <PageState kind="error" title="Atlassian connection action failed">
          {actionError}
        </PageState>
      )}
      {outcomeMessage && (
        <p className={`connection-notice connection-notice-${outcomeKind}`} role="status">
          {outcomeMessage}
        </p>
      )}
      {!loading && connection && (
        <section className="panel connection-panel">
          <div className="integration-mark" aria-hidden="true">A</div>
          <div className="integration-copy">
            <h2>Jira and Confluence Cloud</h2>
            {connection.connected ? (
              <>
                <p>Connected account</p>
                <strong className="connection-account">
                  {connection.account.displayName || connection.account.id}
                </strong>
                <small className="connection-capabilities">
                  Granted capabilities: {Array.isArray(connection.capabilities) && connection.capabilities.length
                    ? connection.capabilities.join(", ")
                    : "Not reported"}
                </small>
              </>
            ) : (
              <p>No Atlassian account is connected.</p>
            )}
          </div>
          <span className={`tag ${connection.connected ? "" : "tag-muted"}`}>
            {connection.connected ? "Connected" : "Not connected"}
          </span>
          {!connection.connected && (
            <>
              <PageState kind="empty" title="Credentials stay on this machine">
                OAuth credentials are configured through the local backend environment.
                This screen never asks for or displays tokens.
              </PageState>
              <div className="requested-permissions">
                <h3>Access requested</h3>
                <ul>
                  <li>Read Jira projects and issue updates.</li>
                  <li>Search Confluence spaces and pages.</li>
                  <li>Create report pages after you approve a report.</li>
                  <li>Keep the connection available by refreshing its authorization.</li>
                </ul>
              </div>
            </>
          )}
          {connection.connected && (
            <div className="account-switch">
              <label>
                <input
                  name="confirmAccountSwitch"
                  type="checkbox"
                  checked={switchConfirmed}
                  onChange={(event) => setSwitchConfirmed(event.target.checked)}
                  disabled={Boolean(action)}
                />
                I confirm that connecting another account will replace the current account.
              </label>
            </div>
          )}
          <div className="connection-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={startConnection}
              disabled={
                Boolean(action) ||
                (connection.connected && !switchConfirmed)
              }
            >
              {action === "connect"
                ? "Opening Atlassian…"
                : connection.connected
                  ? "Connect a different account"
                  : "Connect Atlassian"}
            </button>
            {connection.connected && (
              <button
                className="button button-secondary"
                type="button"
                onClick={disconnect}
                disabled={Boolean(action)}
              >
                {action === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
          </div>
        </section>
      )}
      <p className="connection-back">
        <Link className="text-link" to="/">Back to weekly reports</Link>
      </p>
    </>
  );
}
