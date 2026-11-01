const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");
const CandidateProfile = require("../models/CandidateProfile");
const { calculateJobFit } = require("../services/jobFit");
const { createNotification } = require("../services/notificationService");
const { sendRecruitmentUpdateEmail } = require("../services/emailService");

function deliverRecruitmentEmail(applicant, job, round, event) {
  Promise.resolve().then(() => sendRecruitmentUpdateEmail(applicant, job, round, event)).catch((error) => {
    console.error("Recruitment update email failed:", error.message);
  });
}

const editableFields = [
  "title",
  "company",
  "description",
  "location",
  "employmentType",
  "experienceLevel",
  "salary",
  "skills",
  "requiredSkills", "preferredSkills", "minExperienceYears", "maxExperienceYears", "educationRequirements",
];
const requiredFields = [
  "title",
  "company",
  "description",
  "location",
  "employmentType",
  "experienceLevel",
];

function pickJobFields(body) {
  return Object.fromEntries(editableFields
    .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
    .map((field) => [field, body[field]]));
}

function validFieldTypes(fields) {
  return Object.entries(fields).every(([field, value]) => {
    if (["skills", "requiredSkills", "preferredSkills", "educationRequirements"].includes(field)) {
      return Array.isArray(value) && value.every((skill) => typeof skill === "string");
    }
    if (["minExperienceYears", "maxExperienceYears"].includes(field)) return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 60);
    return typeof value === "string";
  });
}

function validationMessage(error) {
  if (error.name === "ValidationError") {
    return Object.values(error.errors).map((item) => item.message).join(" ");
  }
  return "Please provide valid job details.";
}

function validJobId(id) {
  return mongoose.isValidObjectId(id);
}

async function createJob(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const fields = pickJobFields(body);

  if (requiredFields.some((field) => typeof fields[field] !== "string" || !fields[field].trim())) {
    return res.status(400).json({ success: false, message: "Provide a title, company, description, location, employment type, and experience level." });
  }
  if (!validFieldTypes(fields)) {
    return res.status(400).json({ success: false, message: "Job fields must use the expected text and skills formats." });
  }

  try {
    const job = await Job.create({ ...fields, recruiter: req.user._id });
    return res.status(201).json({ success: true, job });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Unable to create job." });
  }
}

async function getJobs(req, res) {
  try {
    const filter = {};
    for (const field of ["location", "employmentType", "experienceLevel"]) {
      const value = typeof req.query[field] === "string" ? req.query[field].trim() : "";
      if (value) filter[field] = { $regex: escapeRegex(value), $options: "i" };
    }
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ title: pattern }, { company: pattern }, { location: pattern }, { skills: pattern }];
    }
    const jobs = await Job.find(filter)
      .select("title company description location employmentType experienceLevel salary skills requiredSkills preferredSkills minExperienceYears maxExperienceYears educationRequirements createdAt recruiter")
      .populate("recruiter", "name")
      .sort({ createdAt: -1 });
    return res.json({ success: true, jobs });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load jobs." });
  }
}

async function getJobById(req, res) {
  if (!validJobId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Job ID is invalid." });
  }

  try {
    const job = await Job.findById(req.params.id)
      .select("title company description location employmentType experienceLevel salary skills requiredSkills preferredSkills minExperienceYears maxExperienceYears educationRequirements createdAt recruiter")
      .populate("recruiter", "name");
    if (!job) return res.status(404).json({ success: false, message: "Job not found." });
    return res.json({ success: true, job });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load job." });
  }
}

