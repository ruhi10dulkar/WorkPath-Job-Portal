const mongoose = require("mongoose");
const Application = require("../models/Application");
const Job = require("../models/Job");
const CandidateProfile = require("../models/CandidateProfile");
const { createNotification } = require("../services/notificationService");
const { sendApplicationSubmittedEmail, sendApplicationStatusEmail, sendRecruitmentUpdateEmail } = require("../services/emailService");
const { getProfileReadiness } = require("../services/profileReadiness");
const { sendResume } = require("./profileController");
const resumeStorage = require("../services/resumeStorage");
const { calculateJobFit } = require("../services/jobFit");

function deliverEmailInBackground(emailPromise, event) {
  Promise.resolve().then(() => emailPromise()).catch((error) => {
    console.error(`${event} email failed:`, error.message);
  });
}

const APPLICATION_STATUSES = ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"];
const LEGACY_STATUSES = { applied: "APPLIED", reviewed: "UNDER_REVIEW", shortlisted: "SHORTLISTED", accepted: "SELECTED", rejected: "REJECTED" };
function normalizeApplication(application) {
  const data = application.toObject ? application.toObject() : application;
  data.status = LEGACY_STATUSES[data.status] || data.status;
  data.statusHistory = (data.statusHistory || []).map((entry) => {
    const item = entry.toObject ? entry.toObject() : entry;
    return { ...item, status: LEGACY_STATUSES[item.status] || item.status };
  });
  if (!data.statusHistory.length && data.appliedAt) data.statusHistory = [{ status: "APPLIED", changedAt: data.appliedAt, changedBy: "candidate" }];
  return data;
}

async function applyToJob(req, res) {
  const { jobId } = req.params;
  if (!mongoose.isValidObjectId(jobId)) {
    return res.status(400).json({ success: false, message: "Job ID is invalid." });
  }

  try {
    const job = await Job.findById(jobId).select("_id title recruiter")
      .populate({ path: "recruiter", select: "_id name email" });
    if (!job) return res.status(404).json({ success: false, message: "Job not found." });

    const existing = await Application.findOne({ job: jobId, applicant: req.user._id }).select("_id");
    if (existing) {
      return res.status(409).json({ success: false, code: "ALREADY_APPLIED", message: "You've already applied to this job.", applicationId: existing._id });
    }

    const profile = await CandidateProfile.findOne({ user: req.user._id }).select("+resume.storageKey +profilePhoto.storageKey");
    const readiness = getProfileReadiness(profile);
    if (!readiness.ready) {
      return res.status(422).json({ success: false, code: "PROFILE_INCOMPLETE", message: "Complete your profile before applying.", readiness });
    }
    const reviewedAt = req.body?.profileUpdatedAt;
    if (reviewedAt !== undefined) {
      const reviewedTime = new Date(reviewedAt).getTime();
      if (!Number.isFinite(reviewedTime) || reviewedTime !== new Date(profile.updatedAt).getTime()) {
        return res.status(409).json({ success: false, code: "PROFILE_CHANGED", message: "Your profile changed after review. Please review the latest version before applying." });
      }
    }
    const candidate = profile.toObject();
    const profileSnapshot = {
      ...candidate.basicInfo,
      email: req.user.email,
      profilePhotoUrl: candidate.profilePhoto?.storageKey ? `/api/profile/photo/${candidate.profilePhoto.storageKey}` : "",
      education: candidate.education,
      skills: candidate.skills,
      isFresher: candidate.isFresher,
      experience: candidate.experience,
      projects: candidate.projects,
      certifications: candidate.certifications,
      preferences: candidate.preferences,
    };
    const resumeSnapshot = {
      versionId: candidate.resume.versionId,
      storageKey: candidate.resume.storageKey,
      originalName: candidate.resume.originalName,
      contentType: candidate.resume.contentType,
      size: candidate.resume.size,
      uploadedAt: candidate.resume.uploadedAt,
    };
    const application = await Application.create({ job: jobId, applicant: req.user._id, profileSnapshot, resumeSnapshot, statusHistory: [{ status: "APPLIED", changedAt: new Date(), changedBy: "candidate" }] });
    try {
      await createNotification({
        recipient: job.recruiter._id,
        type: "APPLICATION_SUBMITTED",
        title: "New application received",
        message: `${req.user.name} has applied for your ${job.title} job.`,
        relatedJob: job._id,
        relatedApplication: application._id,
      });
    } catch (error) {
      console.error("Application notification creation failed:", error.message);
    }
    deliverEmailInBackground(
      () => sendApplicationSubmittedEmail(job.recruiter, req.user.name, job.title),
      "Application submitted"
    );
    return res.status(201).json({ success: true, application: { _id: application._id, job: application.job, applicant: application.applicant, status: application.status, appliedAt: application.appliedAt, statusHistory: application.statusHistory } });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Application.findOne({ job: jobId, applicant: req.user._id }).select("_id").catch(() => null);
      return res.status(409).json({ success: false, code: "ALREADY_APPLIED", message: "You've already applied to this job.", applicationId: existing?._id });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Job ID is invalid." });
    }
    return res.status(500).json({ success: false, message: "Unable to submit your application." });
  }
}

async function getMyApplications(req, res) {
  try {
    const profile = await CandidateProfile.findOne({ user: req.user._id }).select("skills education experience projects certifications basicInfo.currentLocation").lean();
    const applications = await Application.find({ applicant: req.user._id })
      .select("job status appliedAt statusHistory")
      .populate({ path: "job", select: "title company location employmentType skills requiredSkills preferredSkills minExperienceYears maxExperienceYears experienceLevel educationRequirements" })
      .sort({ appliedAt: -1 });
    return res.json({ success: true, applications: applications.map((application) => {
      const result = normalizeApplication(application);
      result.jobFit = calculateJobFit(profile || {}, application.job || {});
      return result;
    }) });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load your applications." });
  }
}

