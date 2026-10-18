import { requestAtlassianJson } from "./atlassian-http.js";

export function createConfluenceClient({
  cloudId,
  accessToken,
  siteUrl,
  fetchImpl,
} = {}) {
  if (!cloudId) {
    throw new Error("An Atlassian Cloud site is required.");
  }
  const baseUrl = `https://api.atlassian.com/ex/confluence/${encodeURIComponent(cloudId)}/wiki/api/v2`;
  const request = (path, options = {}) =>
    requestAtlassianJson(`${baseUrl}${path}`, {
      accessToken,
      fetchImpl,
      ...options,
    });

  return Object.freeze({
    searchSpaces({ query, cursor, limit = 50 }) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (query) params.set("keys", query);
      if (cursor) params.set("cursor", cursor);
      return request(`/spaces?${params}`);
    },
    searchPages({ spaceId, parentId, title, cursor, limit = 50 }) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (spaceId) params.set("space-id", spaceId);
      if (parentId) params.set("parent-id", parentId);
      if (title) params.set("title", title);
      if (cursor) params.set("cursor", cursor);
      return request(`/pages?${params}`);
    },
    getPage(pageId) {
      return request(`/pages/${encodeURIComponent(pageId)}?body-format=storage`);
    },
    createPage({ spaceId, parentId, title, storageValue }) {
      return request("/pages", {
        method: "POST",
        body: {
          spaceId: String(spaceId),
          parentId: String(parentId),
          status: "current",
          title,
          body: {
            representation: "storage",
            value: storageValue,
          },
        },
      });
    },
    getPageProperties(pageId, { key, cursor, limit = 100 } = {}) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (key) params.set("key", key);
      if (cursor) params.set("cursor", cursor);
      return request(`/pages/${encodeURIComponent(pageId)}/properties?${params}`);
    },
    createPageProperty(pageId, { key, value }) {
      return request(`/pages/${encodeURIComponent(pageId)}/properties`, {
        method: "POST",
        body: { key, value },
      });
    },
    get siteUrl() {
      return siteUrl;
    },
  });
}
