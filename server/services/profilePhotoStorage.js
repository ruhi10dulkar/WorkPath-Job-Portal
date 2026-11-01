const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function storageRoot() {
  return path.resolve(process.env.PROFILE_PHOTO_STORAGE_PATH || path.join(__dirname, "../private_uploads/profile-photos"));
}
function userDirectory(userId) {
  const root = storageRoot();
  const directory = path.resolve(root, String(userId));
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error("Profile photo owner is invalid.");
  return directory;
}
function safeKey(key) {
  if (typeof key !== "string" || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) throw new Error("Profile photo reference is invalid.");
  return key;
}
async function savePhoto(userId, buffer, extension) {
  const key = `${crypto.randomUUID()}.${extension}`;
  const directory = userDirectory(userId);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(directory, key), buffer, { flag: "wx", mode: 0o600 });
  return key;
}
async function getPhotoPath(userId, key) {
  const filePath = path.resolve(userDirectory(userId), safeKey(key));
  if (!filePath.startsWith(`${userDirectory(userId)}${path.sep}`)) throw new Error("Profile photo reference is invalid.");
  await fs.access(filePath);
  return filePath;
}
async function deletePhoto(userId, key) {
  try { await fs.unlink(path.join(userDirectory(userId), safeKey(key))) }
  catch (error) { if (error.code !== "ENOENT") throw error }
}
module.exports = { savePhoto, getPhotoPath, deletePhoto };