async function getApplicationForJob(req, res) {
  const { jobId } = req.params;
  if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ success: false, message: "Job ID is invalid." });
  try {
    const application = await Application.findOne({ job: jobId, applicant: req.user._id })
      .select("_id job status appliedAt")
      .lean();
    if (!application) return res.json({ success: true, hasApplied: false, application: null });
    application.status = LEGACY_STATUSES[application.status] || application.status;
    return res.json({ success: true, hasApplied: true, application });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to check your application status." });
  }
}

async function getRecruiterApplications(req, res) {
  const { status } = req.query;
  const normalizedStatus = LEGACY_STATUSES[status] || status;
  if (status !== undefined && !APPLICATION_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({ success: false, message: "Application status is invalid." });
  }
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
  const fitMin = req.query.fitMin === undefined || req.query.fitMin === "" ? null : Number(req.query.fitMin);
  if (fitMin !== null && (!Number.isInteger(fitMin) || fitMin < 0 || fitMin > 100)) return res.status(400).json({ success: false, message: "Job fit filter must be between 0 and 100." });
  const sortBy = req.query.sort || "newest";
  const sortOptions = { newest: { appliedAt: -1 }, oldest: { appliedAt: 1 }, name: { "profileSnapshot.fullName": 1, appliedAt: -1 }, updated: { "statusHistory.changedAt": -1, appliedAt: -1 }, fitHigh: {}, fitLow: {} };
  if (!sortOptions[sortBy]) return res.status(400).json({ success: false, message: "Application sort is invalid." });
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const location = typeof req.query.location === "string" ? req.query.location.trim().slice(0, 120) : "";
  const skill = typeof req.query.skill === "string" ? req.query.skill.trim().slice(0, 50) : "";
  const query = {};
  if (normalizedStatus) query.status = { $in: [normalizedStatus, ...Object.keys(LEGACY_STATUSES).filter((old) => LEGACY_STATUSES[old] === normalizedStatus)] };
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    query.$or = [{ "profileSnapshot.fullName": expression }, { "profileSnapshot.email": expression }];
  }
  if (location) query["profileSnapshot.currentLocation"] = new RegExp(escapeRegex(location), "i");
  if (skill) query["profileSnapshot.skills"] = new RegExp(`^${escapeRegex(skill)}$`, "i");
  if (req.query.from || req.query.to) {
    query.appliedAt = {};
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime()))) return res.status(400).json({ success: false, message: "Application date filter is invalid." });
    if (from) query.appliedAt.$gte = from;
    if (to) { to.setUTCHours(23, 59, 59, 999); query.appliedAt.$lte = to; }
  }
  if (req.query.experience === "fresher") query["profileSnapshot.isFresher"] = true;
  else if (req.query.experience && !["0-1", "1-3", "3+"].includes(req.query.experience)) return res.status(400).json({ success: false, message: "Experience filter is invalid." });

  try {
    if (req.query.jobId && !mongoose.isValidObjectId(req.query.jobId)) return res.status(400).json({ success: false, message: "Job ID is invalid." });
    const scopeJobIds = await Job.find({ recruiter: req.user._id }).distinct("_id");
    if (req.query.jobId && !scopeJobIds.some((id) => id.toString() === req.query.jobId)) return res.status(403).json({ success: false, message: "You do not manage this job." });
    const baseQuery = { ...query, job: req.query.jobId ? new mongoose.Types.ObjectId(req.query.jobId) : { $in: scopeJobIds } };
    const searchStages = search ? [
      { $lookup: { from: "users", localField: "applicant", foreignField: "_id", as: "__candidate" } },
      { $unwind: { path: "$__candidate", preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ "profileSnapshot.fullName": new RegExp(escapeRegex(search), "i") }, { "profileSnapshot.email": new RegExp(escapeRegex(search), "i") }, { "__candidate.name": new RegExp(escapeRegex(search), "i") }, { "__candidate.email": new RegExp(escapeRegex(search), "i") }] } },
    ] : [];
    if (search) delete baseQuery.$or;
    const experienceStages = [{ $addFields: { __experienceYears: { $divide: [{ $reduce: {
        input: { $ifNull: ["$profileSnapshot.experience", []] }, initialValue: 0,
        in: { $add: ["$$value", { $max: [0, { $subtract: [{ $ifNull: ["$$this.endDate", "$$NOW"] }, { $ifNull: ["$$this.startDate", "$$NOW"] }] }] }] },
      } }, 31557600000] } } }];
    if (req.query.experience === "fresher") experienceStages.push({ $match: { "profileSnapshot.isFresher": true } });
    else if (req.query.experience) {
      const bounds = { "0-1": { $lt: 1 }, "1-3": { $gte: 1, $lt: 3 }, "3+": { $gte: 3 } }[req.query.experience];
      experienceStages.push({ $match: { __experienceYears: bounds } });
    }
    const filteredPipeline = [{ $match: baseQuery }, ...searchStages, ...experienceStages];
    const docs = await Application.aggregate([
      ...filteredPipeline,
      { $lookup: { from: "users", localField: "applicant", foreignField: "_id", as: "applicant" } },
      { $unwind: { path: "$applicant", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "job" } },
      { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
      { $project: { job: { _id: "$job._id", title: "$job.title", company: "$job.company", location: "$job.location", skills: "$job.skills", requiredSkills: "$job.requiredSkills", preferredSkills: "$job.preferredSkills", minExperienceYears: "$job.minExperienceYears", maxExperienceYears: "$job.maxExperienceYears", experienceLevel: "$job.experienceLevel", educationRequirements: "$job.educationRequirements", recruitmentPipeline: "$job.recruitmentPipeline" }, applicant: { name: "$applicant.name", email: "$applicant.email" }, status: 1, appliedAt: 1, profileSnapshot: 1, resumeSnapshot: 1, statusHistory: 1, recruitmentProgress: 1, experienceYears: "$__experienceYears" } },
      { $unset: ["resumeSnapshot.storageKey", "profileSnapshot.preferences", "__candidate"] },
    ]);
    const scored = docs.map((item) => {
      const pipeline = item.job?.recruitmentPipeline || [];
      const progress = item.recruitmentProgress || [];
      const progressed = pipeline.map((definition) => ({ definition, progress: progress.find((row) => String(row.roundId) === String(definition._id)) })).filter(({ progress: row }) => row?.eligibility === "SHORTLISTED");
      const active = progressed.find(({ progress: row }) => !["PASSED", "FAILED", "CANCELLED"].includes(row.status));
      const current = active || progressed.at(-1);
      const roundStatus = current?.progress.status;
      const stageStatus = ({ SCHEDULED: "Scheduled", PASSED: "Completed", COMPLETED: "Completed", FAILED: "Completed", CANCELLED: "Cancelled", IN_PROGRESS: "In progress", NOT_STARTED: "Eligible" })[roundStatus] || (current ? "Eligible" : item.status === "SELECTED" ? "Selected" : item.status === "REJECTED" ? "Rejected" : "—");
      const stageManagement = req.query.includeStageData === "true" ? pipeline.map((definition, stageIndex) => {
        const row = progress.find((entry) => String(entry.roundId) === String(definition._id));
        const previous = stageIndex > 0 ? progress.find((entry) => String(entry.roundId) === String(pipeline[stageIndex - 1]._id)) : null;
        const next = stageIndex < pipeline.length - 1 ? progress.find((entry) => String(entry.roundId) === String(pipeline[stageIndex + 1]._id)) : null;
        const eligible = stageIndex === 0 ? ["SHORTLISTED", "INTERVIEW"].includes(item.status) : row?.eligibility === "SHORTLISTED" && previous?.status === "PASSED";
        const status = row?.status || (eligible ? "ELIGIBLE" : "NOT_STARTED");
        let bucket = eligible ? (status === "SCHEDULED" ? "scheduled" : ["PASSED", "FAILED", "COMPLETED"].includes(status) ? "completed" : "eligible") : null;
        if (row?.eligibility === "NOT_SHORTLISTED" || next?.eligibility === "NOT_SHORTLISTED") bucket = "notShortlisted";
        else if (eligible && status === "PASSED" && (next?.eligibility === "SHORTLISTED" || item.status === "SELECTED" && stageIndex === pipeline.length - 1)) bucket = "shortlisted";
        return { roundId: definition._id, title: definition.title, order: definition.order, bucket, status, result: row?.result || (status === "PASSED" ? "PASSED" : status === "FAILED" ? "FAILED" : null), scheduledAt: row?.scheduledAt || null, eligibility: eligible ? "ELIGIBLE" : row?.eligibility || "NOT_ELIGIBLE" };
      }) : undefined;
      return { ...item, ...(stageManagement ? { recruitmentStageManagement: stageManagement } : {}), currentRecruitmentStage: current?.definition.title || "—", recruitmentStageStatus: stageStatus, currentRecruitmentRoundId: current?.definition._id || null, currentRecruitmentRoundType: current?.definition.type || null, currentRecruitmentDuration: current?.progress.duration || current?.definition.duration || 45, currentRecruitmentMode: current?.progress.mode || current?.definition.mode || "ONLINE", currentRecruitmentPlatform: current?.progress.platform || current?.definition.platform || "", currentRecruitmentLink: current?.progress.meetingLink || current?.definition.link || "", currentRecruitmentInstructions: current?.progress.instructions || current?.definition.instructions || "", currentRecruitmentInterviewerLabels: current?.progress.interviewer || current?.definition.interviewerLabels || "", currentRecruitmentInterviewerInstructions: current?.progress.interviewerInstructions || current?.definition.interviewerInstructions || "", recruitmentScheduledAt: current?.progress.scheduledAt || null, jobFit: calculateJobFit(item.profileSnapshot || {}, item.job || {}) };
    });
    const matching = scored.filter((item) => fitMin === null || item.jobFit.score >= fitMin);
    if (sortBy === "fitHigh") matching.sort((a, b) => b.jobFit.score - a.jobFit.score || new Date(b.appliedAt) - new Date(a.appliedAt));
    else if (sortBy === "fitLow") matching.sort((a, b) => a.jobFit.score - b.jobFit.score || new Date(b.appliedAt) - new Date(a.appliedAt));
    else matching.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.appliedAt) - new Date(a.appliedAt);
      if (sortBy === "oldest") return new Date(a.appliedAt) - new Date(b.appliedAt);
      if (sortBy === "name") return String(a.profileSnapshot?.fullName || "").localeCompare(String(b.profileSnapshot?.fullName || ""));
      return new Date(b.statusHistory?.at(-1)?.changedAt || b.appliedAt) - new Date(a.statusHistory?.at(-1)?.changedAt || a.appliedAt);
    });
    const total = matching.length;
    const paged = matching.slice((page - 1) * limit, page * limit);
    const grouped = await Application.aggregate([{ $match: { job: { $in: scopeJobIds } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((item) => [item, 0]));
    for (const item of grouped) { const key = LEGACY_STATUSES[item._id] || item._id; if (counts[key] !== undefined) counts[key] += item.count; }
    const applications = paged.map((item) => { delete item.recruitmentProgress; if (item.job) delete item.job.recruitmentPipeline; return normalizeApplication(item); });
    let stageManagement;
    if (req.query.includeStageData === "true" && req.query.jobId) {
      const definitions = docs[0]?.job?.recruitmentPipeline || [];
      stageManagement = definitions.map((definition) => {
        const buckets = { eligible: [], scheduled: [], completed: [], shortlisted: [], notShortlisted: [] };
        for (const candidate of scored) {
          const state = candidate.recruitmentStageManagement?.find((entry) => String(entry.roundId) === String(definition._id));
          if (state?.bucket) buckets[state.bucket].push({ _id: candidate._id, applicant: candidate.applicant, profileSnapshot: candidate.profileSnapshot, status: candidate.status, appliedAt: candidate.appliedAt, stage: state });
        }
        return { roundId: definition._id, title: definition.title, order: definition.order, counts: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])), candidates: buckets };
      });
    }
    return res.json({ success: true, applications, ...(stageManagement ? { stageManagement } : {}), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, counts });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load applications." });
  }
}

