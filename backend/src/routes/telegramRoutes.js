const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const telegramController = require("../controllers/telegramController");

const router = express.Router();

// Public webhook route (called directly by Telegram API servers)
router.post("/webhook", telegramController.handleWebhook);

// Protected user routes
router.use(authenticateToken);
router.get("/status", telegramController.getStatus);
router.post("/link-code", telegramController.generateLinkCode);
router.post("/unlink", telegramController.unlink);
router.post("/setup-webhook", telegramController.setupWebhook);

module.exports = router;
