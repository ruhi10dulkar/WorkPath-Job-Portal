const crypto = require("node:crypto");
const path = require("node:path");
const CandidateProfile = require("../models/CandidateProfile");
const { getProfileReadiness, isValidPhone } = require("../services/profileReadiness");
const resumeStorage = require("../services/resumeStorage");
const profilePhotoStorage = require("../services/profilePhotoStorage");

const ALLOWED_WORK_MODES = ["remote", "hybrid", "on-site"];
const ALLOWED_EMPLOYMENT_TYPES = ["full-time", "part-time", "internship", "contract"];
const RESUME_TYPES = {
  pdf: { mime: "application/pdf", extension: "pdf" },
  doc: { mime: "application/msword", extension: "doc" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" },
};
const PHOTO_TYPES = {
  "image/jpeg": { extension: "jpg", mime: "image/jpeg" },
  "image/png": { extension: "png", mime: "image/png" },
  "image/webp": { extension: "webp", mime: "image/webp" },
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value, label, maxLength, { optional = true } = {}) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!optional && !normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maxLength) throw new Error(`${label} cannot exceed ${maxLength} characters.`);
  return normalized;
}

function optionalUrl(value, label) {
  const normalized = text(value, label, 500);
  if (!normalized) return normalized;
  let parsed;
  try { parsed = new URL(normalized) } catch { throw new Error(`${label} must be a valid URL.`) }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${label} must start with http:// or https://.`);
  return parsed.toString();
}

function uniqueStrings(values, label, maxCount, maxLength) {
  if (!Array.isArray(values)) throw new Error(`${label} must be a list.`);
  if (values.length > maxCount) throw new Error(`${label} cannot contain more than ${maxCount} entries.`);
  const unique = new Map();
  for (const item of values) {
    const normalized = text(item, label, maxLength, { optional: false });
    const key = normalized.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return [...unique.values()];
}

function enumList(values, label, allowed) {
  if (!Array.isArray(values) || values.some((value) => !allowed.includes(value))) {
    throw new Error(`${label} contains an unsupported option.`);
  }
  return [...new Set(values)];
}

function normalizeEducation(entries) {
  if (!Array.isArray(entries) || entries.length > 30) throw new Error("Education must contain no more than 30 entries.");
  const normalized = entries.map((item) => {
    if (!isRecord(item)) throw new Error("Each education record must be an object.");
    const degree = text(item.degree, "Degree", 120, { optional: false });
    const fieldOfStudy = text(item.fieldOfStudy, "Field of study", 120, { optional: false });
    const institution = text(item.institution, "Institution", 160, { optional: false });
    const startYear = Number(item.startYear);
    const endYear = item.endYear === "" || item.endYear == null ? null : Number(item.endYear);
    if (!Number.isInteger(startYear) || startYear < 1950 || startYear > new Date().getFullYear() + 15) throw new Error("Enter a valid education start year.");
    if (endYear !== null && (!Number.isInteger(endYear) || endYear < startYear || endYear > new Date().getFullYear() + 15)) throw new Error("Education end year must be after its start year.");
    return { degree, fieldOfStudy, institution, startYear, endYear, grade: text(item.grade || "", "Grade", 40) || "" };
  });
  const seen = new Set();
  return normalized.filter((item) => {
    const key = [item.degree, item.fieldOfStudy, item.institution, item.startYear, item.endYear].map((value) => String(value || "").toLocaleLowerCase()).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseDate(value, label, { required = false } = {}) {
  if (!value && !required) return null;
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
}

function normalizeExperience(entries) {
  if (!Array.isArray(entries) || entries.length > 30) throw new Error("Experience must contain no more than 30 entries.");
  return entries.map((item) => {
    if (!isRecord(item)) throw new Error("Each experience record must be an object.");
    const company = text(item.company, "Company", 160, { optional: false });
    const jobTitle = text(item.jobTitle, "Job title", 120, { optional: false });
    const employmentType = item.employmentType || "full-time";
    if (![...ALLOWED_EMPLOYMENT_TYPES, "freelance"].includes(employmentType)) throw new Error("Experience employment type is invalid.");
    const startDate = parseDate(item.startDate, "Experience start date", { required: true });
    const currentlyWorking = Boolean(item.currentlyWorking);
    const endDate = currentlyWorking ? null : parseDate(item.endDate, "Experience end date", { required: true });
    if (endDate && endDate < startDate) throw new Error("Experience end date cannot be earlier than its start date.");
    return { company, jobTitle, employmentType, startDate, endDate, currentlyWorking, description: text(item.description || "", "Experience description", 3000) || "" };
  });
}

function normalizeProjects(entries) {
  if (!Array.isArray(entries) || entries.length > 30) throw new Error("Projects must contain no more than 30 entries.");
  return entries.map((item) => {
    if (!isRecord(item)) throw new Error("Each project must be an object.");
    return {
      name: text(item.name, "Project name", 120, { optional: false }),
      description: text(item.description || "", "Project description", 3000) || "",
      technologies: uniqueStrings(item.technologies || [], "Technologies", 30, 50),
      projectUrl: optionalUrl(item.projectUrl || "", "Project URL") || "",
      githubUrl: optionalUrl(item.githubUrl || "", "GitHub URL") || "",
    };
  });
}

function normalizeCertifications(entries) {
  if (!Array.isArray(entries) || entries.length > 30) throw new Error("Certifications must contain no more than 30 entries.");
  return entries.map((item) => {
    if (!isRecord(item)) throw new Error("Each certification must be an object.");
    return {
      name: text(item.name, "Certificate name", 160, { optional: false }),
      issuer: text(item.issuer, "Issuing organization", 160, { optional: false }),
      issueDate: parseDate(item.issueDate, "Certificate issue date"),
      credentialUrl: optionalUrl(item.credentialUrl || "", "Credential URL") || "",
    };
  });
}

function getSafeProfile(profile) {
  const result = profile.toObject ? profile.toObject() : { ...profile };
  if (result.resume) delete result.resume.storageKey;
  if (result.profilePhoto) {
    delete result.profilePhoto.storageKey;
    result.profilePhoto.url = profile.profilePhoto?.storageKey ? `/api/profile/photo/${profile.profilePhoto.storageKey}` : "";
  }
  return result;
}

async function getOrCreateProfile(user) {
  const existing = await CandidateProfile.findOne({ user: user._id }).select("+resume.storageKey +profilePhoto.storageKey");
  if (existing) return existing;
  try {
    return await CandidateProfile.create({ user: user._id, basicInfo: { fullName: user.name } });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return CandidateProfile.findOne({ user: user._id }).select("+resume.storageKey +profilePhoto.storageKey");
  }
}

async function getProfile(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user);
    return res.json({
      success: true,
      account: { name: req.user.name, email: req.user.email, emailVerified: req.user.emailVerified },
      profile: getSafeProfile(profile),
      readiness: getProfileReadiness(profile),
    });
  } catch (error) {
    console.error("Candidate profile load failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load your profile." });
  }
}

async function getProfileReadinessHandler(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user);
    return res.json({ success: true, readiness: getProfileReadiness(profile) });
  } catch (error) {
    console.error("Profile readiness lookup failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to check profile readiness." });
  }
}