function invalidApplicationId(res, id) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ success: false, message: "Application ID is invalid." });
    return true;
  }
  return false;
}

async function getApplicationById(req, res) {
  if (invalidApplicationId(res, req.params.id)) return;
  try {
    const application = await Application.findById(req.params.id)
      .select("job applicant status appliedAt profileSnapshot resumeSnapshot statusHistory recruiterNotes recruiterNoteEntries recruitmentRounds recruitmentProgress")
      .populate({ path: "job", select: "title company location employmentType recruiter skills requiredSkills preferredSkills minExperienceYears maxExperienceYears experienceLevel educationRequirements recruitmentPipeline" })
      .populate({ path: "applicant", select: "name email" });
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });

    const isRecruiter = req.user.role === "recruiter";
    const recruiterId = application.job?.recruiter?._id || application.job?.recruiter;
    const isOwner = isRecruiter
      ? recruiterId?.toString() === req.user._id.toString()
      : application.applicant?._id.equals(req.user._id);
    if (!isOwner) return res.status(403).json({ success: false, message: "You do not have permission to access this application." });

    const result = normalizeApplication(application);
    const hasRecruitmentProgress = application.recruitmentProgress.length > 0 || application.recruitmentRounds.some((round) => round.status !== "NOT_SCHEDULED" || round.scheduledAt);
    const recruitmentStarted = hasRecruitmentProgress || ["SHORTLISTED", "INTERVIEW"].includes(application.status);
    const pipeline = recruitmentStarted ? application.job?.recruitmentPipeline || [] : [];
    result.recruitmentRounds = pipeline.map((round) => {
      const saved = application.recruitmentProgress?.find((item) => item.roundId.equals(round._id));
      const legacy = application.recruitmentRounds?.find((item) => item.title.trim().toLowerCase() === round.title.trim().toLowerCase());
      const row = { ...(round.toObject ? round.toObject() : round), ...(saved?.toObject ? saved.toObject() : saved || {}), title: round.title, type: round.type, order: round.order, eligibility: saved?.eligibility || (round.order === 0 && ["SHORTLISTED", "INTERVIEW"].includes(application.status) ? "SHORTLISTED" : "NOT_ELIGIBLE"), status: saved?.status || (round.order === 0 && ["SHORTLISTED", "INTERVIEW"].includes(application.status) ? "ELIGIBLE" : "NOT_STARTED"), description: saved?.description || round.description, instructions: saved?.instructions || round.instructions };
      row.decisionHistory = (saved?.history || []).filter((entry) => ["SHORTLISTED", "NOT_SHORTLISTED", "SHORTLISTED_FOR_NEXT_ROUND"].includes(entry.event)).map((entry) => ({ event: entry.event, message: entry.message, changedAt: entry.changedAt }));
      delete row.evaluation;
      if (!saved) { row.duration = round.duration; row.mode = round.mode; row.platform = round.platform; row.meetingLink = round.link; row.interviewerIds = round.interviewerIds; }
      if (!saved && legacy) Object.assign(row, { status: legacy.status, scheduledAt: legacy.scheduledAt, duration: legacy.duration, mode: legacy.mode, platform: legacy.platform, meetingLink: legacy.meetingLink, location: legacy.location, completedAt: legacy.completedAt, result: legacy.result });
      if (!row.eligibility && round.order === 0 && ["SHORTLISTED", "INTERVIEW"].includes(application.status)) row.eligibility = "SHORTLISTED";
      return row;
    }).sort((a, b) => a.order - b.order);
    const activeStage = result.recruitmentRounds.find((round) => round.eligibility === "SHORTLISTED" && !["PASSED", "FAILED", "CANCELLED", "NOT_SHORTLISTED"].includes(round.status));
    const failedStage = result.recruitmentRounds.find((round) => round.status === "FAILED");
    const declinedStage = result.recruitmentRounds.find((round) => round.eligibility === "NOT_SHORTLISTED");
    const currentStageRound = activeStage || declinedStage || failedStage || [...result.recruitmentRounds].reverse().find((round) => round.eligibility === "SHORTLISTED") || null;
    result.currentRecruitmentRoundId = currentStageRound?._id || null;
    result.currentRecruitmentRoundStatus = currentStageRound?.status || null;
    result.currentRecruitmentRoundEligibility = currentStageRound?.eligibility || null;
    result.currentRecruitmentStage = application.status === "SELECTED" ? "Selected" : application.status === "REJECTED" ? "Rejected" : activeStage?.title || (declinedStage ? `${declinedStage.title} — not shortlisted` : failedStage ? `${failedStage.title} — not progressing` : result.recruitmentRounds.some((round) => round.status === "PASSED") ? "Awaiting next round selection" : null);
    const savedSnapshot = result.profileSnapshot;
    const snapshotHasDetails = Boolean(savedSnapshot && (
      savedSnapshot.fullName || savedSnapshot.phone || savedSnapshot.currentLocation || savedSnapshot.headline || savedSnapshot.summary
      || savedSnapshot.education?.length || savedSnapshot.skills?.length || savedSnapshot.experience?.length
      || savedSnapshot.projects?.length || savedSnapshot.certifications?.length
    ));
    if (!snapshotHasDetails && application.applicant?._id) {
      const candidateProfile = await CandidateProfile.findOne({ user: application.applicant._id })
        .select("basicInfo education skills isFresher experience projects certifications resume.originalName resume.contentType resume.size resume.uploadedAt profilePhoto.contentType +profilePhoto.storageKey")
        .lean();
      if (candidateProfile) {
        result.profileSnapshot = {
          ...candidateProfile.basicInfo,
          fullName: candidateProfile.basicInfo?.fullName || application.applicant.name,
          email: application.applicant.email,
          profilePhotoUrl: candidateProfile.profilePhoto?.storageKey ? `/api/profile/photo/${candidateProfile.profilePhoto.storageKey}` : "",
          education: candidateProfile.education || [],
          skills: candidateProfile.skills || [],
          isFresher: candidateProfile.isFresher ?? true,
          experience: candidateProfile.experience || [],
          projects: candidateProfile.projects || [],
          certifications: candidateProfile.certifications || [],
        };
        result.profileFallback = true;
        if (!result.resumeSnapshot?.originalName && candidateProfile.resume?.originalName) {
          result.resumeSnapshot = { ...candidateProfile.resume };
          delete result.resumeSnapshot.storageKey;
          result.resumeFallback = true;
        }
      }
    }
    if (isRecruiter) {
      result.recruiterNotes = application.recruiterNotes || "";
      result.recruiterNoteEntries = (application.recruiterNoteEntries || []).filter((note) => note.recruiter.equals(req.user._id));
    } else {
      delete result.recruiterNotes;
      delete result.recruiterNoteEntries;
      result.recruitmentRounds = result.recruitmentRounds.map((round) => {
        delete round.evaluation;
        delete round.interviewerInstructions;
        delete round.recruiterNotes;
        delete round.interviewer;
        delete round.interviewerLabels;
        delete round.interviewerIds;
        delete round.history;
        delete round.scheduleHistory;
        delete round.link;
        delete round.evaluationCriteria;
        const completedDeclinedRound = round.eligibility === "NOT_SHORTLISTED" && ["PASSED", "FAILED"].includes(round.status);
        if (round.eligibility !== "SHORTLISTED" && !completedDeclinedRound) {
          delete round.instructions;
          delete round.meetingLink;
          delete round.location;
          delete round.scheduledAt;
          delete round.duration;
          delete round.platform;
          delete round.mode;
        }
        return round;
      });
      delete result.recruitmentProgress;
      delete result.recruitmentRoundsLegacy;
    }
    result.jobFit = calculateJobFit(result.profileSnapshot || {}, application.job || {});
    return res.json({ success: true, application: result });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load application." });
  }
}

