const pool = require("../config/database");
const accountService = require("../services/accountService");
const aiService = require("../services/aiService");
const { parseExcelOrCsvStatement } = require("../services/excelStatementParser");
const {
  cleanMerchantName,
  getUserHistoricalMappings,
  categorizeTransaction,
} = require("../services/categorizationEngine");

async function parseStatement(req, res) {
  try {
    const userId = req.user.id;

    // 1. Fetch available categories, accounts, and learned user historical mappings
    const [categoriesResult, accounts, userHistoryMap] = await Promise.all([
      pool.query(
        `SELECT id, name, category_type AS type
         FROM categories
         WHERE user_id IS NULL OR user_id = $1
         ORDER BY category_type, name`,
        [userId]
      ),
      accountService.getAccounts(userId),
      getUserHistoricalMappings(userId),
    ]);

    const userCategories = categoriesResult.rows;
    const userAccounts = accounts;

    let fileBuffer = null;
    let mimeType = null;
    let textContent = null;
    let originalName = "";

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype || "";
      originalName = req.file.originalname || "";

      // For plain text files (not Excel/CSV), convert to text string
      if (mimeType.includes("text/plain") || originalName.endsWith(".txt")) {
        textContent = fileBuffer.toString("utf-8");
        fileBuffer = null;
        mimeType = null;
      }
    } else if (req.body.text && typeof req.body.text === "string" && req.body.text.trim()) {
      textContent = req.body.text.trim();
    } else {
      return res.status(400).json({
        success: false,
        message: "Please upload a bank statement file (Excel, PDF, CSV, image) or paste statement/SMS text.",
      });
    }

    const isExcelOrCsv =
      Boolean(fileBuffer) &&
      (originalName.match(/\.(xlsx|xls|csv)$/i) ||
        mimeType.includes("spreadsheet") ||
        mimeType.includes("excel") ||
        mimeType.includes("csv"));

    let parsedData = null;

    if (isExcelOrCsv) {
      // 100% Deterministic extraction from Excel (.xlsx, .xls) or CSV
      parsedData = parseExcelOrCsvStatement(fileBuffer, originalName);
    } else {
      // PDF, Screenshot, or SMS text via Gemini AI
      parsedData = await aiService.parseBankStatement({
        fileBuffer,
        mimeType,
        textContent,
        userCategories,
        userAccounts,
      });
    }

    // 2. Refine merchants and apply self-learning ML categorization
    const newCategoriesSet = new Set();
    const finalTransactions = (parsedData.transactions || []).map((tx) => {
      // Clean merchant name if messy bank narration
      const cleanMerchant = cleanMerchantName(tx.merchant || tx.raw_narration) || tx.merchant || "";

      // Run categorization engine (User history -> Rules -> AI suggestion)
      const catMatch = categorizeTransaction({
        merchant: cleanMerchant,
        rawNarration: tx.raw_narration,
        transactionType: tx.transaction_type,
        userCategories,
        userHistoryMap,
      });

      let finalCategoryId = tx.suggested_category_id || null;
      let finalCategoryName = tx.suggested_category_name || "";
      let isNewCategory = false;

      if (catMatch.category_id) {
        finalCategoryId = catMatch.category_id;
        finalCategoryName = catMatch.category_name;
        isNewCategory = false;
      } else if (catMatch.category_name) {
        finalCategoryName = catMatch.category_name;
        isNewCategory = catMatch.is_new_category;
      } else if (tx.suggested_category_name) {
        finalCategoryName = tx.suggested_category_name;
        isNewCategory = !!tx.is_new_category;
      }

      if (isNewCategory && finalCategoryName) {
        newCategoriesSet.add(
          JSON.stringify({
            name: finalCategoryName,
            type: tx.transaction_type,
            color: tx.transaction_type === "INCOME" ? "#10b981" : "#0284c7",
          })
        );
      }

      return {
        ...tx,
        merchant: cleanMerchant || tx.merchant || "Transaction",
        suggested_category_id: finalCategoryId,
        suggested_category_name: finalCategoryName,
        is_new_category: isNewCategory,
      };
    });

    const combinedNewCategories = [
      ...(parsedData.detected_new_categories || []),
      ...Array.from(newCategoriesSet).map((s) => JSON.parse(s)),
    ];

    // Deduplicate new categories
    const uniqueNewCategories = Array.from(
      new Map(combinedNewCategories.map((c) => [`${c.name}_${c.type}`, c])).values()
    );

    // Auto-match detected account against user's existing accounts if needed
    const detectedAcc = parsedData.detected_account || {};
    if (!detectedAcc.matched_account_id && detectedAcc.account_number_last4) {
      const match = userAccounts.find(
        (a) =>
          a.name.includes(detectedAcc.account_number_last4) ||
          (detectedAcc.bank_name && a.name.toLowerCase().includes(detectedAcc.bank_name.toLowerCase()))
      );
      if (match) {
        detectedAcc.matched_account_id = match.id;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully extracted ${finalTransactions.length} transaction(s)`,
      count: finalTransactions.length,
      detected_account: detectedAcc,
      detected_new_categories: uniqueNewCategories,
      statement_closing_balance: parsedData.statement_closing_balance ?? null,
      statement_opening_balance: parsedData.statement_opening_balance ?? null,
      data: finalTransactions,
    });
  } catch (error) {
    console.error("Statement parsing error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze bank statement.",
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

