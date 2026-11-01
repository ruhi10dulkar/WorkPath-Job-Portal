const mongoose = require("mongoose");
const User = require("../models/User");
const { verifyAccessToken } = require("../utils/token");

async function authenticateUser(req, res, next) {
  const authorization = req.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      success: false,
      message: "A valid Bearer access token is required.",
    });
  }

  let claims;
  try {
    claims = verifyAccessToken(match[1]);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Access token is invalid or expired.",
    });
  }

  if (typeof claims.sub !== "string" || !mongoose.isValidObjectId(claims.sub)) {
    return res.status(401).json({
      success: false,
      message: "Access token is invalid or expired.",
    });
  }

  try {
    const user = await User.findById(claims.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Access token is invalid or expired.",
      });
    }

    // Use the database record for identity and role, not token-supplied role data.
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticateUser;
