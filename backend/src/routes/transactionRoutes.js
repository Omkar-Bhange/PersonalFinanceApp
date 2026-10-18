
const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");

const {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  createBulkTransactions,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
} = require("../controllers/transactionController");

const router = express.Router();

router.use(authenticateToken);

router.get("/summary", getTransactionSummary);
router.get("/", getTransactions);
router.post("/", createTransaction);
router.post("/bulk", createBulkTransactions);
router.post("/bulk-delete", bulkDeleteTransactions);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

module.exports = router;

