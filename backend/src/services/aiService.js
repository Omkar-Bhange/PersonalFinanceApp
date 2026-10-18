const env = require("../config/env");

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
];

async function callGemini(parts, systemInstruction = "") {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured in backend environment.");
    error.statusCode = 500;
    throw error;
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || `Gemini API returned HTTP ${res.status}`);
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Empty response from AI model");
      }

      return JSON.parse(rawText);
    } catch (err) {
      lastError = err;
      console.warn(`[AI] Attempt with ${model} failed: ${err.message}. Trying next fallback...`);
    }
  }

  throw lastError || new Error("Failed to process request with AI models.");
}

/**
 * Parse bank statement (PDF, image, CSV, or raw text) into structured transactions
 */
async function parseBankStatement({ fileBuffer, mimeType, textContent, userCategories = [], userAccounts = [] }) {
  const categoriesList = userCategories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  const accountsList = userAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    current_balance: a.current_balance,
  }));

  const systemInstruction = `
You are an expert personal finance parsing assistant.
Your task is to analyze bank statements, account passbooks, transaction SMS messages, or UPI receipts and extract:
1. Bank Account details (Bank Name, Account Number, detected account).
2. Every valid financial transaction row.
3. Relevant Categories (mapping to existing ones or proposing new ones when needed).

Output MUST be a single JSON object conforming strictly to this format:
{
  "detected_account": {
    "bank_name": "State Bank of India (or other detected bank)",
    "account_number_last4": "1234 or null",
    "suggested_account_name": "SBI Account (...1234)",
    "matched_account_id": number or null
  },
  "statement_closing_balance": 14401.50 or null,
  "statement_opening_balance": 14750.50 or null,
  "detected_new_categories": [
    {
      "name": "Category Name",
      "type": "EXPENSE" | "INCOME",
      "color": "#10b981"
    }
  ],
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD",
      "raw_narration": "Original transaction line or SMS",
      "merchant": "Clean merchant or person name (e.g. Swiggy, Netflix, Tatya, Salary, Electric Board)",
      "amount": 450.00,
      "transaction_type": "EXPENSE" | "INCOME",
      "suggested_category_id": number or null,
      "suggested_category_name": "Category Name",
      "is_new_category": boolean,
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "notes": "Short helpful note (e.g. UPI transfer, dining, ATM withdrawal)"
    }
  ]
}

SPECIAL RULES FOR INDIAN BANK STATEMENTS (e.g. STATE BANK OF INDIA / SBI):
1. In many SBI statements, wide tables are split across consecutive page sets:
   - Early pages (e.g. Pages 1-4) list the Dates sequentially.
   - Middle pages (e.g. Pages 5-8) list the Details/Narration and Debit amounts.
   - Later pages (e.g. Pages 9-12) list the Credit amounts and Running Balances.
   Correlate these rows row-by-row in sequential order!
2. Narration lines indicate direction explicitly:
   - "WDL TFR" or "UPI/DR" or "ATM WDL" or "Debit" = "EXPENSE" (money spent).
   - "DEP TFR" or "UPI/CR" or "NEFT*... CR" or "Credit" = "INCOME" (money received).
3. transaction_date: Must be YYYY-MM-DD. If statement specifies statement range (e.g. 01-10-2026 to 18-10-2026), use the statement year (2026).
4. amount: Must be a positive decimal number (float), without currency symbols.
5. merchant: Extract a clean, human-readable name by stripping technical bank codes:
   - "UPI/DR/874219153286/SWIGGY I/ICIC/..." -> "Swiggy"
   - "UPI/DR/819393173204/MEDICO P/YESB/..." -> "Medico Pharmacy"
   - "UPI/DR/444454374131/PMPML/CBIN/..." -> "PMPML Bus Transport"
   - "ATM WDL ATM CASH 6287090026..." -> "ATM Cash Withdrawal"
   - "UPI/DR/.../VIRAJ SU/..." -> "Viraj"
   - "UPI/DR/.../ROHAN RA/..." -> "Rohan"
   - "UPI/DR/.../TUSHAR T/..." -> "Tushar"
   - "UPI/CR/628557291495/MANGESH..." -> "Mangesh"
   - "DEP TFR NEFT*ICIC0099999*IN22627431774488* HERITAGE FOODS" -> "Heritage Foods"
6. Account Matching:
   Match the bank and account number against the user's accounts list:
${JSON.stringify(accountsList, null, 2)}
   If matched, set "matched_account_id" to that account's id. If not, leave as null.
7. Category Matching & New Category Creation:
   Match each transaction against the user's available categories whenever possible:
${JSON.stringify(categoriesList, null, 2)}
   If an existing category matches well, use its id and name, and set "is_new_category": false.
   If NO existing category is a good match (e.g. Public Transport, Medical, Pharmacy, Milk/Dairy, ATM Cash), propose a logical clean category name (e.g. "Public Transport", "Medical & Pharmacy", "Cash Withdrawal", "Groceries"), set "is_new_category": true, and add it to "detected_new_categories".
8. Return ONLY valid JSON conforming to the schema above.
`;

  const parts = [];

  if (fileBuffer && mimeType) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: fileBuffer.toString("base64"),
      },
    });
    parts.push({
      text: "Please extract all financial transactions from this document according to the provided system instructions.",
    });
  } else if (textContent) {
    parts.push({
      text: `Please extract all financial transactions from the following bank text / SMS content:\n\n${textContent}`,
    });
  } else {
    throw new Error("No file or text provided for AI parsing.");
  }

  const result = await callGemini(parts, systemInstruction);

  // Normalize result format and transaction fields
  const rawTransactions = Array.isArray(result)
    ? result
    : Array.isArray(result.transactions)
    ? result.transactions
    : [];

  const normalizedTransactions = rawTransactions.map((tx) => {
    const rawType = String(tx.transaction_type || "").toUpperCase();
    const narration = String(tx.raw_narration || "").toUpperCase();
    const isIncome =
      rawType === "INCOME" ||
      rawType === "CREDIT" ||
      rawType === "CR" ||
      narration.includes("UPI/CR") ||
      narration.includes("DEP TFR");

    return {
      ...tx,
      transaction_type: isIncome ? "INCOME" : "EXPENSE",
      amount: Math.abs(parseFloat(tx.amount) || 0),
    };
  });

  return {
    detected_account: result.detected_account || null,
    detected_new_categories: Array.isArray(result.detected_new_categories) ? result.detected_new_categories : [],
    statement_closing_balance: result.statement_closing_balance ? Number(result.statement_closing_balance) : null,
    statement_opening_balance: result.statement_opening_balance ? Number(result.statement_opening_balance) : null,
    transactions: normalizedTransactions,
  };
}

/**
 * Categorize a single transaction or query from user
 */
async function autoCategorizeTransaction({ description, merchant, amount, type, userCategories = [] }) {
  const prompt = `Given this transaction:
- Description: ${description || "N/A"}
- Merchant: ${merchant || "N/A"}
- Amount: ${amount}
- Type: ${type}

Available Categories:
${JSON.stringify(userCategories, null, 2)}

Return a JSON object:
{
  "category_id": number or null,
  "category_name": string or null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reason": "Brief explanation"
}`;

  return await callGemini([{ text: prompt }], "You are a smart financial auto-categorization engine.");
}

module.exports = {
  callGemini,
  parseBankStatement,
  autoCategorizeTransaction,
};

