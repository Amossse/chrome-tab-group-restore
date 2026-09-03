import {
  STORAGE_KEY,
  groupSignature,
  isRestorableUrl,
  mergeGroupSnapshots,
  recentlyClosedWindowSnapshot,
} from "./shared.js";

const LOG_PREFIX = "[Groupback]";
let captureTimer;
let captureQueue = Promise.resolve();

async function readState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || { groups: [], sessionId: crypto.randomUUID() };
}

async function writeState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function captureOpenGroups() {
  const state = await readState();
  const [groups, recentSessions] = await Promise.all([
    chrome.tabGroups.query({}),
    chrome.sessions.getRecentlyClosed(),
  ]);
  const incoming = [];

  for (const group of groups) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    if (tabs.some((tab) => tab.incognito)) continue;

    const safeTabs = tabs
      .filter((tab) => isRestorableUrl(tab.url))
      .map((tab) => ({ title: tab.title || tab.url, url: tab.url }));
    if (safeTabs.length === 0) continue;

    const draft = {
      title: group.title || "Untitled group",
      color: group.color,
      collapsed: group.collapsed,
      tabs: safeTabs,
    };
    const signature = groupSignature(draft);
    // Chrome group IDs reset between browser sessions; the session prefix prevents stale matches.
    const liveKey = `${state.sessionId}:${group.id}`;
    const previous = state.groups.find(
      (item) => item.liveKey === liveKey || item.signature === signature,
    );

    incoming.push({
      ...draft,
      id: previous?.id || crypto.randomUUID(),
      signature,
      liveKey,
      updatedAt: Date.now(),
    });
  }

  incoming.push(
    ...recentSessions
      .map((session) => recentlyClosedWindowSnapshot(session))
      .filter(Boolean),
  );

  await writeState({
    sessionId: state.sessionId,
    groups: mergeGroupSnapshots(state.groups, incoming),
  });
}

function queueCapture() {
  captureQueue = captureQueue
    .then(captureOpenGroups)
    .catch((error) => console.error(`${LOG_PREFIX} Could not save tab groups`, error));
  return captureQueue;
}

function scheduleCapture() {
  clearTimeout(captureTimer);
  captureTimer = setTimeout(queueCapture, 250);
}

async function startBrowserSession() {
  const state = await readState();
  await writeState({ ...state, sessionId: crypto.randomUUID() });
  await queueCapture();
}

async function releaseGroup(groupId) {
  const state = await readState();
  const liveKey = `${state.sessionId}:${groupId}`;
  await writeState({
    ...state,
    groups: state.groups.map((group) =>
      group.liveKey === liveKey ? { ...group, liveKey: null } : group,
    ),
  });
}

chrome.runtime.onInstalled.addListener(() => {
  startBrowserSession().catch((error) =>
    console.error(`${LOG_PREFIX} Could not initialize storage`, error),
  );
});

chrome.runtime.onStartup.addListener(() => {
  startBrowserSession().catch((error) =>
    console.error(`${LOG_PREFIX} Could not start browser session`, error),
  );
});

for (const event of [
  chrome.tabs.onCreated,
  chrome.tabs.onUpdated,
  chrome.tabs.onMoved,
  chrome.tabs.onAttached,
  chrome.tabs.onDetached,
]) {
  event.addListener(scheduleCapture);
}

for (const event of [
  chrome.tabGroups.onCreated,
  chrome.tabGroups.onMoved,
  chrome.tabGroups.onUpdated,
]) {
  event.addListener(scheduleCapture);
}

chrome.tabGroups.onRemoved.addListener((group) => {
  // Keep the snapshot for restart recovery, but stop treating the closed group as live.
  releaseGroup(group.id).catch((error) =>
    console.error(`${LOG_PREFIX} Could not close group snapshot`, error),
  );
});

chrome.sessions.onChanged.addListener(scheduleCapture);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "captureGroups") return false;

  queueCapture()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.error(`${LOG_PREFIX} Could not refresh groups`, error);
      sendResponse({ ok: false });
    });
  return true;
});