function applyBasicInfo(profile, input) {
  if (!isRecord(input)) throw new Error("Basic information must be an object.");
  const fields = {
    fullName: ["Full name", 100], phone: ["Phone", 30], currentLocation: ["Current location", 120],
    headline: ["Professional headline", 160], summary: ["Professional summary", 3000],
  };
  for (const [key, [label, maxLength]] of Object.entries(fields)) {
    if (Object.hasOwn(input, key)) profile.basicInfo[key] = text(input[key], label, maxLength) || "";
  }
  if (profile.basicInfo.fullName && profile.basicInfo.fullName.length < 2) throw new Error("Full name must contain at least 2 characters.");
  if (profile.basicInfo.currentLocation && profile.basicInfo.currentLocation.length < 2) throw new Error("Current location must contain at least 2 characters.");
  if (Object.hasOwn(input, "phone") && input.phone && !isValidPhone(profile.basicInfo.phone)) {
    throw new Error("Enter a valid phone number, including country code if needed.");
  }
  for (const [key, label] of [["portfolioUrl", "Portfolio URL"], ["githubUrl", "GitHub URL"], ["linkedInUrl", "LinkedIn URL"]]) {
    if (Object.hasOwn(input, key)) profile.basicInfo[key] = optionalUrl(input[key] || "", label) || "";
  }
}

function detectProfilePhoto(file) {
  const detected = PHOTO_TYPES[file?.mimetype];
  if (!detected || !Buffer.isBuffer(file.buffer)) return null;
  const bytes = file.buffer;
  const valid = detected.extension === "jpg"
    ? bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    : detected.extension === "png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return valid ? detected : null;
}