async function getApplicationResume(req, res) {
  if (invalidApplicationId(res, req.params.id)) return;
  if (!["applicant", "recruiter"].includes(req.user.role)) return res.status(403).json({ success: false, message: "You do not have permission to access this resume." });
  try {
    // Do not select both the resumeSnapshot parent and its hidden storageKey child:
    // MongoDB rejects that projection as a path collision. Selecting only the hidden
    // child with `+` keeps the rest of the document available while exposing the key here.
    const application = await Application.findById(req.params.id)
      .select("+resumeSnapshot.storageKey")
      .lean();
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    const applicantId = application.applicant;
    const isOwner = req.user.role === "applicant"
      ? applicantId?.toString() === req.user._id.toString()
      : Boolean(await Job.exists({ _id: application.job, recruiter: req.user._id }));
    if (!isOwner) return res.status(403).json({ success: false, message: "You do not have permission to access this resume." });
    let resume = application.resumeSnapshot;
    if (!application.resumeSnapshot?.storageKey) {
      const profile = await CandidateProfile.findOne({ user: applicantId }).select("+resume.storageKey").lean();
      if (!profile?.resume?.storageKey) return res.status(404).json({ success: false, message: "This application has no resume attached." });
      resume = profile.resume;
    }
    let filePath;
    try { filePath = await resumeStorage.getResumePath(applicantId, resume.storageKey); }
    catch (error) {
      if (error.code === "ENOENT") return res.status(404).json({ success: false, message: "The resume file is no longer available." });
      throw error;
    }
    return sendResume(res, filePath, resume.originalName, resume.contentType);
  } catch (error) {
    console.error("Application resume lookup failed:", error.message, error.code || "");
    return res.status(500).json({ success: false, message: "Unable to load the submitted resume." });
  }
}

