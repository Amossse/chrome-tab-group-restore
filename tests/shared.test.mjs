import test from "node:test";
import assert from "node:assert/strict";
import { groupSignature, isRestorableUrl, mergeGroupSnapshots } from "../shared.js";

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
  const newer = { id: "one", updatedAt: 3, tabs: [{ url: "https://new.example" }] };
  const second = { id: "two", updatedAt: 2, tabs: [{ url: "https://two.example" }] };
  assert.deepEqual(mergeGroupSnapshots([old, second], [newer]), [newer, second]);
});
