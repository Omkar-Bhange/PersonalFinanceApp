const env = require("../../src/config/env");

/**
 * Validates that the active database connection targets an isolated test database.
 * Strictly prevents test execution if the database points to the development database.
 */
function assertTestDatabase() {
  const currentDb = env.DB_NAME;
  const devDbName = "personal_finance_db";

  if (!currentDb) {
    throw new Error(
      "[TEST DB GUARD] Database name is undefined. Tests aborted to protect database integrity."
    );
  }

  if (currentDb === devDbName || !currentDb.includes("test")) {
    throw new Error(
      `[TEST DB GUARD] SAFETY INTERCEPT: Current database is '${currentDb}'. Automated integration tests must run against an isolated test database (e.g., 'personal_finance_test_db') and will NOT execute against '${devDbName}'.`
    );
  }
}

module.exports = { assertTestDatabase };