async function updateApplicationStatus(req, res) {
  if (invalidApplicationId(res, req.params.id)) return;
  const status = LEGACY_STATUSES[req.body?.status] || req.body?.status;
  if (!APPLICATION_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Application status is invalid." });
  }

  try {
    const application = await Application.findById(req.params.id)
      .populate({ path: "job", select: "title company recruiter recruitmentPipeline" });
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    if (!application.job?.recruiter?.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: "You do not manage this application." });
    }

    // Older records may contain lower-case status values that predate the
    // current enum. Canonicalize the full history before Mongoose validates it.
    application.status = LEGACY_STATUSES[application.status] || application.status;
    application.statusHistory.forEach((entry) => {
      entry.status = LEGACY_STATUSES[entry.status] || entry.status;
    });
    const statusChanged = application.status !== status;
    if (statusChanged) {
      const current = LEGACY_STATUSES[application.status] || application.status;
      const allowed = {
        APPLIED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"],
        UNDER_REVIEW: ["SHORTLISTED", "REJECTED"],
        SHORTLISTED: ["INTERVIEW", "REJECTED"],
        INTERVIEW: ["SELECTED", "REJECTED"],
        SELECTED: [], REJECTED: [],
      };
      if (!allowed[current]?.includes(status)) return res.status(409).json({ success: false, message: `Cannot move an application from ${current} to ${status}.` });
      application.statusHistory.push({ status, changedAt: new Date(), changedBy: "recruiter" });
    }
    application.status = status;
    let pipelineScheduleNotification = null;
    if (statusChanged && status === "SHORTLISTED" && application.job?.recruitmentPipeline?.length) {
      const firstRound = [...application.job.recruitmentPipeline].sort((a, b) => a.order - b.order)[0];
      if (firstRound && !application.recruitmentProgress.some((entry) => entry.roundId.equals(firstRound._id))) {
        const scheduled = firstRound.scheduledAt && firstRound.scheduledAt > new Date();
        const progress = { roundId: firstRound._id, eligibility: "SHORTLISTED", status: scheduled ? "SCHEDULED" : "ELIGIBLE", shortlistedAt: new Date(), history: [{ event: "SHORTLISTED", message: `Shortlisted for ${firstRound.title}`, changedAt: new Date(), changedBy: req.user._id }] };
        if (scheduled) Object.assign(progress, { scheduledAt: firstRound.scheduledAt, duration: firstRound.duration, mode: firstRound.mode, platform: firstRound.platform, meetingLink: firstRound.link, location: firstRound.location, description: firstRound.description, instructions: firstRound.instructions, interviewer: firstRound.interviewerLabels, interviewerInstructions: firstRound.interviewerInstructions });
        application.recruitmentProgress.push(progress);
        if (scheduled) pipelineScheduleNotification = firstRound;
      }
    }
    await application.save();
    await application.populate([
      { path: "job", select: "title company location" },
      { path: "applicant", select: "name email" },
    ]);
    if (statusChanged) {
      try {
        await createNotification({
          recipient: application.applicant._id,
          type: "APPLICATION_STATUS_CHANGED",
          title: "Application status updated",
          message: `Your application for ${application.job.title} is now ${status}.`,
          relatedJob: application.job._id,
          relatedApplication: application._id,
        });
      } catch (error) {
        console.error("Application status notification creation failed:", error.message);
      }
      deliverEmailInBackground(
        () => sendApplicationStatusEmail(application.applicant, application.job.title, status),
        "Application status"
      );
      if (pipelineScheduleNotification) {
        const firstRound = pipelineScheduleNotification;
        const scheduledAt = firstRound.scheduledAt.toLocaleString("en-IN", { timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
        try {
          await createNotification({ recipient: application.applicant._id, type: "RECRUITMENT_UPDATE", title: `${firstRound.title} scheduled`, message: `Your ${firstRound.title} for ${application.job.title} is scheduled for ${scheduledAt}.`, relatedJob: application.job._id, relatedApplication: application._id });
        } catch (error) { console.error("Recruitment notification failed:", error.message); }
        const round = { ...firstRound.toObject(), scheduledAt: firstRound.scheduledAt, duration: firstRound.duration, mode: firstRound.mode, platform: firstRound.platform, meetingLink: firstRound.link, location: firstRound.location, description: firstRound.description, instructions: firstRound.instructions, interviewer: firstRound.interviewerLabels };
        deliverEmailInBackground(() => sendRecruitmentUpdateEmail(application.applicant, application.job, round, "Scheduled"), "Recruitment update");
      }
    }
    return res.json({ success: true, application: normalizeApplication(application) });
  } catch (error) {
    console.error("Application status update failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update application status." });
  }
}

