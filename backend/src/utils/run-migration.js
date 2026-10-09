
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, "../../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const { rows: appliedRows } = await client.query(
      "SELECT migration_name FROM schema_migrations"
    );
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Migration already applied: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const rawSql = fs.readFileSync(filePath, "utf8");

      // Normalize SQL by stripping top-level BEGIN/COMMIT if present to ensure
      // the runner maintains strict transactional control over DDL + migration record
      const cleanSql = rawSql
        .replace(/^\s*BEGIN\s*;/i, "")
        .replace(/COMMIT\s*;\s*$/i, "")
        .trim();

      await client.query("BEGIN");

      try {
        await client.query(cleanSql);

        await client.query(
          "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
          [file]
        );

        await client.query("COMMIT");
        console.log(`Migration applied successfully: ${file}`);
      } catch (migrationError) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Ignore rollback error if connection was dropped
        }
        throw migrationError;
      }
    }
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();


