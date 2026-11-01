const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_LIFETIME = "15m";
const REFRESH_TOKEN_LIFETIME = "7d";

function getAccessSecret() {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is not configured.");
  }

  return process.env.JWT_ACCESS_SECRET;
}

function getRefreshSecret() {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET is not configured.");
  }

  return process.env.JWT_REFRESH_SECRET;
}

function ensureTokenSecrets() {
  getAccessSecret();
  getRefreshSecret();
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    getAccessSecret(),
    { expiresIn: ACCESS_TOKEN_LIFETIME }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_LIFETIME }
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshSecret());
}

function verifyAccessToken(token) {
  return jwt.verify(token, getAccessSecret());
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  ensureTokenSecrets,
  verifyAccessToken,
  verifyRefreshToken,
};
