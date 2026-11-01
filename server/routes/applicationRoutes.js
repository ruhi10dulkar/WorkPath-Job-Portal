const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
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
} = require("../controllers/applicationController");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");

const router = express.Router();
router.use(authenticateUser);

// Keep named paths ahead of /:id so they are not treated as application IDs.
router.get("/recruiter", authorizeRoles("recruiter"), getRecruiterApplications);
router.get("/my", authorizeRoles("applicant"), getMyApplications);
router.get("/job/:jobId", authorizeRoles("applicant"), getApplicationForJob);
router.post("/:jobId", authorizeRoles("applicant"), requireVerifiedEmail, applyToJob);
router.patch("/:id/status", authorizeRoles("recruiter"), updateApplicationStatus);
router.patch("/:id/recruitment/:roundId", authorizeRoles("recruiter"), manageRecruitment);
router.post("/:id/notes/add", authorizeRoles("recruiter"), (req, res, next) => { req.params.action = "add"; next(); }, manageRecruiterNote);
router.patch("/:id/notes/:noteId", authorizeRoles("recruiter"), (req, res, next) => { req.params.action = "edit"; next(); }, manageRecruiterNote);
router.delete("/:id/notes/:noteId", authorizeRoles("recruiter"), (req, res, next) => { req.params.action = "delete"; next(); }, manageRecruiterNote);
router.post("/:id/notes", authorizeRoles("recruiter"), updateRecruiterNotes);
router.get("/:id/resume", getApplicationResume);
router.get("/:id", getApplicationById);

module.exports = router;
