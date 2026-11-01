const mongoose = require("mongoose");

const recruitmentPipelineRoundSchema = new mongoose.Schema({
  type: { type: String, enum: ["ASSESSMENT", "APTITUDE_TEST", "CODING_TEST", "TECHNICAL_INTERVIEW", "TECHNICAL_INTERVIEW_2", "SYSTEM_DESIGN", "MANAGERIAL_INTERVIEW", "HR_INTERVIEW", "GROUP_DISCUSSION", "ASSIGNMENT", "CUSTOM"], required: true },
  title: { type: String, trim: true, required: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  instructions: { type: String, trim: true, maxlength: 2000, default: "" },
  duration: { type: Number, min: 5, max: 480, default: 45 },
  mode: { type: String, enum: ["ONLINE", "IN_PERSON"], default: "ONLINE" },
  platform: { type: String, trim: true, maxlength: 100, default: "" },
  link: { type: String, trim: true, maxlength: 2000, default: "" },
  scheduledAt: Date,
  location: { type: String, trim: true, maxlength: 500, default: "" },
  interviewerLabels: { type: String, trim: true, maxlength: 500, default: "" },
  interviewerInstructions: { type: String, trim: true, maxlength: 2000, default: "" },
  interviewerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  evaluationCriteria: [{ name: { type: String, trim: true, maxlength: 100 }, description: { type: String, trim: true, maxlength: 500 } }],
  order: { type: Number, required: true },
}, { timestamps: true });

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required."],
      trim: true,
      minlength: [2, "Job title must be at least 2 characters long."],
      maxlength: [120, "Job title cannot exceed 120 characters."],
    },
    company: {
      type: String,
      required: [true, "Company is required."],
      trim: true,
      minlength: [2, "Company must be at least 2 characters long."],
      maxlength: [120, "Company cannot exceed 120 characters."],
    },
    description: {
      type: String,
      required: [true, "Job description is required."],
      trim: true,
      minlength: [20, "Description must be at least 20 characters long."],
      maxlength: [10000, "Description cannot exceed 10000 characters."],
    },
    location: {
      type: String,
      required: [true, "Location is required."],
      trim: true,
      maxlength: [120, "Location cannot exceed 120 characters."],
    },
    employmentType: {
      type: String,
      required: [true, "Employment type is required."],
      enum: ["full-time", "part-time", "internship", "contract"],
    },
    experienceLevel: {
      type: String,
      required: [true, "Experience level is required."],
      trim: true,
      maxlength: [80, "Experience level cannot exceed 80 characters."],
    },
    salary: {
      type: String,
      trim: true,
      maxlength: [100, "Salary cannot exceed 100 characters."],
      default: "",
    },
    skills: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      default: [],
      validate: {
        validator: (skills) => skills.length <= 30 && skills.every(Boolean),
        message: "Provide up to 30 non-empty skills.",
      },
    },
    requiredSkills: { type: [{ type: String, trim: true, maxlength: 50 }], default: [] },
    preferredSkills: { type: [{ type: String, trim: true, maxlength: 50 }], default: [] },
    minExperienceYears: { type: Number, min: 0, max: 60, default: null },
    maxExperienceYears: {
      type: Number, min: 0, max: 60, default: null,
      validate: { validator(value) { return value === null || this.minExperienceYears === null || this.minExperienceYears === undefined || value >= this.minExperienceYears; }, message: "Maximum experience must be at least the minimum experience." },
    },
    educationRequirements: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recruitmentPipeline: { type: [recruitmentPipelineRoundSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);
