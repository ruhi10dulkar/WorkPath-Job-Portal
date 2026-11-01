const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema({
  degree: { type: String, trim: true, maxlength: 120, required: true },
  fieldOfStudy: { type: String, trim: true, maxlength: 120, required: true },
  institution: { type: String, trim: true, maxlength: 160, required: true },
  startYear: { type: Number, min: 1950, max: 2100, required: true },
  endYear: { type: Number, min: 1950, max: 2100, default: null },
  grade: { type: String, trim: true, maxlength: 40, default: "" },
});

const experienceSchema = new mongoose.Schema({
  company: { type: String, trim: true, maxlength: 160, required: true },
  jobTitle: { type: String, trim: true, maxlength: 120, required: true },
  employmentType: { type: String, enum: ["full-time", "part-time", "internship", "contract", "freelance"], default: "full-time" },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  currentlyWorking: { type: Boolean, default: false },
  description: { type: String, trim: true, maxlength: 3000, default: "" },
});

const projectSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 120, required: true },
  description: { type: String, trim: true, maxlength: 3000, default: "" },
  technologies: { type: [{ type: String, trim: true, maxlength: 50 }], default: [] },
  projectUrl: { type: String, trim: true, maxlength: 500, default: "" },
  githubUrl: { type: String, trim: true, maxlength: 500, default: "" },
});

const certificationSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 160, required: true },
  issuer: { type: String, trim: true, maxlength: 160, required: true },
  issueDate: { type: Date, default: null },
  credentialUrl: { type: String, trim: true, maxlength: 500, default: "" },
});

const resumeSchema = new mongoose.Schema({
  versionId: { type: String, required: true },
  storageKey: { type: String, required: true, select: false },
  originalName: { type: String, required: true, maxlength: 255 },
  contentType: { type: String, enum: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], required: true },
  size: { type: Number, required: true, max: 5 * 1024 * 1024 },
  uploadedAt: { type: Date, default: Date.now, required: true },
});
const profilePhotoSchema = new mongoose.Schema({
  storageKey: { type: String, required: true, select: false },
  contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
  uploadedAt: { type: Date, default: Date.now, required: true },
}, { _id: false });

const candidateProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  basicInfo: {
    fullName: { type: String, trim: true, maxlength: 100, default: "" },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    currentLocation: { type: String, trim: true, maxlength: 120, default: "" },
    headline: { type: String, trim: true, maxlength: 160, default: "" },
    summary: { type: String, trim: true, maxlength: 3000, default: "" },
    portfolioUrl: { type: String, trim: true, maxlength: 500, default: "" },
    githubUrl: { type: String, trim: true, maxlength: 500, default: "" },
    linkedInUrl: { type: String, trim: true, maxlength: 500, default: "" },
  },
  education: { type: [educationSchema], default: [] },
  skills: { type: [{ type: String, trim: true, maxlength: 50 }], default: [], validate: [(items) => items.length <= 60, "Add no more than 60 skills."] },
  isFresher: { type: Boolean, default: true },
  experience: { type: [experienceSchema], default: [] },
  projects: { type: [projectSchema], default: [] },
  certifications: { type: [certificationSchema], default: [] },
  resume: { type: resumeSchema, default: null },
  profilePhoto: { type: profilePhotoSchema, default: null },
  preferences: {
    preferredJobTitles: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
    preferredLocations: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
    workModes: { type: [{ type: String, enum: ["remote", "hybrid", "on-site"] }], default: [] },
    employmentTypes: { type: [{ type: String, enum: ["full-time", "part-time", "internship", "contract"] }], default: [] },
    expectedSalary: { type: String, trim: true, maxlength: 100, default: "" },
  },
}, { timestamps: true });

module.exports = mongoose.model("CandidateProfile", candidateProfileSchema);
