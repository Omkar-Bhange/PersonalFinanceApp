const pool = require("../../src/config/database");
const { createAccessToken } = require("../../src/utils/tokenUtils");
const { assertTestDatabase } = require("./testDbGuard");

/**
 * Truncates application tables in the isolated test database.
 */
async function clearTestDatabase() {
  assertTestDatabase();
  await pool.query(`
    TRUNCATE TABLE repayments, lending_records, transactions, accounts, categories, users
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Creates a valid JWT access token for testing.
 */
function createTestToken(user) {
  return createAccessToken({
    id: user.id || "1",
    email: user.email || "testuser@example.com",
  });
}

module.exports = {
  clearTestDatabase,
  createTestToken,
};

