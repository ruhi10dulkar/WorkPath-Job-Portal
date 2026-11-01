const express = require("express");
const {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");

const router = express.Router();

router.post("/register", registerUser);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", loginUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
router.get("/me", authenticateUser, getCurrentUser);
router.get("/applicant-test", authenticateUser, authorizeRoles("applicant"), (req, res) => {
  res.json({ success: true, message: "Applicant access granted." });
});
router.get("/recruiter-test", authenticateUser, authorizeRoles("recruiter"), (req, res) => {
  res.json({ success: true, message: "Recruiter access granted." });
});

module.exports = router;
