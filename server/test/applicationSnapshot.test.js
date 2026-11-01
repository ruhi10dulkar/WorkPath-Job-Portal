const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Application = require("../models/Application");

test("application schema snapshots candidate profile and resume metadata", async () => {
  const candidate = { fullName: "Ruhi Tendulkar", skills: ["React", "JavaScript"] };
  const application = new Application({
    job: new mongoose.Types.ObjectId(),
    applicant: new mongoose.Types.ObjectId(),
    profileSnapshot: { fullName: candidate.fullName, skills: candidate.skills },
    resumeSnapshot: { versionId: "resume-version", storageKey: "00000000-0000-4000-8000-000000000000.pdf", originalName: "resume.pdf", contentType: "application/pdf", size: 100, uploadedAt: new Date() },
  });
  candidate.skills.push("Python");
  assert.deepEqual(application.profileSnapshot.skills, ["React", "JavaScript"]);
  assert.equal(application.resumeSnapshot.originalName, "resume.pdf");
  assert.equal(await application.validate(), undefined);
});

test("application schema has a unique job-and-applicant index", () => {
  const uniquePairIndex = Application.schema.indexes().some(([keys, options]) => options.unique && keys.job === 1 && keys.applicant === 1);
  assert.equal(uniquePairIndex, true);
});

test("round progress records explicit eligibility, decline decisions, and decision timestamps", async () => {
  const application = new Application({
    job: new mongoose.Types.ObjectId(),
    applicant: new mongoose.Types.ObjectId(),
    status: "INTERVIEW",
    recruitmentProgress: [
      { roundId: new mongoose.Types.ObjectId(), eligibility: "SHORTLISTED", status: "PASSED", result: "PASSED", shortlistedAt: new Date(), history: [{ event: "SHORTLISTED_FOR_NEXT_ROUND", message: "Shortlisted for Technical Interview" }] },
      { roundId: new mongoose.Types.ObjectId(), eligibility: "NOT_SHORTLISTED", status: "PASSED", result: "PASSED", rejectedAt: new Date(), history: [{ event: "NOT_SHORTLISTED", message: "Not shortlisted after Technical Interview" }] },
    ],
  });

  assert.equal(await application.validate(), undefined);
  assert.equal(application.recruitmentProgress[1].eligibility, "NOT_SHORTLISTED");
  assert.ok(application.recruitmentProgress[0].shortlistedAt);
  assert.ok(application.recruitmentProgress[1].rejectedAt);
});
