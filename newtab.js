import { STORAGE_KEY, isRestorableUrl } from "./shared.js";

const PAGE_SIZE = 120;
const demoMode = new URLSearchParams(location.search).has("demo");
const elements = {
  search: document.querySelector("#search"),
  groupGrid: document.querySelector("#group-grid"),
  groupEmpty: document.querySelector("#group-empty"),
  historyGrid: document.querySelector("#history-grid"),
  historyEmpty: document.querySelector("#history-empty"),
  loadMore: document.querySelector("#load-more"),
  groupCount: document.querySelector("#group-count"),
  historyCount: document.querySelector("#history-count"),
  toast: document.querySelector("#toast"),
};

let groups = [];
let historyItems = [];
let historyEndTime = Date.now() + 1;
let historyLoading = false;
let searchTimer;

const demoGroups = [
  {
    id: "design-research",
    title: "Design research",
    color: "purple",
    updatedAt: Date.now() - 8 * 60_000,
    tabs: [
      { title: "Design systems", url: "https://www.figma.com/" },
      { title: "Web platform", url: "https://developer.mozilla.org/" },
      { title: "Material Design", url: "https://m3.material.io/" },
    ],
  },
  {
    id: "shipping-v1",
    title: "Ship v1",
    color: "green",
    updatedAt: Date.now() - 62 * 60_000,
    tabs: [
      { title: "GitHub", url: "https://github.com/" },
      { title: "Chrome Extensions", url: "https://developer.chrome.com/docs/extensions/" },
    ],
  },
];

