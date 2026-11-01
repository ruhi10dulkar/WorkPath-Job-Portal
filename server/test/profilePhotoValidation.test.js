const test = require("node:test");
const assert = require("node:assert/strict");
const { detectProfilePhoto } = require("../controllers/profileController");

test("profile photo validation accepts supported image signatures and rejects spoofed files", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9]);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const webp = Buffer.from("RIFF0000WEBP");
  assert.equal(detectProfilePhoto({ mimetype: "image/jpeg", buffer: jpeg }).extension, "jpg");
  assert.equal(detectProfilePhoto({ mimetype: "image/png", buffer: png }).extension, "png");
  assert.equal(detectProfilePhoto({ mimetype: "image/webp", buffer: webp }).extension, "webp");
  assert.equal(detectProfilePhoto({ mimetype: "application/pdf", buffer: Buffer.from("%PDF-") }), null);
  assert.equal(detectProfilePhoto({ mimetype: "image/png", buffer: Buffer.from("not a png") }), null);
});
