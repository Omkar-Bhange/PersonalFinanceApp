
const express = require("express");
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, currency, timezone, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Profile retrieval failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve profile",
    });
  }
});

module.exports = router;
