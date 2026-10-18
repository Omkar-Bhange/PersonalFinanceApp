const pool = require("../config/database");

/**
 * Built-in dictionary of well-known merchant patterns and their recommended categories & types
 */
const MERCHANT_KNOWLEDGE_BASE = [
  // Food & Dining
  { pattern: /\b(swiggy|zomato|eatsure|mcdonald|domino|starbucks|kfc|burger king|pizza hut|subway|haldiram|barbeque nation|cafe|bistro|restaurant|dhaba|baker(?:y|ies)?|canteen|food|dining|sweets)\b/i, category: "Food & Dining", type: "EXPENSE" },
  // Groceries
  { pattern: /\b(bigbasket|blinkit|zepto|instamart|dmart|d-mart|reliance smart|spencer|nature'?s basket|grofers|kirana|supermarket|provision|dairy|milk|vegetable|fruits|meat)\b/i, category: "Groceries", type: "EXPENSE" },
  // Fuel & Transportation
  { pattern: /\b(shell|hpcl|bpcl|iocl|indian oil|hindustan petroleum|bharat petroleum|petrol|diesel|cng|fuel|petroleum)\b/i, category: "Fuel", type: "EXPENSE" },
  { pattern: /\b(uber|ola|rapido|pmpml|best|dtc|metro|irctc|indian rail|makemytrip|yatra|goibibo|cleartrip|indigo|air india|vistara|spicejet|fastag|toll|parking)\b/i, category: "Transportation", type: "EXPENSE" },
  // Utilities & Bills
  { pattern: /\b(mahavitaran|mseb|bescom|adani electricity|tata power|torrent power|electricity|power corp|bsnl|jio|airtel|vi|vodafone|idea|broadband|act fibernet|hathway|tatasky|tata play|dth|recharge|indane|bharat gas|hp gas|piped gas|water bill|municipal|property tax)\b/i, category: "Utilities & Bills", type: "EXPENSE" },
  // Shopping & E-Commerce
  { pattern: /\b(amazon|flipkart|myntra|meesho|ajio|nykaa|tata cliq|decathlon|zara|h&m|uniqlo|shoppers stop|westside|pantaloons|trends|croma|vijay sales|reliance digital|ikea)\b/i, category: "Shopping", type: "EXPENSE" },
  // Entertainment & Subscriptions
  { pattern: /\b(netflix|spotify|hotstar|disney|prime video|youtube|bookmyshow|pvr|inox|cinepolis|sonyliv|zee5|apple|google play|play store|playstation|xbox|steam)\b/i, category: "Entertainment", type: "EXPENSE" },
  // Health & Medical
  { pattern: /\b(apollo|medplus|netmeds|pharmeasy|1mg|tata 1mg|medico|chemist|pharmacy|hospital|clinic|diagnostic|pathology|dental|doctor|healthcare|lab)\b/i, category: "Healthcare", type: "EXPENSE" },
  // ATM & Cash
  { pattern: /\b(atm wdl|atm cash|cash wdl|nfs\b|cash withdrawal)\b/i, category: "Cash Withdrawal", type: "EXPENSE" },
  // Investments
  { pattern: /\b(zerodha|groww|angelone|upstox|kuvera|coin|mutual fund|uti|hdfc mf|sbi mf|icici pru|nippon|ppf|nps|fixed deposit|recurring deposit|rd\b|fd\b)\b/i, category: "Investments", type: "EXPENSE" },
  // Income / Salary / Refunds
  { pattern: /\b(salary|payroll|stipend|wages|bonus|incentive)\b/i, category: "Salary", type: "INCOME" },
  { pattern: /\b(dividend|interest credited|int\.pd|sweep in|int coll)\b/i, category: "Interest & Dividends", type: "INCOME" },
  { pattern: /\b(refund|cashback|reversal|cb\b|chargeback)\b/i, category: "Refunds & Cashbacks", type: "INCOME" },
];

/**
 * Clean messy bank narration into a clean human merchant/payee name
 */
function cleanMerchantName(rawNarration) {
  if (!rawNarration || typeof rawNarration !== "string") return null;

  const text = rawNarration.trim();

  // Pattern 1: Indian UPI Standard
  // Examples:
  // "WDL TFR UPI/DR/953797501240/PRERANA /YESB/paytmqr70u/Paym" -> "Prerana"
  // "UPI/DR/874219153286/SWIGGY I/ICIC/swiggy@icici" -> "Swiggy"
  // "UPI/CR/628557291495/MANGESH /SBI/..." -> "Mangesh"
  const upiMatch = text.match(/UPI\/(?:DR|CR)\/\d+\/([^/]+)/i);
  if (upiMatch && upiMatch[1]) {
    const candidate = upiMatch[1].replace(/\s+/g, " ").trim();
    if (candidate && candidate.length > 1 && !/^\d+$/.test(candidate)) {
      return formatTitleCase(candidate);
    }
  }

  // Pattern 2: UPI without ref numbers
  const upiAltMatch = text.match(/UPI\/(?:DR|CR)\/([^/]+)/i);
  if (upiAltMatch && upiAltMatch[1]) {
    const candidate = upiAltMatch[1].replace(/\s+/g, " ").trim();
    if (candidate && candidate.length > 1 && !/^\d+$/.test(candidate)) {
      return formatTitleCase(candidate);
    }
  }

  // Pattern 3: NEFT / RTGS
  // "DEP TFR NEFT*ICIC0099999*IN22627431774488*HERITAGE FOODS" -> "Heritage Foods"
  const neftMatch = text.match(/NEFT\*[^*]+\*[^*]+\*([^/*\n\r]+)/i);
  if (neftMatch && neftMatch[1]) {
    return formatTitleCase(neftMatch[1].trim());
  }

  // Pattern 4: ATM Cash
  if (/ATM\s*(?:WDL|CASH)/i.test(text)) {
    return "ATM Cash Withdrawal";
  }

  // Pattern 5: POS (Point of Sale / Card swipe)
  // "POS 401234XXXXXX1234 RELIANCE SMART PUNE"
  const posMatch = text.match(/POS\s+[\dX*]+\s+([^/*\n\r]+)/i);
  if (posMatch && posMatch[1]) {
    return formatTitleCase(posMatch[1].trim());
  }

  // Fallback: Strip common bank prefixes and suffixes
  let cleaned = text
    .replace(/^(?:WDL TFR|DEP TFR|ACH DR|ACH CR|NEFT|RTGS|IMPS|POS|UPI)\s*/i, "")
    .replace(/\b(?:PVT\s*LTD|LTD|LLP|INC)\b/gi, "")
    .replace(/[0-9]{8,}/g, "") // remove long reference numbers
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 50) cleaned = cleaned.slice(0, 50).trim();
  return cleaned ? formatTitleCase(cleaned) : null;
}

function formatTitleCase(str) {
  if (!str) return "";
  let clean = str
    .replace(/^(?:PAYTMQR|BHARATPE|GPAY|PHONEPE|AMZNQR)\S*\s*/i, "")
    .replace(/\s+[A-Z]$/i, "") // strip trailing single character suffix (e.g. SWIGGY I -> SWIGGY)
    .replace(/[*_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fetch user's historical transaction mappings (Self-learning ML lookup)
 */
async function getUserHistoricalMappings(userId) {
  try {
    const res = await pool.query(
      `SELECT
         LOWER(TRIM(t.merchant)) AS merchant_clean,
         t.category_id,
         c.name AS category_name,
         c.category_type,
         COUNT(*) AS freq
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.merchant IS NOT NULL AND TRIM(t.merchant) != ''
       GROUP BY LOWER(TRIM(t.merchant)), t.category_id, c.name, c.category_type
       ORDER BY freq DESC`,
      [userId]
    );

    const historyMap = new Map();
    for (const row of res.rows) {
      if (!historyMap.has(row.merchant_clean)) {
        historyMap.set(row.merchant_clean, {
          category_id: row.category_id,
          category_name: row.category_name,
          category_type: row.category_type,
          confidence: "HIGH",
          source: "USER_HISTORY",
        });
      }
    }
    return historyMap;
  } catch (err) {
    console.error("Failed to load user historical category mappings:", err.message);
    return new Map();
  }
}

/**
 * Categorize a transaction using:
 * 1. User's past transaction history (Learned ML memory)
 * 2. Knowledge base rules (Indian & Global merchant registry)
 * 3. Existing user categories fuzzy matching
 */
function categorizeTransaction({
  merchant,
  rawNarration,
  transactionType,
  userCategories = [],
  userHistoryMap = new Map(),
}) {
  const normMerchant = (merchant || "").toLowerCase().trim();
  const normNarration = (rawNarration || "").toLowerCase().trim();
  const searchCorpus = `${normMerchant} ${normNarration}`;

  // 1. Check User History (exact or contained merchant match)
  if (normMerchant && userHistoryMap.has(normMerchant)) {
    const hist = userHistoryMap.get(normMerchant);
    if (!transactionType || hist.category_type === transactionType) {
      return {
        category_id: hist.category_id,
        category_name: hist.category_name,
        is_new_category: false,
        confidence: "HIGH",
        reason: "Learned from your previous transactions",
      };
    }
  }

  // Check if any historical merchant is a prominent substring in the narration
  for (const [histMerchant, data] of userHistoryMap.entries()) {
    if (histMerchant.length >= 3 && searchCorpus.includes(histMerchant)) {
      if (!transactionType || data.category_type === transactionType) {
        return {
          category_id: data.category_id,
          category_name: data.category_name,
          is_new_category: false,
          confidence: "HIGH",
          reason: `Matched past merchant "${formatTitleCase(histMerchant)}"`,
        };
      }
    }
  }

  // 2. Check Knowledge Base
  for (const rule of MERCHANT_KNOWLEDGE_BASE) {
    if (rule.pattern.test(searchCorpus)) {
      if (!transactionType || rule.type === transactionType) {
        // Find if user already has this category or a close match
        const existingCat = userCategories.find(
          (c) =>
            c.category_type === rule.type &&
            (c.name.toLowerCase() === rule.category.toLowerCase() ||
              c.name.toLowerCase().includes(rule.category.toLowerCase()) ||
              rule.category.toLowerCase().includes(c.name.toLowerCase()))
        );

        if (existingCat) {
          return {
            category_id: existingCat.id,
            category_name: existingCat.name,
            is_new_category: false,
            confidence: "HIGH",
            reason: `Recognized pattern: ${rule.category}`,
          };
        } else {
          return {
            category_id: null,
            category_name: rule.category,
            is_new_category: true,
            confidence: "HIGH",
            reason: `Auto-suggested category: ${rule.category}`,
          };
        }
      }
    }
  }

  // 3. Fallback: match by keywords in user's existing categories
  for (const cat of userCategories) {
    if (transactionType && cat.category_type !== transactionType) continue;
    const catWords = cat.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    for (const w of catWords) {
      if (searchCorpus.includes(w)) {
        return {
          category_id: cat.id,
          category_name: cat.name,
          is_new_category: false,
          confidence: "MEDIUM",
          reason: `Matched category keyword: ${cat.name}`,
        };
      }
    }
  }

  return {
    category_id: null,
    category_name: "",
    is_new_category: false,
    confidence: "LOW",
    reason: "Uncategorized",
  };
}

module.exports = {
  cleanMerchantName,
  getUserHistoricalMappings,
  categorizeTransaction,
};
