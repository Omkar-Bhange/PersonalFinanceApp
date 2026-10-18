const pool = require("../config/database");
const accountService = require("../services/accountService");
const aiService = require("../services/aiService");

async function parseStatement(req, res) {
  try {
    const userId = req.user.id;

    // 1. Fetch available categories and accounts for this user to help Gemini match accurately
    const [categoriesResult, accounts] = await Promise.all([
      pool.query(
        `SELECT id, name, category_type AS type
         FROM categories
         WHERE user_id IS NULL OR user_id = $1
         ORDER BY category_type, name`,
        [userId]
      ),
      accountService.getAccounts(userId),
    ]);

    const userCategories = categoriesResult.rows;
    const userAccounts = accounts;

    let fileBuffer = null;
    let mimeType = null;
    let textContent = null;

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;

      // Handle CSV or text files directly
      if (mimeType.includes("text") || mimeType.includes("csv")) {
        textContent = fileBuffer.toString("utf-8");
        fileBuffer = null;
        mimeType = null;
      }
    } else if (req.body.text && typeof req.body.text === "string" && req.body.text.trim()) {
      textContent = req.body.text.trim();
    } else {
      return res.status(400).json({
        success: false,
        message: "Please upload a bank statement file (PDF, CSV, image) or paste statement/SMS text.",
      });
    }

    const parsedData = await aiService.parseBankStatement({
      fileBuffer,
      mimeType,
      textContent,
      userCategories,
      userAccounts,
    });

    const txList = parsedData.transactions || [];

    return res.status(200).json({
      success: true,
      message: `Successfully extracted ${txList.length} transaction(s)`,
      count: txList.length,
      detected_account: parsedData.detected_account || null,
      detected_new_categories: parsedData.detected_new_categories || [],
      data: txList,
    });
  } catch (error) {
    console.error("AI statement parsing error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze bank statement with AI.",
    });
  }
}

async function suggestCategory(req, res) {
  try {
    const userId = req.user.id;
    const { description, merchant, amount, type } = req.body;

    const categoriesResult = await pool.query(
      `SELECT id, name, category_type AS type
       FROM categories
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY category_type, name`,
      [userId]
    );

    const suggestion = await aiService.autoCategorizeTransaction({
      description,
      merchant,
      amount,
      type: type || "EXPENSE",
      userCategories: categoriesResult.rows,
    });

    return res.status(200).json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error("AI category suggestion error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to suggest category with AI.",
    });
  }
}

module.exports = {
  parseStatement,
  suggestCategory,
};

