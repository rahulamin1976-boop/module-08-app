import { requestAtlassianJson } from "./atlassian-http.js";

export function createJiraClient({ cloudId, siteUrl, accessToken, fetchImpl } = {}) {
  if (!cloudId || !siteUrl) {
    throw new Error("An Atlassian Cloud site is required.");
  }
  let parsedSiteUrl;
  try {
    parsedSiteUrl = new URL(siteUrl);
  } catch {
    throw new Error("An Atlassian Cloud site URL is invalid.");
  }
  if (parsedSiteUrl.protocol !== "https:" || parsedSiteUrl.username || parsedSiteUrl.password) {
    throw new Error("An Atlassian Cloud site URL is invalid.");
  }
  const normalizedSiteUrl = parsedSiteUrl.origin;
  const baseUrl = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3`;
  const request = (path, options = {}) =>
    requestAtlassianJson(`${baseUrl}${path}`, {
      accessToken,
      fetchImpl,
      ...options,
    });

  return Object.freeze({
    siteUrl: normalizedSiteUrl,
    issueUrl(issueKey) {
      return new URL(`/browse/${encodeURIComponent(issueKey)}`, normalizedSiteUrl).toString();
    },
    searchProjects({ query, startAt = 0, maxResults = 50 }) {
      const params = new URLSearchParams({
        query,
        startAt: String(startAt),
        maxResults: String(maxResults),
      });
      return request(`/project/search?${params}`);
    },
    searchIssues({ jql, fields, maxResults = 100, nextPageToken }) {
      return request("/search/jql", {
        method: "POST",
        body: {
          jql,
          fields,
          maxResults,
          ...(nextPageToken ? { nextPageToken } : {}),
        },
      });
    },
    getIssue(issueId) {
      return request(`/issue/${encodeURIComponent(issueId)}?fields=project,summary,status,assignee,updated`);
    },
    getCurrentUser() {
      return request("/myself");
    },
  });
}
