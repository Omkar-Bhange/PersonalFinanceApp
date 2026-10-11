const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getLendingRecords,
  getLendingSummary,
  getLendingRecordById,
  createLendingRecord,
  updateLendingRecord,
  topUpLendingRecord,
  deleteLendingRecord,
  createRepayment,
  deleteRepayment,
} = require("../controllers/lendingController");

const router = express.Router();

router.use(authenticateToken);

router.get("/summary", getLendingSummary);
router.get("/", getLendingRecords);
router.post("/", createLendingRecord);
router.get("/:id", getLendingRecordById);
router.put("/:id", updateLendingRecord);
router.post("/:id/topup", topUpLendingRecord);
router.delete("/:id", deleteLendingRecord);
router.post("/:id/repayments", createRepayment);
router.delete("/:id/repayments/:repaymentId", deleteRepayment);

module.exports = router;

