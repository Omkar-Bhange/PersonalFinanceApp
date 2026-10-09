
const pool = require("../config/database");
const bcrypt = require("bcrypt");

async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, currency, timezone, created_at`,
    [name, email, passwordHash]
  );

  return result.rows[0];
}

async function loginUser({ email, password }) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, name, email, password_hash, currency, timezone, created_at
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    currency: user.currency,
    timezone: user.timezone,
    created_at: user.created_at,
  };
}

module.exports = {
  registerUser,
  loginUser,
};

