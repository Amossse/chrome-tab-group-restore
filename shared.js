export const STORAGE_KEY = "groupbackState";
export const GROUP_LIMIT = 200;

export function isRestorableUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function groupSignature(group) {
  return JSON.stringify([
    group.title || "",
    group.color || "grey",
    group.tabs.map((tab) => tab.url),
  ]);
}

export function recentlyClosedWindowSnapshot(session, now = Date.now()) {
  const window = session?.window;
  if (!window?.sessionId || window.tabs?.some((tab) => tab.incognito)) return null;

  const tabs = (window.tabs || [])
    .filter((tab) => isRestorableUrl(tab.url))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((tab) => ({ title: tab.title || tab.url, url: tab.url }));
  if (tabs.length < 2) return null;

  const snapshot = {
    id: `session:${window.sessionId}`,
    title: "Recently closed window",
    color: "grey",
    collapsed: false,
    tabs,
    sessionId: window.sessionId,
    liveKey: null,
    updatedAt: Number.isFinite(session.lastModified) ? session.lastModified * 1000 : now,
  };
  return { ...snapshot, signature: groupSignature(snapshot) };
}

export function mergeGroupSnapshots(existing, incoming, limit = GROUP_LIMIT) {
  const byId = new Map(existing.map((group) => [group.id, group]));
  for (const group of incoming) byId.set(group.id, group);

  return [...byId.values()]
    .filter((group) => group.tabs.length > 1)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
