
const env = require("./config/env");
const app = require("./app");
const pool = require("./config/database");

const PORT = env.PORT;

async function startServer() {
  try {
    await pool.query("SELECT 1");

    console.log("PostgreSQL connection verified.");

    const server = app.listen(PORT, () => {
      console.log(`Personal Finance API running on port ${PORT}`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    await pool.end();
    process.exit(1);
  }
}

startServer();

