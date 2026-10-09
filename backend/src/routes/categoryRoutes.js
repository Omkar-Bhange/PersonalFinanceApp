
const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getCategories,
  createCategory,
} = require("../controllers/categoryController");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getCategories);
router.post("/", createCategory);

module.exports = router;

