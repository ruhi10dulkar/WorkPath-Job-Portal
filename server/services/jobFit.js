const ALIASES = new Map([
  ["js", "javascript"], ["javascript", "javascript"], ["java script", "javascript"],
  ["reactjs", "react"], ["react.js", "react"], ["react", "react"],
  ["node", "node.js"], ["nodejs", "node.js"], ["node.js", "node.js"],
  ["ts", "typescript"], ["typescript", "typescript"], ["mongo", "mongodb"], ["mongodb", "mongodb"],
  ["html5", "html"], ["css3", "css"], ["postgres", "postgresql"],
]);

function normalizeSkill(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES.get(key) || key.replace(/\s*\.\s*/g, ".");
}
function list(value) { return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : []; }
function yearsOf(experience) {
  const intervals = (Array.isArray(experience) ? experience : []).map((entry) => {
    const start = new Date(entry.startDate).getTime();
    const end = entry.currentlyWorking || !entry.endDate ? Date.now() : new Date(entry.endDate).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null;
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  let total = 0, start = null, end = null;
  for (const interval of intervals) {
    if (start === null) [start, end] = interval;
    else if (interval[0] <= end) end = Math.max(end, interval[1]);
    else { total += end - start; [start, end] = interval; }
  }
  if (start !== null) total += end - start;
  return Math.round(total / (365.25 * 86400000) * 10) / 10;
}
function isRemote(location) { return /\b(remote|anywhere|work from anywhere)\b/i.test(String(location || "")); }
function level(score) { return score >= 80 ? "Strong Match" : score >= 60 ? "Good Match" : score >= 40 ? "Partial Match" : "Low Match"; }

function calculateJobFit(candidate = {}, job = {}) {
  const required = list(job.requiredSkills).length ? list(job.requiredSkills) : list(job.skills);
  const preferred = list(job.preferredSkills);
  const candidateSkills = new Set([...list(candidate.skills), ...(candidate.projects || []).flatMap((p) => list(p.technologies)), ...(candidate.certifications || []).map((c) => c.name)].map(normalizeSkill));
  const match = (skills) => skills.filter((skill) => candidateSkills.has(normalizeSkill(skill)));
  const matched = match(required), missing = required.filter((skill) => !candidateSkills.has(normalizeSkill(skill)));
  const preferredMatched = match(preferred);
  const reqRatio = required.length ? matched.length / required.length : null;
  const prefRatio = preferred.length ? preferredMatched.length / preferred.length : null;
  const skillScore = reqRatio === null && prefRatio === null ? 100 : reqRatio === null ? Math.round(prefRatio * 100) : prefRatio === null ? Math.round(reqRatio * 100) : Math.round((reqRatio * 80 + prefRatio * 20) * 10) / 10;

  const expYears = yearsOf(candidate.experience);
  const min = job.minExperienceYears !== null && job.minExperienceYears !== undefined && Number.isFinite(Number(job.minExperienceYears)) ? Number(job.minExperienceYears) : null;
  const max = job.maxExperienceYears !== null && job.maxExperienceYears !== undefined && Number.isFinite(Number(job.maxExperienceYears)) ? Number(job.maxExperienceYears) : null;
  let expScore = 100, matchType = "NOT_REQUIRED";
  if (min !== null || max !== null) {
    const lower = min ?? 0;
    if (expYears >= lower) matchType = max !== null && expYears > max ? "EXCEEDS" : "MEETS";
    else { matchType = "DOES_NOT_MEET"; expScore = lower ? Math.max(0, Math.round(expYears / lower * 100)) : 100; }
  } else if (job.experienceLevel) {
    const range = String(job.experienceLevel).match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
    const plus = String(job.experienceLevel).match(/(\d+(?:\.\d+)?)\s*\+/);
    if (range || plus) {
      const low = range ? Number(range[1]) : Number(plus[1]); const high = range ? Number(range[2]) : null;
      if (expYears >= low) matchType = high !== null && expYears > high ? "EXCEEDS" : "MEETS";
      else { matchType = "DOES_NOT_MEET"; expScore = low ? Math.round(expYears / low * 100) : 100; }
    }
  }
  const educationRequired = list(job.educationRequirements);
  const educationEntries = Array.isArray(candidate.education) ? candidate.education : [];
  const candidateEducation = educationEntries.map((item) => [item.degree, item.fieldOfStudy].filter(Boolean).join(" "));
  const educationMatched = educationRequired.filter((req) => req.split(/\s*(?:\/|\bor\b)\s*/i).some((alternative) => candidateEducation.some((value) => {
    const a = normalizeSkill(alternative).replace(/[^a-z0-9]/g, ""), b = normalizeSkill(value).replace(/[^a-z0-9]/g, "");
    return a && b && (a.includes(b) || b.includes(a));
  })));
  const educationScore = educationRequired.length ? Math.round(educationMatched.length / educationRequired.length * 100) : 100;
  const reqLocation = String(job.location || "").trim();
  const candidateLocation = String(candidate.currentLocation || candidate.basicInfo?.currentLocation || "").trim();
  const locationRelevant = reqLocation && !isRemote(reqLocation);
  const locationScore = !locationRelevant ? 100 : !candidateLocation ? 0 : candidateLocation.toLowerCase() === reqLocation.toLowerCase() ? 100 : 0;
  const score = Math.round(skillScore * .6 + expScore * .2 + educationScore * .1 + locationScore * .1);
  const explanation = [];
  explanation.push(required.length ? `${matched.length} of ${required.length} required skills match.` : "No required skills were specified.");
  if (preferred.length) explanation.push(`${preferredMatched.length} of ${preferred.length} preferred skills match.`);
  explanation.push(matchType === "NOT_REQUIRED" ? "Experience requirement was not specified." : `Experience ${matchType.toLowerCase().replaceAll("_", " ")} (${expYears} years).`);
  explanation.push(educationRequired.length ? `${educationMatched.length} of ${educationRequired.length} education requirements match.` : "Education is not required.");
  explanation.push(!locationRelevant ? "Location is not restrictive for this role." : locationScore ? "Candidate location matches the role." : candidateLocation ? "Candidate location differs from the role location." : "Candidate location is not listed.");
  return { score, level: level(score), algorithmVersion: "v1", calculatedAt: new Date().toISOString(), components: { skills: skillScore, experience: expScore, education: educationScore, location: locationScore }, skills: { matched, missing, preferredMatched }, experience: { required: { minYears: min, maxYears: max, label: job.experienceLevel || "" }, candidateYears: expYears, matchType }, education: { required: educationRequired, candidate: candidateEducation, matched: educationMatched }, location: { required: reqLocation, candidate: candidateLocation, matched: !locationRelevant || locationScore === 100 }, explanation };
}
module.exports = { calculateJobFit, normalizeSkill, yearsOf };