async function getJobMatch(req, res) {
  if (!validJobId(req.params.id)) return res.status(400).json({ success: false, message: "Job ID is invalid." });
  try {
    const job = await Job.findById(req.params.id).select("title skills requiredSkills preferredSkills minExperienceYears maxExperienceYears experienceLevel educationRequirements location").lean();
    if (!job) return res.status(404).json({ success: false, message: "Job not found." });
    const profile = await CandidateProfile.findOne({ user: req.user._id }).select("skills education experience projects certifications basicInfo.currentLocation").lean();
    return res.json({ success: true, match: calculateJobFit(profile || {}, job) });
  } catch { return res.status(500).json({ success: false, message: "Unable to calculate job fit." }); }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getMyJobs(req, res) {
  try {
    const jobs = await Job.find({ recruiter: req.user._id }).sort({ createdAt: -1 }).lean();
    const grouped = await Application.aggregate([
      { $match: { job: { $in: jobs.map((job) => job._id) } } },
      { $group: { _id: { job: "$job", status: "$status" }, count: { $sum: 1 } } },
    ]);
    const byJob = new Map();
    grouped.forEach(({ _id, count }) => {
      const jobId = _id.job.toString();
      if (!byJob.has(jobId)) byJob.set(jobId, { total: 0, byStatus: {} });
      const status = ({ applied: "APPLIED", reviewed: "UNDER_REVIEW", shortlisted: "SHORTLISTED", accepted: "SELECTED", rejected: "REJECTED" })[_id.status] || _id.status;
      byJob.get(jobId).total += count;
      byJob.get(jobId).byStatus[status] = (byJob.get(jobId).byStatus[status] || 0) + count;
    });
    return res.json({ success: true, jobs: jobs.map((job) => ({ ...job, applicationCount: byJob.get(job._id.toString())?.total || 0, applicationsByStatus: byJob.get(job._id.toString())?.byStatus || {} })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load your jobs." });
  }
}

async function updateJob(req, res) {
  if (!validJobId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Job ID is invalid." });
  }
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const fields = pickJobFields(body);
  if (!Object.keys(fields).length) {
    return res.status(400).json({ success: false, message: "Provide at least one editable job field." });
  }
  if (!validFieldTypes(fields)) {
    return res.status(400).json({ success: false, message: "Job fields must use the expected text and skills formats." });
  }

  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found." });
    if (job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only update your own jobs." });
    }

    Object.assign(job, fields);
    await job.save();
    return res.json({ success: true, job });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Unable to update job." });
  }
}

async function saveRecruitmentPipeline(req, res) {
  if (!validJobId(req.params.id)) return res.status(400).json({ success: false, message: "Job ID is invalid." });
  const rounds = req.body?.rounds;
  const allowedTypes = ["ASSESSMENT", "APTITUDE_TEST", "CODING_TEST", "TECHNICAL_INTERVIEW", "TECHNICAL_INTERVIEW_2", "SYSTEM_DESIGN", "MANAGERIAL_INTERVIEW", "HR_INTERVIEW", "GROUP_DISCUSSION", "ASSIGNMENT", "CUSTOM"];
  if (!Array.isArray(rounds) || rounds.length > 20) return res.status(400).json({ success: false, message: "Provide up to 20 pipeline rounds." });
  const ids = rounds.map((round) => round.id).filter(Boolean).map(String);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ success: false, message: "A pipeline round cannot appear more than once." });
  for (const round of rounds) {
    if (!allowedTypes.includes(round.type) || typeof round.title !== "string" || !round.title.trim() || round.title.length > 100) return res.status(400).json({ success: false, message: "Each round requires a valid type and name." });
    if (round.duration !== undefined && (!Number.isInteger(Number(round.duration)) || Number(round.duration) < 5 || Number(round.duration) > 480)) return res.status(400).json({ success: false, message: "Round duration must be between 5 and 480 minutes." });
    if (round.mode !== undefined && !["ONLINE", "IN_PERSON"].includes(round.mode)) return res.status(400).json({ success: false, message: "Round mode is invalid." });
    if (round.link && (!/^https?:\/\//i.test(round.link) || !URL.canParse(round.link))) return res.status(400).json({ success: false, message: "Round link must be a valid URL." });
    if (round.scheduledAt) {
      const scheduledAt = new Date(round.scheduledAt);
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) return res.status(400).json({ success: false, message: "Round date and time must be in the future." });
      if (!Number.isInteger(Number(round.duration)) || Number(round.duration) < 5 || Number(round.duration) > 480) return res.status(400).json({ success: false, message: "Provide a valid round duration." });
    }
  }
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found." });
    if (!job.recruiter.equals(req.user._id)) return res.status(403).json({ success: false, message: "You can only manage your own jobs." });
    const nextIds = new Set(ids);
    const removedIds = job.recruitmentPipeline.filter((round) => !nextIds.has(round._id.toString())).map((round) => round._id);
    if (removedIds.length && await Application.exists({ job: job._id, "recruitmentProgress.roundId": { $in: removedIds } })) return res.status(409).json({ success: false, message: "A round with candidate progress cannot be deleted from the job pipeline." });
    const scheduleDetails = (round) => JSON.stringify({
      scheduledAt: round.scheduledAt ? new Date(round.scheduledAt).getTime() : null,
      duration: round.duration || null,
      mode: round.mode || "",
      platform: round.platform || "",
      link: round.link || "",
      location: round.location || "",
      instructions: round.instructions || "",
      interviewerLabels: round.interviewerLabels || "",
      title: round.title || "",
    });
    const previousSchedules = new Map(job.recruitmentPipeline.map((round) => [round._id.toString(), scheduleDetails(round)]));
    job.recruitmentPipeline = rounds.map((round, order) => ({ ...(round.id ? job.recruitmentPipeline.id(round.id)?.toObject() || {} : {}), type: round.type, title: round.title.trim(), description: String(round.description || "").slice(0, 2000), instructions: String(round.instructions || "").slice(0, 2000), duration: Number(round.duration || 45), mode: round.mode || "ONLINE", platform: String(round.platform || "").trim().slice(0, 100), link: String(round.link || "").trim().slice(0, 2000), scheduledAt: round.scheduledAt ? new Date(round.scheduledAt) : undefined, location: String(round.location || "").trim().slice(0, 500), interviewerLabels: String(round.interviewerLabels || "").trim().slice(0, 500), interviewerInstructions: String(round.interviewerInstructions || "").slice(0, 2000), interviewerIds: Array.isArray(round.interviewerIds) ? round.interviewerIds.filter(mongoose.isValidObjectId) : [], evaluationCriteria: Array.isArray(round.evaluationCriteria) ? round.evaluationCriteria.slice(0, 20).map((item) => ({ name: String(item.name || "").trim().slice(0, 100), description: String(item.description || "").trim().slice(0, 500) })).filter((item) => item.name) : [], order }));
    const changedSchedules = new Set(job.recruitmentPipeline.filter((round) => round.scheduledAt && previousSchedules.get(round._id.toString()) !== scheduleDetails(round)).map((round) => round._id.toString()));
    await job.save();
    const applications = await Application.find({ job: job._id, status: { $in: ["SHORTLISTED", "INTERVIEW"] } })
      .populate({ path: "applicant", select: "name email" });
    let notificationCount = 0;
    for (const application of applications) {
      const pendingNotifications = [];
      for (let index = 0; index < job.recruitmentPipeline.length; index += 1) {
        const pipelineRound = job.recruitmentPipeline[index];
        const existing = application.recruitmentProgress.find((item) => item.roundId.equals(pipelineRound._id));
        const legacy = application.recruitmentRounds.find((item) => item.title.trim().toLowerCase() === pipelineRound.title.trim().toLowerCase() && (item.status !== "NOT_SCHEDULED" || item.scheduledAt));
        if (!existing && (index === 0 || legacy)) {
          const progress = application.recruitmentProgress.create({
            roundId: pipelineRound._id,
            eligibility: index === 0 ? "SHORTLISTED" : "NOT_ELIGIBLE",
            status: legacy ? legacy.status === "NOT_SCHEDULED" ? "NOT_STARTED" : legacy.status : "NOT_STARTED",
            ...(legacy ? { scheduledAt: legacy.scheduledAt, duration: legacy.duration, mode: legacy.mode, platform: legacy.platform, meetingLink: legacy.meetingLink, location: legacy.location, description: legacy.description, instructions: legacy.instructions, interviewer: legacy.interviewer, result: legacy.result, completedAt: legacy.completedAt, evaluation: legacy.evaluation } : {}),
          });
          application.recruitmentProgress.push(progress);
        }
      }
      for (const definition of job.recruitmentPipeline) {
        if (!changedSchedules.has(definition._id.toString())) continue;
        const progress = application.recruitmentProgress.find((item) => item.roundId.equals(definition._id));
        if (!progress || progress.eligibility !== "SHORTLISTED" || ["PASSED", "FAILED", "CANCELLED"].includes(progress.status)) continue;
        const rescheduled = progress.status === "SCHEDULED";
        if (rescheduled) progress.scheduleHistory.push({ scheduledAt: progress.scheduledAt, duration: progress.duration, mode: progress.mode, platform: progress.platform, meetingLink: progress.meetingLink, location: progress.location, changedAt: new Date() });
        Object.assign(progress, { scheduledAt: definition.scheduledAt, duration: definition.duration, mode: definition.mode, platform: definition.platform, meetingLink: definition.link, location: definition.location, description: definition.description, instructions: definition.instructions, interviewer: definition.interviewerLabels, interviewerInstructions: definition.interviewerInstructions, status: "SCHEDULED" });
        progress.history.push({ event: rescheduled ? "RESCHEDULED" : "SCHEDULED", message: rescheduled ? "Round rescheduled from recruitment pipeline" : "Round scheduled from recruitment pipeline", changedAt: new Date(), changedBy: req.user._id });
        pendingNotifications.push({ definition, progress, event: rescheduled ? "Rescheduled" : "Scheduled" });
      }
      await application.save();
      for (const { definition, progress, event } of pendingNotifications) {
        notificationCount += 1;
        const round = { ...definition.toObject(), ...progress.toObject(), _id: definition._id, title: definition.title, type: definition.type };
        const time = new Date(definition.scheduledAt).toLocaleString("en-IN", { timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
        try {
          await createNotification({ recipient: application.applicant._id, type: "RECRUITMENT_UPDATE", title: `${definition.title} ${event.toLowerCase()}`, message: `Your ${definition.title} for ${job.title} is ${event.toLowerCase()} for ${time}.`, relatedJob: job._id, relatedApplication: application._id });
        } catch (error) { console.error("Recruitment notification failed:", error.message); }
        deliverRecruitmentEmail(application.applicant, job, round, event);
      }
    }
    return res.json({ success: true, pipeline: job.recruitmentPipeline, notificationCount });
  } catch (error) {
    console.error("Recruitment pipeline save failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save the job recruitment pipeline." });
  }
}

async function deleteJob(req, res) {
  if (!validJobId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Job ID is invalid." });
  }

  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found." });
    if (job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only delete your own jobs." });
    }

    await job.deleteOne();
    return res.json({ success: true, message: "Job deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to delete job." });
  }
}

module.exports = { createJob, getJobs, getJobById, getJobMatch, getMyJobs, updateJob, deleteJob, saveRecruitmentPipeline };
