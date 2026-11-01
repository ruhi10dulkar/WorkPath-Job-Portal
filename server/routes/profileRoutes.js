const express = require("express");
const multer = require("multer");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const {
  getProfile,
  getProfileReadinessHandler,
  updateProfile,
  uploadResume,
  getMyResume,
  deleteResume,
  uploadProfilePhoto,
  getProfilePhoto,
  deleteProfilePhoto,
} = require("../controllers/profileController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const router = express.Router();
// Photos use unguessable UUID references so standard <img> requests can load them without exposing bearer tokens.
router.get("/photo/:key", getProfilePhoto);
router.use(authenticateUser, authorizeRoles("applicant"), requireVerifiedEmail);

function receiveResume(req, res, next) {
  upload.single("resume")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Resume files must be 5 MB or smaller."
        : "Choose a single PDF, DOC, or DOCX resume.";
      return res.status(400).json({ success: false, message });
    }
    return res.status(400).json({ success: false, message: "The resume upload could not be processed." });
  });
}

router.get("/readiness", getProfileReadinessHandler);
router.get("/resume", getMyResume);
router.post("/resume", receiveResume, uploadResume);
router.delete("/resume", deleteResume);
function receiveProfilePhoto(req, res, next) {
  upload.single("photo")(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "Please upload a JPG, PNG, or WebP image under 5 MB."
      : "Please upload one JPG, PNG, or WebP image under 5 MB.";
    return res.status(400).json({ success: false, message });
  });
}
router.post("/photo", receiveProfilePhoto, uploadProfilePhoto);
router.delete("/photo", deleteProfilePhoto);
router.get("/", getProfile);
router.put("/", updateProfile);

module.exports = router;
