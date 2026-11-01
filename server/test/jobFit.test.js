const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateJobFit, normalizeSkill } = require("../services/jobFit");

test("normalizes common skill aliases without changing source strings", () => {
  assert.equal(normalizeSkill("JS"), "javascript");
  assert.equal(normalizeSkill("React.js"), "react");
  assert.equal(normalizeSkill("NodeJS"), "node.js");
});

test("scores a complete skill set and reports preferred partial match", () => {
  const result = calculateJobFit({ skills: ["React", "javascript", "HTML", "CSS", "Node"] }, { requiredSkills: ["ReactJS", "JS", "HTML", "CSS"], preferredSkills: ["Node.js", "Git"], location: "Remote", minExperienceYears: 0, maxExperienceYears: 2 });
  assert.deepEqual(result.skills.missing, []);
  assert.deepEqual(result.skills.preferredMatched, ["Node.js"]);
  assert.equal(result.components.skills, 90);
  assert.equal(result.experience.matchType, "MEETS");
});

test("reports partial required skill coverage", () => {
  const result = calculateJobFit({ skills: ["React", "JavaScript"] }, { requiredSkills: ["React", "JavaScript", "Node.js", "AWS"], location: "Remote" });
  assert.deepEqual(result.skills.matched, ["React", "JavaScript"]);
  assert.deepEqual(result.skills.missing, ["Node.js", "AWS"]);
  assert.equal(result.components.skills, 50);
});

test("experience exceeds upper bound without a penalty and education alternatives match", () => {
  const result = calculateJobFit({ experience: [{ startDate: "2020-01-01", endDate: "2024-01-01" }], education: [{ degree: "BEng", fieldOfStudy: "Computer Engineering" }] }, { minExperienceYears: 0, maxExperienceYears: 2, educationRequirements: ["Computer Science / Computer Engineering"], location: "Pune" });
  assert.equal(result.experience.matchType, "EXCEEDS");
  assert.equal(result.components.experience, 100);
  assert.equal(result.components.education, 100);
});

test("handles missing candidate data and recognizes remote and exact location matches", () => {
  assert.doesNotThrow(() => calculateJobFit({}, { requiredSkills: ["React"], location: "Remote" }));
  assert.equal(calculateJobFit({ currentLocation: "Pune" }, { location: "Pune" }).components.location, 100);
  assert.equal(calculateJobFit({ currentLocation: "Pune" }, { location: "Remote" }).components.location, 100);
});
