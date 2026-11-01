const Application = require("../models/Application");
const Job = require("../models/Job");

const APPLICATION_STATUSES = ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"];

function emptyStats() {
  return Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]));
}

async function getApplicantDashboard(req, res) {
  try {
    const applicantId = req.user._id;
    const [totalApplications, groupedStats, recentApplications] = await Promise.all([
      Application.countDocuments({ applicant: applicantId }),
      Application.aggregate([
        { $match: { applicant: applicantId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.find({ applicant: applicantId })
        .select("job status appliedAt")
        .populate({ path: "job", select: "title company location" })
        .sort({ appliedAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const applicationStats = emptyStats();
    groupedStats.forEach(({ _id, count }) => {
      const status = ({ applied: "APPLIED", reviewed: "UNDER_REVIEW", shortlisted: "SHORTLISTED", accepted: "SELECTED", rejected: "REJECTED" })[_id] || _id;
      if (Object.prototype.hasOwnProperty.call(applicationStats, status)) applicationStats[status] += count;
    });
    return res.json({ success: true, totalApplications, applicationStats, recentApplications });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load applicant dashboard." });
  }
}

async function getRecruiterDashboard(req, res) {
  try {
    const recruiterId = req.user._id;
    const jobs = await Job.find({ recruiter: recruiterId })
      .select("title company location createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const jobIds = jobs.map((job) => job._id);

    const [groupedStats, groupedJobCounts, groupedJobStatuses, recentApplications] = await Promise.all([
      Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: "$job", applicationCount: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: { job: "$job", status: "$status" }, count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $sort: { appliedAt: -1 } },
        { $limit: 8 },
        { $lookup: { from: "users", localField: "applicant", foreignField: "_id", as: "applicant" } },
        { $unwind: { path: "$applicant", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "jobs", localField: "job", foreignField: "_id", as: "job" } },
        { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
        { $project: {
          _id: 1, status: 1, appliedAt: 1,
          applicant: { name: "$applicant.name", email: "$applicant.email" },
          job: { _id: "$job._id", title: "$job.title", company: "$job.company", location: "$job.location" },
        } },
      ]),
    ]);

    const applicationsByStatus = emptyStats();
    groupedStats.forEach(({ _id, count }) => {
      const status = ({ applied: "APPLIED", reviewed: "UNDER_REVIEW", shortlisted: "SHORTLISTED", accepted: "SELECTED", rejected: "REJECTED" })[_id] || _id;
      if (Object.prototype.hasOwnProperty.call(applicationsByStatus, status)) applicationsByStatus[status] += count;
    });
    const countByJobId = new Map(groupedJobCounts.map(({ _id, applicationCount }) => [_id.toString(), applicationCount]));
    const stagesByJobId = new Map();
    groupedJobStatuses.forEach(({ _id, count }) => {
      const key = _id.job.toString();
      const status = ({ applied: "APPLIED", reviewed: "UNDER_REVIEW", shortlisted: "SHORTLISTED", accepted: "SELECTED", rejected: "REJECTED" })[_id.status] || _id.status;
      if (!stagesByJobId.has(key)) stagesByJobId.set(key, emptyStats());
      if (stagesByJobId.get(key)[status] !== undefined) stagesByJobId.get(key)[status] += count;
    });
    const jobsWithApplicationCounts = jobs.map((job) => ({
      jobId: job._id,
      title: job.title,
      company: job.company,
      location: job.location,
      createdAt: job.createdAt,
      applicationCount: countByJobId.get(job._id.toString()) || 0,
      applicationsByStatus: stagesByJobId.get(job._id.toString()) || emptyStats(),
    }));

    return res.json({
      success: true,
      totalJobs: jobs.length,
      activeJobs: jobs.length,
      totalApplications: Object.values(applicationsByStatus).reduce((total, count) => total + count, 0),
      applicationsByStatus,
      recentApplications,
      jobsWithApplicationCounts,
    });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load recruiter dashboard." });
  }
}

module.exports = { getApplicantDashboard, getRecruiterDashboard };
