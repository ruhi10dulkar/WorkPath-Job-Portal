const test = require("node:test");
const assert = require("node:assert/strict");
const { detectResume } = require("../controllers/profileController");

test("resume validation checks declared MIME, extension, and actual file signature", () => {
  const pdf = { originalname: "candidate.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7 candidate resume") };
  assert.equal(detectResume(pdf).extension, "pdf");

  const word = { originalname: "candidate.doc", mimetype: "application/msword", buffer: Buffer.from("d0cf11e0a1b11ae1", "hex") };
  assert.equal(detectResume(word).extension, "doc");

  const docxBuffer = Buffer.concat([Buffer.from("504b0304", "hex"), Buffer.from(" package [Content_Types].xml word/document.xml", "latin1")]);
  const docx = { originalname: "candidate.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docxBuffer };
  assert.equal(detectResume(docx).extension, "docx");

  assert.equal(detectResume({ ...pdf, originalname: "candidate.exe" }), null);
  assert.equal(detectResume({ ...pdf, mimetype: "text/plain" }), null);
  assert.equal(detectResume({ ...pdf, buffer: Buffer.from("not a pdf") }), null);
});
