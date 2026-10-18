const telegramBotService = require("../services/telegramBotService");
const env = require("../config/env");

async function handleWebhook(req, res) {
  // Always return 200 OK immediately so Telegram doesn't retry
  res.status(200).json({ ok: true });

  try {
    const update = req.body;
    if (update && typeof update === "object") {
      await telegramBotService.processTelegramUpdate(update);
    }
  } catch (error) {
    console.error("[Telegram Webhook] Error processing update:", error.message);
  }
}

async function getStatus(req, res) {
  try {
    const status = await telegramBotService.getTelegramStatus(req.user.id);
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Get telegram status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Telegram connection status.",
    });
  }
}

async function generateLinkCode(req, res) {
  try {
    const token = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Telegram Bot Token is not configured yet on the server.",
      });
    }

    const linkData = await telegramBotService.generateLinkCode(req.user.id);
    return res.status(200).json({
      success: true,
      data: linkData,
    });
  } catch (error) {
    console.error("Generate link code error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate Telegram link code.",
    });
  }
}

async function unlink(req, res) {
  try {
    await telegramBotService.unlinkTelegram(req.user.id);
    return res.status(200).json({
      success: true,
      message: "Telegram account successfully disconnected.",
    });
  } catch (error) {
    console.error("Unlink telegram error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to unlink Telegram account.",
    });
  }
}

async function setupWebhook(req, res) {
  try {
    const webhookUrl = req.body.webhook_url || env.TELEGRAM_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: "Please specify webhook_url (e.g. https://your-backend.onrender.com/api/v1/telegram/webhook)",
      });
    }

    const result = await telegramBotService.setTelegramWebhook(webhookUrl);
    return res.status(200).json({
      success: true,
      message: "Telegram webhook configured successfully!",
      data: result,
    });
  } catch (error) {
    console.error("Setup telegram webhook error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to configure Telegram webhook.",
    });
  }
}

module.exports = {
  handleWebhook,
  getStatus,
  generateLinkCode,
  unlink,
  setupWebhook,
};
