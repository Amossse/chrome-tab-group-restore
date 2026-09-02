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

export function mergeGroupSnapshots(existing, incoming, limit = GROUP_LIMIT) {
  const byId = new Map(existing.map((group) => [group.id, group]));
  for (const group of incoming) byId.set(group.id, group);

  return [...byId.values()]
    .filter((group) => group.tabs.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