const demoHistory = [
  ["Chrome Extensions documentation", "https://developer.chrome.com/docs/extensions/", 4],
  ["JavaScript | MDN", "https://developer.mozilla.org/en-US/docs/Web/JavaScript", 16],
  ["GitHub · Build from here", "https://github.com/", 38],
  ["web.dev", "https://web.dev/", 74],
  ["Can I use", "https://caniuse.com/", 130],
  ["W3C Web Standards", "https://www.w3.org/", 260],
].map(([title, url, minutes], index) => ({
  id: `demo-${index}`,
  title,
  url,
  lastVisitTime: Date.now() - minutes * 60_000,
  visitCount: index + 2,
}));

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function relativeTime(timestamp) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function matchesGroup(group, query) {
  if (!query) return true;
  const haystack = [group.title, ...group.tabs.flatMap((tab) => [tab.title, tab.url])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function makeSiteMark(url) {
  const mark = document.createElement("span");
  const domain = hostname(url);
  mark.className = "site-mark";
  mark.textContent = domain.slice(0, 1).toUpperCase() || "•";
  mark.style.setProperty("--hue", String([...domain].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360));
  return mark;
}

function renderGroups() {
  const query = elements.search.value.trim().toLowerCase();
  const visible = groups.filter((group) => matchesGroup(group, query));
  const fragment = document.createDocumentFragment();

  for (const group of visible) {
    const card = document.createElement("article");
    card.className = `group-card group-${group.color || "grey"}`;
    card.dataset.id = group.id;

    const accent = document.createElement("span");
    accent.className = "group-accent";

    const meta = document.createElement("div");
    meta.className = "group-meta";
    const label = document.createElement("span");
    label.textContent = `${group.tabs.length} tab${group.tabs.length === 1 ? "" : "s"}`;
    const time = document.createElement("span");
    time.textContent = relativeTime(group.updatedAt);
    meta.append(label, time);

    const title = document.createElement("h3");
    title.textContent = group.title;

    const tabList = document.createElement("div");
    tabList.className = "tab-list";
    for (const tab of group.tabs.slice(0, 4)) {
      const row = document.createElement("div");
      row.className = "tab-row";
      row.append(makeSiteMark(tab.url));
      const text = document.createElement("span");
      text.textContent = tab.title || hostname(tab.url);
      row.append(text);
      tabList.append(row);
    }
    if (group.tabs.length > 4) {
      const rest = document.createElement("p");
      rest.className = "more-tabs";
      rest.textContent = `+${group.tabs.length - 4} more`;
      tabList.append(rest);
    }

    const actions = document.createElement("div");
    actions.className = "group-actions";
    const restore = document.createElement("button");
    restore.className = "restore-button";
    restore.type = "button";
    restore.dataset.action = "restore";
    restore.textContent = "Restore group";
    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.setAttribute("aria-label", `Forget ${group.title}`);
    remove.textContent = "Forget";
    actions.append(restore, remove);

    card.append(accent, meta, title, tabList, actions);
    fragment.append(card);
  }

  elements.groupGrid.replaceChildren(fragment);
  elements.groupEmpty.hidden = visible.length > 0;
  elements.groupCount.textContent = String(groups.length);
}

function renderHistory() {
  const fragment = document.createDocumentFragment();
  for (const item of historyItems) {
    const card = document.createElement("button");
    card.className = "history-card";
    card.type = "button";
    card.dataset.url = item.url;
    card.append(makeSiteMark(item.url));

    const copy = document.createElement("span");
    copy.className = "history-copy";
    const title = document.createElement("strong");
    title.textContent = item.title || hostname(item.url);
    const meta = document.createElement("span");
    meta.textContent = `${hostname(item.url)} · ${relativeTime(item.lastVisitTime || 0)}`;
    copy.append(title, meta);

    const arrow = document.createElement("span");
    arrow.className = "history-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    card.append(copy, arrow);
    fragment.append(card);
  }

  elements.historyGrid.replaceChildren(fragment);
  elements.historyEmpty.hidden = historyItems.length > 0;
  elements.historyCount.textContent = String(historyItems.length);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

async function loadGroups() {
  if (demoMode) {
    groups = demoGroups;
    renderGroups();
    return;
  }

  await chrome.runtime.sendMessage({ type: "captureGroups" }).catch(() => null);
  const result = await chrome.storage.local.get(STORAGE_KEY);
  groups = result[STORAGE_KEY]?.groups || [];
  renderGroups();
}

async function loadHistory(reset = false) {
  if (historyLoading) return;
  historyLoading = true;
  elements.loadMore.disabled = true;

  try {
    if (demoMode) {
      historyItems = demoHistory;
      elements.loadMore.hidden = true;
      renderHistory();
      return;
    }

    if (reset) {
      historyItems = [];
      historyEndTime = Date.now() + 1;
    }
    const query = elements.search.value.trim();
    const batch = await chrome.history.search({
      text: query,
      startTime: 0,
      endTime: historyEndTime,
      maxResults: PAGE_SIZE,
    });
    const safeBatch = batch.filter((item) => isRestorableUrl(item.url));
    const seen = new Set(historyItems.map((item) => item.url));
    historyItems.push(...safeBatch.filter((item) => !seen.has(item.url)));
    const oldest = batch.at(-1)?.lastVisitTime;
    // Chrome history has no cursor, so continue just before the oldest loaded visit.
    if (oldest) historyEndTime = oldest - 1;
    elements.loadMore.hidden = batch.length < PAGE_SIZE;
    renderHistory();
  } catch (error) {
    console.error("[Groupback] Could not load browser history", error);
    showToast("Browser history could not be loaded");
  } finally {
    historyLoading = false;
    elements.loadMore.disabled = false;
  }
}

async function restoreGroup(group, button) {
  if (demoMode) {
    showToast(`Demo: restored ${group.title}`);
    return;
  }

  button.disabled = true;
  button.textContent = "Restoring…";
  const tabIds = [];
  try {
    const currentWindow = await chrome.windows.getCurrent();
    for (const tab of group.tabs) {
      const created = await chrome.tabs.create({
        windowId: currentWindow.id,
        url: tab.url,
        active: false,
      });
      tabIds.push(created.id);
    }
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: group.title,
      color: group.color || "grey",
      collapsed: false,
    });
    await chrome.tabs.update(tabIds[0], { active: true });
    const currentTab = await chrome.tabs.getCurrent();
    if (currentTab?.id) await chrome.tabs.remove(currentTab.id);
  } catch (error) {
    console.error("[Groupback] Could not restore tab group", error);
    if (tabIds.length > 0) await chrome.tabs.remove(tabIds).catch(() => null);
    button.disabled = false;
    button.textContent = "Restore group";
    showToast("That group could not be restored");
  }
}

async function forgetGroup(group) {
  groups = groups.filter((item) => item.id !== group.id);
  if (!demoMode) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const state = result[STORAGE_KEY] || {};
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...state, groups } });
  }
  renderGroups();
  showToast(`Forgot ${group.title}`);
}

elements.groupGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest("[data-id]");
  if (!button || !card) return;
  const group = groups.find((item) => item.id === card.dataset.id);
  if (!group) return;
  if (button.dataset.action === "restore") void restoreGroup(group, button);
  if (button.dataset.action === "delete") void forgetGroup(group);
});

elements.historyGrid.addEventListener("click", async (event) => {
  const card = event.target.closest("button[data-url]");
  if (!card || demoMode) return;
  const currentTab = await chrome.tabs.getCurrent();
  await chrome.tabs.update(currentTab.id, { url: card.dataset.url });
});

elements.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  renderGroups();
  searchTimer = setTimeout(() => void loadHistory(true), 180);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== elements.search) {
    event.preventDefault();
    elements.search.focus();
  }
});

elements.loadMore.addEventListener("click", () => void loadHistory());

if (!demoMode) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    groups = changes[STORAGE_KEY].newValue?.groups || [];
    renderGroups();
  });
}

await Promise.all([loadGroups(), loadHistory(true)]);