async function updateRecruiterNotes(req, res) {
  if (invalidApplicationId(res, req.params.id)) return;
  const notes = req.body?.notes;
  if (typeof notes !== "string" || notes.length > 5000) return res.status(400).json({ success: false, message: "Notes must be text up to 5000 characters." });
  try {
    const application = await Application.findById(req.params.id).populate({ path: "job", select: "recruiter" });
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    if (!application.job?.recruiter?.equals(req.user._id)) return res.status(403).json({ success: false, message: "You do not manage this application." });
    if (LEGACY_STATUSES[application.status]) {
      application.status = LEGACY_STATUSES[application.status];
      if (!application.statusHistory.length) application.statusHistory.push({ status: application.status, changedAt: application.appliedAt, changedBy: "system" });
    }
    application.recruiterNotes = notes.trim();
    await application.save();
    return res.json({ success: true, notes: application.recruiterNotes });
  } catch { return res.status(500).json({ success: false, message: "Unable to save recruiter notes." }); }
}

async function manageRecruiterNote(req, res) {
  if (invalidApplicationId(res, req.params.id)) return;
  const { action } = req.params;
  const text = req.body?.text;
  if (!["add", "edit", "delete"].includes(action)) return res.status(404).json({ success: false, message: "Note action is invalid." });
  if (action !== "delete" && (typeof text !== "string" || !text.trim() || text.trim().length > 2000)) return res.status(400).json({ success: false, message: "A note must contain 1 to 2000 characters." });
  try {
    const application = await Application.findById(req.params.id).populate({ path: "job", select: "recruiter" });
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    if (!application.job?.recruiter?.equals(req.user._id)) return res.status(403).json({ success: false, message: "You do not manage this application." });
    let note;
    if (action === "add") {
      application.recruiterNoteEntries.push({ recruiter: req.user._id, text: text.trim() });
      note = application.recruiterNoteEntries.at(-1);
    } else {
      if (!mongoose.isValidObjectId(req.params.noteId)) return res.status(400).json({ success: false, message: "Note ID is invalid." });
      note = application.recruiterNoteEntries.id(req.params.noteId);
      if (!note || !note.recruiter.equals(req.user._id)) return res.status(404).json({ success: false, message: "Note not found." });
      if (action === "edit") { note.text = text.trim(); note.updatedAt = new Date(); }
      else note.deleteOne();
    }
    await application.save();
    return res.json({ success: true, note: action === "delete" ? null : note.toObject() });
  } catch { return res.status(500).json({ success: false, message: "Unable to update recruiter note." }); }
}

