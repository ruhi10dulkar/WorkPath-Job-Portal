const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function storageRoot() {
  return path.resolve(process.env.RESUME_STORAGE_PATH || path.join(__dirname, "../private_uploads/resumes"));
}

function safeKey(key) {
  if (typeof key !== "string" || !/^[a-f0-9-]{36}\.(pdf|doc|docx)$/.test(key)) {
    throw new Error("Resume reference is invalid.");
  }
  return key;
}

function userDirectory(userId) {
  const root = storageRoot();
  const directory = path.resolve(root, String(userId));
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error("Resume owner is invalid.");
  return directory;
}

async function saveResume(userId, buffer, extension) {
  const key = `${crypto.randomUUID()}.${extension}`;
  const directory = userDirectory(userId);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(directory, key), buffer, { flag: "wx", mode: 0o600 });
  return key;
}

async function getResumePath(userId, key) {
  const filePath = path.join(userDirectory(userId), safeKey(key));
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${userDirectory(userId)}${path.sep}`)) throw new Error("Resume reference is invalid.");
  await fs.access(resolved);
  return resolved;
}

async function deleteResume(userId, key) {
  try { await fs.unlink(path.join(userDirectory(userId), safeKey(key))) }
  catch (error) { if (error.code !== "ENOENT") throw error }
}

module.exports = { saveResume, getResumePath, deleteResume };
