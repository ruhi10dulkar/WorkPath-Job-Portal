const test = require("node:test");
const assert = require("node:assert/strict");
const { getProfileReadiness, isValidPhone } = require("../services/profileReadiness");

test("new candidate profiles begin with no completed required sections", () => {
  const result = getProfileReadiness({ basicInfo: {}, education: [], skills: [], resume: null });
  assert.equal(result.completionPercentage, 0);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingItems, ["Basic information", "Education", "Skills", "Resume"]);
});

test("readiness reaches 100 percent only when every required section is stored", () => {
  const result = getProfileReadiness({
    basicInfo: { fullName: "Ruhi Tendulkar", phone: "+91 98765 43210", currentLocation: "Pune" },
    education: [{ degree: "B.Tech", fieldOfStudy: "Computer Engineering", institution: "VIT Pune", startYear: 2023, endYear: 2027 }],
    skills: ["React", "JavaScript"],
    isFresher: true,
    experience: [],
    resume: { versionId: "resume-version" },
  });
  assert.equal(result.completionPercentage, 100);
  assert.equal(result.ready, true);
  assert.ok(result.checklist.every((item) => item.complete));
});

test("freshers do not need experience, while incomplete contact or education is not ready", () => {
  const result = getProfileReadiness({
    basicInfo: { fullName: "R", phone: "12+3456", currentLocation: "Pune" },
    education: [{ degree: "B.Tech", fieldOfStudy: "Computer Engineering", institution: "VIT Pune", startYear: 2027, endYear: 2023 }],
    skills: ["React"],
    isFresher: true,
    experience: [],
    resume: { versionId: "resume-version" },
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingItems, ["Basic information", "Education"]);
  assert.equal(isValidPhone("+91 98765 43210"), true);
  assert.equal(isValidPhone("12+3456"), false);
});
