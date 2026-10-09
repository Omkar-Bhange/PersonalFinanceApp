
const express = require("express");
const pool = require("../config/database");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

router.get("/database", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS username
    `);

    res.status(200).json({
      success: true,
      message: "Database connection is healthy",
      database: result.rows[0].database,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      success: false,
      message: "Database is temporarily unavailable",
    });
  }
});

module.exports = router;
