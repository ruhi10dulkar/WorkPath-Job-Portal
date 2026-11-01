const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const User = require("../models/User");
const { createVerificationToken, deliverVerificationEmail } = require("../services/emailService");
const {
  createAccessToken,
  createRefreshToken,
  ensureTokenSecrets,
  verifyRefreshToken,
} = require("../utils/token");

const REFRESH_COOKIE_NAME = "refreshToken";

function issueTokens(user) {
  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
  };
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshTokenMatches(token, storedHash) {
  if (!storedHash) return false;
  const tokenHash = Buffer.from(hashRefreshToken(token), "hex");
  const savedHash = Buffer.from(storedHash, "hex");
  return tokenHash.length === savedHash.length && crypto.timingSafeEqual(tokenHash, savedHash);
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified !== false,
  };
}

async function registerUser(req, res) {
  const { name, email, password, role = "applicant" } = req.body || {};

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !name.trim() ||
    !email.trim() ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !["applicant", "recruiter"].includes(role)
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a name, valid email, password of at least 8 characters, and a supported role.",
    });
  }

  try {
    ensureTokenSecrets();
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with that email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      emailVerified: false,
    });
    const verification = createVerificationToken();
    user.emailVerificationTokenHash = verification.hash;
    user.emailVerificationTokenExpires = verification.expiresAt;
    await user.save();
    await deliverVerificationEmail(user, verification.rawToken);
    return res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "An account with that email already exists." });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Please check the registration details." });
    }

    console.error("Registration failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to register account." });
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    ensureTokenSecrets();
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password +refreshTokenHash");
    const passwordMatches = user && (await bcrypt.compare(password, user.password));

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({ success: false, message: "Please verify your email before logging in." });
    }

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();
    setRefreshCookie(res, refreshToken);
    return res.json({ success: true, user: safeUser(user), accessToken });
  } catch (error) {
    console.error("Login failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to log in." });
  }
}

async function verifyEmail(req, res) {
  const { token } = req.query;
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ success: false, message: "Verification token is invalid or expired." });
  }
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  try {
    const user = await User.findOne({ emailVerificationTokenHash: hash })
      .select("+emailVerificationTokenHash +emailVerificationTokenExpires");
    if (!user) return res.status(400).json({ success: false, message: "Verification token is invalid or expired." });
    if (user.emailVerified) return res.status(400).json({ success: false, message: "Email is already verified." });
    if (!user.emailVerificationTokenExpires || user.emailVerificationTokenExpires <= new Date()) {
      return res.status(400).json({ success: false, message: "Verification token is invalid or expired." });
    }
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();
    return res.json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    console.error("Email verification failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to verify email." });
  }
}

async function resendVerification(req, res) {
  const genericMessage = "If the account exists and is not verified, a verification email has been sent.";
  const email = req.body?.email;
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ success: false, message: "A valid email is required." });
  }
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user && user.emailVerified === false) {
      const verification = createVerificationToken();
      user.emailVerificationTokenHash = verification.hash;
      user.emailVerificationTokenExpires = verification.expiresAt;
      await user.save();
      await deliverVerificationEmail(user, verification.rawToken);
    }
    return res.json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Verification resend failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to process the request." });
  }
}

async function refreshAccessToken(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ success: false, message: "Refresh token is required." });
  }

  let claims;
  try {
    claims = verifyRefreshToken(token);
  } catch (error) {
    clearRefreshCookie(res);

    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
      return res.status(401).json({ success: false, message: "Refresh token is invalid or expired." });
    }

    console.error("Refresh token verification failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to refresh access token." });
  }

  try {
    const user = await User.findById(claims.sub).select("+refreshTokenHash");

    if (!user || !refreshTokenMatches(token, user.refreshTokenHash)) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Refresh token is invalid or expired." });
    }

    if (user.emailVerified === false) {
      user.refreshTokenHash = undefined;
      await user.save();
      clearRefreshCookie(res);
      return res.status(403).json({ success: false, message: "Please verify your email before logging in." });
    }

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();
    setRefreshCookie(res, refreshToken);

    return res.json({ success: true, accessToken, user: safeUser(user) });
  } catch (error) {
    console.error("Access token refresh failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to refresh access token." });
  }
}

async function logoutUser(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (token) {
    try {
      const claims = verifyRefreshToken(token);
      const user = await User.findById(claims.sub).select("+refreshTokenHash");

      if (user && refreshTokenMatches(token, user.refreshTokenHash)) {
        user.refreshTokenHash = undefined;
        await user.save();
      }
    } catch (error) {
      if (!["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
        console.error("Logout token revocation failed:", error.message);
        clearRefreshCookie(res);
        return res.status(500).json({ success: false, message: "Unable to log out." });
      }
    }
  }

  clearRefreshCookie(res);
  return res.json({ success: true, message: "Logged out successfully." });
}

async function getCurrentUser(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication is required." });
  }

  return res.json({ success: true, user: safeUser(req.user) });
}

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  verifyEmail,
  resendVerification,
};
