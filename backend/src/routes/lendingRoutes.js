const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getLendingRecords,
  getLendingSummary,
  getLendingRecordById,
  createLendingRecord,
  createRepayment,
} = require("../controllers/lendingController");

const router = express.Router();

router.use(authenticateToken);

router.get("/summary", getLendingSummary);
router.get("/", getLendingRecords);
router.post("/", createLendingRecord);
router.get("/:id", getLendingRecordById);
router.post("/:id/repayments", createRepayment);

module.exports = router;