async function manageRecruitment(req, res) {
  if (invalidApplicationId(res, req.params.id)) return;
  try {
    const application = await Application.findById(req.params.id)
      .populate({ path: "job", select: "title company recruiter recruitmentPipeline" })
      .populate({ path: "applicant", select: "name email" });
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    if (!application.job?.recruiter?.equals(req.user._id)) return res.status(403).json({ success: false, message: "You do not manage this application." });
    if (["REJECTED", "SELECTED"].includes(application.status)) return res.status(409).json({ success: false, message: "This application is closed." });
    if (!["SHORTLISTED", "INTERVIEW"].includes(application.status)) return res.status(409).json({ success: false, message: "Only shortlisted candidates can progress through recruitment rounds." });
    if (!mongoose.isValidObjectId(req.params.roundId)) return res.status(400).json({ success: false, message: "Pipeline round ID is invalid." });

    const pipeline = application.job.recruitmentPipeline || [];
    const definition = pipeline.id(req.params.roundId);
    if (!definition) return res.status(404).json({ success: false, message: "This round is no longer part of the job pipeline." });
    const index = pipeline.findIndex((item) => item._id.equals(definition._id));
    let progress = application.recruitmentProgress.find((item) => item.roundId.equals(definition._id));
    if (!progress) {
      progress = application.recruitmentProgress.create({ roundId: definition._id, eligibility: index === 0 ? "SHORTLISTED" : "NOT_ELIGIBLE" });
      application.recruitmentProgress.push(progress);
    }
    const roundView = () => ({ ...definition.toObject(), ...(progress.toObject ? progress.toObject() : progress), _id: definition._id, title: definition.title, type: definition.type });
    const notify = async (event, sendEmail = true, context = {}) => {
      const round = roundView();
      round.previousRoundTitle = context.previousRoundTitle || "";
      const time = round.scheduledAt ? new Date(round.scheduledAt).toLocaleString("en-IN", { timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "";
      const message = event === "Shortlisted"
        ? `You have been shortlisted for the ${round.title} for ${application.job.title}${round.previousRoundTitle ? ` after completing ${round.previousRoundTitle}` : ""}. ${time ? `It is scheduled for ${time}${round.platform ? ` on ${round.platform}` : ""}.` : "Your interview schedule will be shared through WorkPath once it is scheduled."}`
        : event === "Not shortlisted"
          ? `You were not shortlisted for the next round after ${context.previousRoundTitle || round.title} for ${application.job.title}. The recruitment process has ended for this application.`
          : `Your ${round.title} for ${application.job.title} is ${event.toLowerCase()}${time ? ` for ${time}` : ""}${round.platform ? ` on ${round.platform}` : ""}.`;
      try { await createNotification({ recipient: application.applicant._id, type: "RECRUITMENT_UPDATE", title: event === "Shortlisted" ? `Shortlisted for ${round.title}` : event === "Not shortlisted" ? "Recruitment process update" : `${round.title} ${event.toLowerCase()}`, message, relatedJob: application.job._id, relatedApplication: application._id }); }
      catch (error) { console.error("Recruitment notification failed:", error.message); }
      if (sendEmail) deliverEmailInBackground(() => sendRecruitmentUpdateEmail(application.applicant, application.job, round, event), "Recruitment update");
    };

    const { action } = req.body || {};
    if (action === "shortlist") {
      const previous = index > 0 && application.recruitmentProgress.find((item) => item.roundId.equals(pipeline[index - 1]._id));
      if (progress.eligibility === "SHORTLISTED") return res.status(409).json({ success: false, message: "This candidate is already shortlisted for this round." });
      if (progress.eligibility === "NOT_SHORTLISTED") return res.status(409).json({ success: false, message: "This candidate has already been declined from progressing beyond this round." });
      const previousWasEligible = previous?.eligibility === "SHORTLISTED";
      const previousPassed = previousWasEligible && previous.status === "PASSED";
      if (index === 0 || !previous || !previousPassed) return res.status(409).json({ success: false, message: "The previous round must be completed and passed before shortlisting for this stage." });
      if (["FAILED", "CANCELLED"].includes(progress.status)) return res.status(409).json({ success: false, message: "This candidate cannot progress from this round." });
      progress.eligibility = "SHORTLISTED";
      progress.shortlistedAt = new Date();
      const hasPipelineSchedule = definition.scheduledAt && definition.scheduledAt > new Date();
      progress.status = hasPipelineSchedule ? "SCHEDULED" : "ELIGIBLE";
      if (hasPipelineSchedule) Object.assign(progress, { scheduledAt: definition.scheduledAt, duration: definition.duration, mode: definition.mode, platform: definition.platform, meetingLink: definition.link, location: definition.location, description: definition.description, instructions: definition.instructions, interviewer: definition.interviewerLabels, interviewerInstructions: definition.interviewerInstructions });
      progress.history.push({ event: "SHORTLISTED", message: `Shortlisted for ${definition.title}`, changedAt: new Date(), changedBy: req.user._id });
      previous.history.push({ event: "SHORTLISTED_FOR_NEXT_ROUND", message: `Shortlisted for ${definition.title}`, changedAt: new Date(), changedBy: req.user._id });
      if (hasPipelineSchedule) progress.history.push({ event: "SCHEDULED", message: "Scheduled from the recruitment pipeline", changedAt: new Date(), changedBy: req.user._id });
      await application.save();
      await notify("Shortlisted", true, { previousRoundTitle: pipeline[index - 1]?.title });
      if (hasPipelineSchedule) await notify("Scheduled", true, { previousRoundTitle: pipeline[index - 1]?.title });
      return res.json({ success: true });
    }

    if (action === "notShortlist") {
      if (progress.eligibility !== "SHORTLISTED" || progress.status !== "PASSED") return res.status(409).json({ success: false, message: "Complete and pass this round before recording a shortlisting decision." });
      progress.eligibility = "NOT_SHORTLISTED";
      progress.rejectedAt = new Date();
      progress.history.push({ event: "NOT_SHORTLISTED", message: `Not shortlisted after ${definition.title}`, changedAt: new Date(), changedBy: req.user._id });
      await application.save();
      await notify("Not shortlisted", true, { previousRoundTitle: definition.title });
      return res.json({ success: true });
    }

    if (action === "schedule" || action === "reschedule") {
      if (progress.eligibility !== "SHORTLISTED") return res.status(409).json({ success: false, message: "Shortlist this candidate for the round before scheduling." });
      const scheduledAt = new Date(req.body.scheduledAt);
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date() || !Number.isInteger(Number(req.body.duration)) || Number(req.body.duration) < 5 || Number(req.body.duration) > 480 || !["ONLINE", "IN_PERSON"].includes(req.body.mode)) return res.status(400).json({ success: false, message: "Provide a future date, valid duration, and mode." });
      const meetingLink = String(req.body.meetingLink || definition.link || "").trim();
      const platform = String(req.body.platform || definition.platform || "").trim();
      if (meetingLink && (!/^https?:\/\//i.test(meetingLink) || !URL.canParse(meetingLink))) return res.status(400).json({ success: false, message: "Enter a valid meeting URL." });
      if (req.body.mode === "IN_PERSON" && !req.body.location?.trim()) return res.status(400).json({ success: false, message: "Enter the interview location." });
      if (!["ELIGIBLE", "NOT_STARTED", "SCHEDULED"].includes(progress.status)) return res.status(409).json({ success: false, message: "This round cannot be scheduled in its current state." });
      const rescheduled = progress.status === "SCHEDULED";
      if (rescheduled) progress.scheduleHistory.push({ scheduledAt: progress.scheduledAt, duration: progress.duration, mode: progress.mode, platform: progress.platform, meetingLink: progress.meetingLink, location: progress.location, changedAt: new Date(), changedBy: req.user._id });
      Object.assign(progress, { scheduledAt, duration: Number(req.body.duration), mode: req.body.mode, platform: platform.slice(0, 100), meetingLink, location: req.body.mode === "IN_PERSON" ? String(req.body.location || "").trim() : "", description: req.body.description === undefined ? definition.description : String(req.body.description).slice(0, 2000), instructions: String(req.body.instructions || definition.instructions || "").slice(0, 2000), interviewer: String(req.body.interviewer || "").slice(0, 120), interviewerIds: Array.isArray(req.body.interviewerIds) ? req.body.interviewerIds.filter(mongoose.isValidObjectId) : definition.interviewerIds, interviewerInstructions: String(req.body.interviewerInstructions || "").slice(0, 2000), status: "SCHEDULED" });
      progress.history.push({ event: rescheduled ? "RESCHEDULED" : "SCHEDULED", message: rescheduled ? "Round rescheduled" : "Round scheduled", changedAt: new Date(), changedBy: req.user._id });
      if (application.status === "SHORTLISTED") {
        application.status = "INTERVIEW";
        application.statusHistory.push({ status: "INTERVIEW", changedAt: new Date(), changedBy: "recruiter" });
      }
      await application.save();
      await notify(rescheduled ? "Rescheduled" : "Scheduled");
    } else if (action === "cancel") {
      if (progress.status !== "SCHEDULED") return res.status(409).json({ success: false, message: "This round cannot be cancelled." });
      progress.status = "CANCELLED";
      progress.history.push({ event: "CANCELLED", message: "Round cancelled", changedAt: new Date(), changedBy: req.user._id });
      await application.save();
      await notify("Cancelled");
    } else if (action === "evaluate") {
      if (progress.status !== "SCHEDULED" || !["PASSED", "FAILED"].includes(req.body.result)) return res.status(409).json({ success: false, message: "Complete the scheduled round and choose pass or fail." });
      progress.status = req.body.result;
      progress.result = req.body.result;
      progress.completedAt = new Date();
      progress.history.push({ event: req.body.result, message: req.body.result === "PASSED" ? "Round passed" : "Round failed", changedAt: new Date(), changedBy: req.user._id });
      progress.recruiterNotes = String(req.body.privateNotes || "").slice(0, 2000);
      await application.save();
      await notify(req.body.result === "PASSED" ? "Passed" : "Did not pass");
    } else return res.status(400).json({ success: false, message: "Recruitment action is invalid." });
    return res.json({ success: true });
  } catch (error) {
    console.error("Recruitment progress update failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update candidate recruitment progress." });
  }
}
module.exports = {
  applyToJob,
  getMyApplications,
  getApplicationForJob,
  getRecruiterApplications,
  getApplicationById,
  getApplicationResume,
  updateApplicationStatus,
  updateRecruiterNotes,
  manageRecruiterNote,
  manageRecruitment,
};
