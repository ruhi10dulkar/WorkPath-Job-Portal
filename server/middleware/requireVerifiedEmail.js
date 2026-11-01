function requireVerifiedEmail(req, res, next) {
  if (req.user?.emailVerified !== true) {
    return res.status(403).json({ success: false, message: "Email verification is required." });
  }
  return next();
}

module.exports = requireVerifiedEmail;
