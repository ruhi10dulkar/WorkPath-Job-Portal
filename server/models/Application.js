const mongoose = require("mongoose");

const snapshotEducationSchema = new mongoose.Schema({
  degree: String, fieldOfStudy: String, institution: String, startYear: Number, endYear: Number, grade: String,
}, { _id: false });
const snapshotExperienceSchema = new mongoose.Schema({
  company: String, jobTitle: String, employmentType: String, startDate: Date, endDate: Date,
  currentlyWorking: Boolean, description: String,
}, { _id: false });
const snapshotProjectSchema = new mongoose.Schema({
  name: String, description: String, technologies: [String], projectUrl: String, githubUrl: String,
}, { _id: false });
const snapshotCertificationSchema = new mongoose.Schema({
  name: String, issuer: String, issueDate: Date, credentialUrl: String,
}, { _id: false });
const profileSnapshotSchema = new mongoose.Schema({
  fullName: String, email: String, phone: String, currentLocation: String, headline: String, summary: String,
  profilePhotoUrl: String, portfolioUrl: String, githubUrl: String, linkedInUrl: String,
  education: { type: [snapshotEducationSchema], default: [] }, skills: { type: [String], default: [] },
  isFresher: Boolean, experience: { type: [snapshotExperienceSchema], default: [] },
  projects: { type: [snapshotProjectSchema], default: [] },
  certifications: { type: [snapshotCertificationSchema], default: [] },
  preferences: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });
const resumeSnapshotSchema = new mongoose.Schema({
  versionId: String,
  storageKey: { type: String, select: false },
  originalName: String,
  contentType: String,
  size: Number,
  uploadedAt: Date,
}, { _id: false });
const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"], required: true },
  changedAt: { type: Date, default: Date.now, required: true },
  changedBy: { type: String, enum: ["candidate", "recruiter", "system"], required: true },
}, { _id: false });
const recruiterNoteSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, required: true, maxlength: 2000 },
}, { timestamps: true });
const recruitmentRoundSchema = new mongoose.Schema({
  type: { type: String, enum: ["ASSESSMENT", "APTITUDE_TEST", "CODING_TEST", "TECHNICAL_INTERVIEW", "TECHNICAL_INTERVIEW_2", "SYSTEM_DESIGN", "MANAGERIAL_INTERVIEW", "HR_INTERVIEW", "GROUP_DISCUSSION", "ASSIGNMENT", "CUSTOM"], required: true },
  title: { type: String, trim: true, required: true, maxlength: 100 }, description: { type: String, trim: true, maxlength: 2000, default: "" }, order: { type: Number, required: true },
  status: { type: String, enum: ["NOT_SCHEDULED", "SCHEDULED", "COMPLETED", "PASSED", "FAILED", "CANCELLED"], default: "NOT_SCHEDULED" },
  scheduledAt: Date, duration: { type: Number, enum: [30, 45, 60, 90] }, mode: { type: String, enum: ["ONLINE", "IN_PERSON"] }, platform: { type: String, trim: true, maxlength: 100 }, meetingLink: String, location: String, instructions: { type: String, maxlength: 2000 }, interviewer: { type: String, trim: true, maxlength: 120 },
  completedAt: Date, result: { type: String, enum: ["PASSED", "FAILED"] },
  scheduleHistory: [{ scheduledAt: Date, changedAt: { type: Date, default: Date.now } }],
}, { timestamps: true });
const recruitmentProgressSchema = new mongoose.Schema({
  roundId: { type: mongoose.Schema.Types.ObjectId, required: true },
  eligibility: { type: String, enum: ["NOT_ELIGIBLE", "ELIGIBLE", "SHORTLISTED", "NOT_SHORTLISTED"], default: "NOT_ELIGIBLE" },
  status: { type: String, enum: ["NOT_STARTED", "ELIGIBLE", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "PASSED", "FAILED", "CANCELLED", "RESCHEDULED"], default: "NOT_STARTED" },
  scheduledAt: Date, duration: { type: Number, min: 5, max: 480 }, mode: { type: String, enum: ["ONLINE", "IN_PERSON"] }, platform: { type: String, trim: true, maxlength: 100 }, meetingLink: String, location: String,
  description: { type: String, maxlength: 2000 }, instructions: { type: String, maxlength: 2000 }, interviewer: { type: String, maxlength: 120 }, interviewerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], interviewerInstructions: { type: String, maxlength: 2000 }, recruiterNotes: { type: String, maxlength: 2000 }, result: { type: String, enum: ["PASSED", "FAILED"] }, completedAt: Date,
  shortlistedAt: Date, rejectedAt: Date,
  scheduleHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  history: { type: [{ event: { type: String, required: true }, message: { type: String, default: "" }, changedAt: { type: Date, default: Date.now }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }], default: [] },
}, { timestamps: true });

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"],
    default: "APPLIED",
    required: true,
  },
  appliedAt: { type: Date, default: Date.now, required: true },
  profileSnapshot: { type: profileSnapshotSchema, default: undefined },
  resumeSnapshot: { type: resumeSnapshotSchema, default: undefined },
  statusHistory: { type: [statusHistorySchema], default: function initialStatusHistory() { return [{ status: this.status || "APPLIED", changedAt: this.appliedAt || new Date(), changedBy: "candidate" }]; } },
  recruiterNotes: { type: String, maxlength: 5000, default: "" },
  recruiterNoteEntries: { type: [recruiterNoteSchema], default: [] },
  recruitmentRounds: { type: [recruitmentRoundSchema], default: [] },
  recruitmentProgress: { type: [recruitmentProgressSchema], default: [] },
});

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);
