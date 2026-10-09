
const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");

const {
  getAccounts,
  createAccount,
  updateAccount,
} = require("../controllers/accountController");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getAccounts);
router.post("/", createAccount);
router.put("/:id", updateAccount);

module.exports = router;
