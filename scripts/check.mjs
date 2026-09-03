import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import assert from "node:assert/strict";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.chrome_url_overrides.newtab, "newtab.html");
assert.deepEqual(manifest.host_permissions, undefined);
assert.ok(manifest.permissions.includes("history"));
assert.ok(manifest.permissions.includes("sessions"));
assert.ok(manifest.permissions.includes("tabGroups"));

const referencedFiles = [
  manifest.background.service_worker,
  manifest.chrome_url_overrides.newtab,
  ...Object.values(manifest.icons),
];

await Promise.all(referencedFiles.map((file) => access(new URL(`../${file}`, import.meta.url))));
console.log(`Validated Manifest V3 and ${referencedFiles.length} referenced files.`);
