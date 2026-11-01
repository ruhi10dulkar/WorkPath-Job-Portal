const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  createJob,
  getJobs,
  getJobById,
  getJobMatch,
  getMyJobs,
  updateJob,
  deleteJob,
  saveRecruitmentPipeline,
} = require("../controllers/jobController");

const router = express.Router();

router.get("/", getJobs);
router.get("/my", authenticateUser, authorizeRoles("recruiter"), getMyJobs);
router.get("/:id/match", authenticateUser, authorizeRoles("applicant"), getJobMatch);
router.post("/", authenticateUser, authorizeRoles("recruiter"), createJob);
router.put("/:id/recruitment-pipeline", authenticateUser, authorizeRoles("recruiter"), saveRecruitmentPipeline);
router.get("/:id", getJobById);
router.put("/:id", authenticateUser, authorizeRoles("recruiter"), updateJob);
router.delete("/:id", authenticateUser, authorizeRoles("recruiter"), deleteJob);

module.exports = router;