async function uploadProfilePhoto(req, res) {
  const detected = detectProfilePhoto(req.file);
  if (!detected) return res.status(400).json({ success: false, message: "Please upload a JPG, PNG, or WebP image under 5 MB." });
  let storageKey;
  try {
    const profile = await getOrCreateProfile(req.user);
    const previousKey = profile.profilePhoto?.storageKey;
    storageKey = await profilePhotoStorage.savePhoto(req.user._id, req.file.buffer, detected.extension);
    profile.profilePhoto = { storageKey, contentType: detected.mime, uploadedAt: new Date() };
    await profile.save();
    if (previousKey) await profilePhotoStorage.deletePhoto(req.user._id, previousKey).catch(() => {});
    return res.status(201).json({ success: true, message: "Profile photo updated.", profile: getSafeProfile(profile) });
  } catch (error) {
    if (storageKey) await profilePhotoStorage.deletePhoto(req.user._id, storageKey).catch(() => {});
    console.error("Candidate profile photo upload failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to upload photo. Please try again." });
  }
}

async function getProfilePhoto(req, res) {
  try {
    const profile = await CandidateProfile.findOne({ "profilePhoto.storageKey": req.params.key }).select("user profilePhoto.contentType +profilePhoto.storageKey");
    if (!profile) return res.status(404).json({ success: false, message: "Profile photo not found." });
    const filePath = await profilePhotoStorage.getPhotoPath(profile.user, profile.profilePhoto.storageKey);
    return res.sendFile(filePath, { headers: { "Content-Type": profile.profilePhoto.contentType, "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ success: false, message: "Profile photo not found." });
    console.error("Candidate profile photo access failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load profile photo." });
  }
}

async function deleteProfilePhoto(req, res) {
  try {
    const profile = await getOrCreateProfile(req.user);
    const previousKey = profile.profilePhoto?.storageKey;
    if (!profile.profilePhoto) return res.status(404).json({ success: false, message: "No profile photo has been uploaded." });
    profile.profilePhoto = null;
    await profile.save();
    if (previousKey) await profilePhotoStorage.deletePhoto(req.user._id, previousKey).catch(() => {});
    return res.json({ success: true, message: "Profile photo removed.", profile: getSafeProfile(profile) });
  } catch (error) {
    console.error("Candidate profile photo removal failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to remove photo. Please try again." });
  }
}

async function updateProfile(req, res) {
  const input = req.body;
  if (!isRecord(input)) return res.status(400).json({ success: false, message: "Profile details must be an object." });
  try {
    const profile = await getOrCreateProfile(req.user);
    if (Object.hasOwn(input, "basicInfo")) applyBasicInfo(profile, input.basicInfo);
    if (Object.hasOwn(input, "education")) profile.education = normalizeEducation(input.education);
    if (Object.hasOwn(input, "skills")) profile.skills = uniqueStrings(input.skills, "Skills", 60, 50);
    if (Object.hasOwn(input, "isFresher")) {
      if (typeof input.isFresher !== "boolean") throw new Error("Fresher status must be yes or no.");
      profile.isFresher = input.isFresher;
    }
    if (Object.hasOwn(input, "experience")) profile.experience = normalizeExperience(input.experience);
    if (Object.hasOwn(input, "projects")) profile.projects = normalizeProjects(input.projects);
    if (Object.hasOwn(input, "certifications")) profile.certifications = normalizeCertifications(input.certifications);
    if (Object.hasOwn(input, "preferences")) {
      if (!isRecord(input.preferences)) throw new Error("Job preferences must be an object.");
      const preferences = input.preferences;
      if (Object.hasOwn(preferences, "preferredJobTitles")) profile.preferences.preferredJobTitles = uniqueStrings(preferences.preferredJobTitles, "Preferred job titles", 20, 120);
      if (Object.hasOwn(preferences, "preferredLocations")) profile.preferences.preferredLocations = uniqueStrings(preferences.preferredLocations, "Preferred locations", 20, 120);
      if (Object.hasOwn(preferences, "workModes")) profile.preferences.workModes = enumList(preferences.workModes, "Work modes", ALLOWED_WORK_MODES);
      if (Object.hasOwn(preferences, "employmentTypes")) profile.preferences.employmentTypes = enumList(preferences.employmentTypes, "Employment types", ALLOWED_EMPLOYMENT_TYPES);
      if (Object.hasOwn(preferences, "expectedSalary")) profile.preferences.expectedSalary = text(preferences.expectedSalary, "Expected salary", 100) || "";
    }
    await profile.save();
    if (profile.basicInfo.fullName && profile.basicInfo.fullName !== req.user.name) {
      req.user.name = profile.basicInfo.fullName;
      await req.user.save();
    }
    return res.json({ success: true, message: "Profile updated successfully.", profile: getSafeProfile(profile), readiness: getProfileReadiness(profile) });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError" || (error.name === "Error" && !error.code)) {
      return res.status(400).json({ success: false, message: error.message || "Please check the profile details." });
    }
    console.error("Candidate profile update failed:", error.message);
    return res.status(500).json({ success: false, message: "We couldn't save your changes. Please try again." });
  }
}

