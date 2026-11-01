function isValidPhone(value) {
  const phone = String(value || "").trim();
  const digits = phone.replace(/\D/g, "");
  return /^\+?[\d().\s-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
}

function hasCompleteEducation(education = []) {
  return education.some((entry) => Boolean(
    entry.degree?.trim()
      && entry.fieldOfStudy?.trim()
      && entry.institution?.trim()
      && Number.isInteger(Number(entry.startYear))
      && Number(entry.startYear) >= 1950
      && (!entry.endYear || Number(entry.endYear) >= Number(entry.startYear)),
  ));
}

function getProfileReadiness(profile) {
  const basic = profile?.basicInfo || {};
  const checklist = [
    {
      key: "basicInfo",
      label: "Basic information",
      complete: Boolean(basic.fullName?.trim().length >= 2 && isValidPhone(basic.phone) && basic.currentLocation?.trim().length >= 2),
    },
    { key: "education", label: "Education", complete: hasCompleteEducation(profile?.education) },
    { key: "skills", label: "Skills", complete: Array.isArray(profile?.skills) && profile.skills.some((skill) => skill.trim()) },
    { key: "resume", label: "Resume", complete: Boolean(profile?.resume?.versionId) },
  ];
  const completeCount = checklist.filter((item) => item.complete).length;
  const missingItems = checklist.filter((item) => !item.complete).map((item) => item.label);
  const completionPercentage = Math.round((completeCount / checklist.length) * 100);
  return {
    completionPercentage,
    ready: missingItems.length === 0,
    checklist,
    missingItems,
  };
}

module.exports = { getProfileReadiness, isValidPhone, hasCompleteEducation };
