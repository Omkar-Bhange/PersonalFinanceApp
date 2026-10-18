const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getBudgets,
  upsertBudget,
  deleteBudget,
  autoGenerateBudgets,
  getAdvisorInsights,
  askAdvisor,
} = require("../controllers/budgetController");

const router = express.Router();

router.use(authenticateToken);

// Budget CRUD & Projections
router.get("/", getBudgets);
router.post("/", upsertBudget);
router.delete("/:id", deleteBudget);
router.post("/auto-generate", autoGenerateBudgets);

// AI Financial Advisor & Budget Planning
router.get("/advisor-insights", getAdvisorInsights);
router.post("/ask-advisor", askAdvisor);

module.exports = router;