function detectResume(file) {
  const extension = path.extname(file.originalname).toLowerCase().slice(1);
  const declared = RESUME_TYPES[extension];
  if (!declared || file.mimetype !== declared.mime) return null;
  const header = file.buffer.subarray(0, 8);
  const signature = header.toString("hex");
  const content = file.buffer.toString("latin1");
  if (extension === "pdf" && file.buffer.subarray(0, 5).toString("ascii") === "%PDF-") return declared;
  if (extension === "doc" && signature.startsWith("d0cf11e0a1b11ae1")) return declared;
  if (extension === "docx" && signature.startsWith("504b0304") && content.includes("[Content_Types].xml") && content.includes("word/")) return declared;
  return null;
}

function cleanOriginalName(filename) {
  const base = path.basename(filename).replace(/[\u0000-\u001f\u007f]/g, "").replace(/["\\]/g, "_").trim();
  return base.slice(0, 255) || "resume";
}

function sendResume(res, filePath, originalName, contentType) {
  const headerName = cleanOriginalName(originalName).replace(/[^\x20-\x7E]/g, "_");
  return res.sendFile(filePath, { headers: {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${headerName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } }, (error) => {
    if (error && !res.headersSent) res.status(error.statusCode || 500).json({ success: false, message: "Unable to open the resume." });
  });
}

async function uploadResume(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: "Choose a PDF, DOC, or DOCX resume under 5 MB." });
  const detected = detectResume(req.file);
  if (!detected) return res.status(400).json({ success: false, message: "The resume file contents do not match a supported PDF, DOC, or DOCX type." });
  let storageKey;
  try {
    const profile = await getOrCreateProfile(req.user);
    storageKey = await resumeStorage.saveResume(req.user._id, req.file.buffer, detected.extension);
    profile.resume = {
      versionId: crypto.randomUUID(), storageKey, originalName: cleanOriginalName(req.file.originalname),
      contentType: detected.mime, size: req.file.size, uploadedAt: new Date(),
    };
    await profile.save();
    // Keep previous private versions so an application racing with replacement can still snapshot its file.
    return res.status(201).json({ success: true, message: "Resume uploaded successfully.", profile: getSafeProfile(profile), readiness: getProfileReadiness(profile) });
  } catch (error) {
    if (storageKey) await resumeStorage.deleteResume(req.user._id, storageKey).catch(() => {});
    console.error("Candidate resume upload failed:", error.message);
    return res.status(500).json({ success: false, message: "Couldn't upload your resume. Please try again." });
  }
}

async function getMyResume(req, res) {
  try {
    const profile = await CandidateProfile.findOne({ user: req.user._id }).select("+resume.storageKey");
    if (!profile?.resume?.storageKey) return res.status(404).json({ success: false, message: "No resume has been uploaded." });
    const filePath = await resumeStorage.getResumePath(req.user._id, profile.resume.storageKey);
    return sendResume(res, filePath, profile.resume.originalName, profile.resume.contentType);
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ success: false, message: "Resume file is no longer available." });
    console.error("Candidate resume access failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to open your resume." });
  }
}

async function deleteResume(req, res) {
  try {
    const profile = await CandidateProfile.findOne({ user: req.user._id }).select("+resume.storageKey");
    if (!profile?.resume) return res.status(404).json({ success: false, message: "No resume has been uploaded." });
    profile.resume = null;
    await profile.save();
    // Historical application snapshots continue to point to their private stored versions.
    return res.json({ success: true, message: "Resume removed from your profile.", readiness: getProfileReadiness(profile) });
  } catch (error) {
    console.error("Candidate resume removal failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to remove your resume." });
  }
}

async function getResumeForApplication(req, res, application) {
  const resume = application.resumeSnapshot;
  if (!resume?.storageKey) return res.status(404).json({ success: false, message: "This application has no resume attached." });
  try {
    const filePath = await resumeStorage.getResumePath(application.applicant._id, resume.storageKey);
    return sendResume(res, filePath, resume.originalName, resume.contentType);
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ success: false, message: "The submitted resume is no longer available." });
    console.error("Application resume access failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to open the submitted resume." });
  }
}

module.exports = { getProfile, getProfileReadinessHandler, updateProfile, uploadResume, getMyResume, deleteResume, getResumeForApplication, sendResume, getOrCreateProfile, getSafeProfile, detectResume, detectProfilePhoto, uploadProfilePhoto, getProfilePhoto, deleteProfilePhoto };
