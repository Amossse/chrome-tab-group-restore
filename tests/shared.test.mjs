import test from "node:test";
import assert from "node:assert/strict";
import {
  groupSignature,
  isRestorableUrl,
  mergeGroupSnapshots,
  recentlyClosedWindowSnapshot,
} from "../shared.js";

test("only web URLs can be restored", () => {
  assert.equal(isRestorableUrl("https://example.com"), true);
  assert.equal(isRestorableUrl("http://localhost:3000"), true);
  assert.equal(isRestorableUrl("chrome://settings"), false);
  assert.equal(isRestorableUrl("javascript:alert(1)"), false);
  assert.equal(isRestorableUrl("not a url"), false);
});

test("group signatures change with tab order", () => {
  const group = {
    title: "Research",
    color: "blue",
    tabs: [{ url: "https://a.example" }, { url: "https://b.example" }],
  };
  const reversed = { ...group, tabs: [...group.tabs].reverse() };
  assert.notEqual(groupSignature(group), groupSignature(reversed));
});

test("new group snapshots replace old records and stay newest first", () => {
  const old = { id: "one", updatedAt: 1, tabs: [{ url: "https://old.example" }] };
  const newer = {
    id: "one",
    updatedAt: 3,
    tabs: [{ url: "https://new.example" }, { url: "https://newer.example" }],
  };
  const second = {
    id: "two",
    updatedAt: 2,
    tabs: [{ url: "https://two.example" }, { url: "https://second.example" }],
  };
  assert.deepEqual(mergeGroupSnapshots([old, second], [newer]), [newer, second]);
});

test("single-tab snapshots are hidden", () => {
  const single = { id: "one", updatedAt: 1, tabs: [{ url: "https://one.example" }] };
  assert.deepEqual(mergeGroupSnapshots([single], []), []);
});

test("recently closed multi-tab windows become restorable snapshots", () => {
  const snapshot = recentlyClosedWindowSnapshot({
    lastModified: 123,
    window: {
      sessionId: "closed-14",
      tabs: [
        { index: 1, title: "Second", url: "https://second.example" },
        { index: 0, title: "First", url: "https://first.example" },
        { index: 2, title: "Settings", url: "chrome://settings" },
      ],
    },
  });

  assert.equal(snapshot.id, "session:closed-14");
  assert.equal(snapshot.sessionId, "closed-14");
  assert.equal(snapshot.updatedAt, 123_000);
  assert.deepEqual(snapshot.tabs.map((tab) => tab.title), ["First", "Second"]);
  assert.equal(
    recentlyClosedWindowSnapshot({ window: { sessionId: "single", tabs: [snapshot.tabs[0]] } }),
    null,
  );
});
