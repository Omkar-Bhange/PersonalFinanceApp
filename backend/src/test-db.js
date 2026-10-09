const dotenv = require("dotenv");
dotenv.config();

const pool = require("./config/database");

async function testDatabaseConnection() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS username,
        version() AS postgres_version
    `);

    console.log("Database connection successful!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();