
const jwt = require("jsonwebtoken");
const env = require("../config/env");

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: "personal-finance-api",
      audience: "personal-finance-app",
    }
  );
}

module.exports = { createAccessToken };

