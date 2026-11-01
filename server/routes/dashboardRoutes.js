const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const { getApplicantDashboard, getRecruiterDashboard } = require("../controllers/dashboardController");

const router = express.Router();
router.use(authenticateUser);
router.get("/applicant", authorizeRoles("applicant"), getApplicantDashboard);
router.get("/recruiter", authorizeRoles("recruiter"), getRecruiterDashboard);

module.exports = router;
