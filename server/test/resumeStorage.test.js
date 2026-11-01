const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workpath-resume-test-"));
process.env.RESUME_STORAGE_PATH = storageRoot;
const storage = require("../services/resumeStorage");

test("resume files are written privately under their owner and removed by storage key", async (context) => {
  context.after(async () => fsp.rm(storageRoot, { recursive: true, force: true }));
  const userId = "64b000000000000000000001";
  const fileContents = Buffer.from("private resume bytes");
  const key = await storage.saveResume(userId, fileContents, "pdf");
  const filePath = await storage.getResumePath(userId, key);
  assert.equal(path.dirname(filePath), path.join(storageRoot, userId));
  assert.deepEqual(await fsp.readFile(filePath), fileContents);
  await assert.rejects(storage.getResumePath(userId, "../../other-user.pdf"), /invalid/i);
  await storage.deleteResume(userId, key);
  await assert.rejects(storage.getResumePath(userId, key), { code: "ENOENT" });
});
