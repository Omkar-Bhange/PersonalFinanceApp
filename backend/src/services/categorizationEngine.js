const pool = require("../config/database");

/**
 * Built-in dictionary of well-known merchant patterns and their recommended categories & types
 */
const MERCHANT_KNOWLEDGE_BASE = [
  // Food & Dining
  {
    pattern: /\b(swiggy|zomato|eatsure|mcdonald|domino|starbucks|kfc|burger king|pizza hut|subway|haldiram|barbeque nation|cafe|bistro|restaurant|dhaba|baker(?:y|ies)?|canteen|foods?|dining|sweets?|biryani|chai|tea stall|vadapav|udupi|mess|bhojanalay|tiffin|cake|dessert)\b/i,
    category: "Food & Dining",
    type: "EXPENSE",
  },
  // Groceries & Supermarkets
  {
    pattern: /\b(bigbasket|blinkit|zepto|instamart|dmart|d-mart|reliance smart|spencer|nature'?s basket|grofers|kirana|supermarket|provision|dairy|milk|amul|mother dairy|vegetable|fruits|sabzi|bhaji|meat|chicken|fish|eggs|country delight|ration|kisan)\b/i,
    category: "Groceries",
    type: "EXPENSE",
  },
  // Fuel & Petroleum
  {
    pattern: /\b(shell|hpcl|bpcl|iocl|indian oil|hindustan petroleum|bharat petroleum|petrol|diesel|cng|fuel|petroleum|indianoil)\b/i,
    category: "Fuel",
    type: "EXPENSE",
  },
  // Transportation & Travel
  {
    pattern: /\b(uber|ola|rapido|pmpml|best|dtc|metro|irctc|indian rail|redbus|abhibus|makemytrip|yatra|goibibo|cleartrip|indigo|air india|vistara|spicejet|akasa|fastag|netc fastag|toll|parking|auto|rickshaw|cab|taxi)\b/i,
    category: "Transportation",
    type: "EXPENSE",
  },
  // Utilities & Bills
  {
    pattern: /\b(mahavitaran|mseb|bescom|adani electricity|tata power|torrent power|electricity|power corp|bsnl|jio|airtel|vi\b|vodafone|idea|broadband|act fibernet|hathway|tatasky|tata play|dth|recharge|indane|bharat gas|hp gas|piped gas|water bill|municipal|property tax|society|maintenance)\b/i,
    category: "Utilities & Bills",
    type: "EXPENSE",
  },
  // Shopping & E-Commerce
  {
    pattern: /\b(amazon|flipkart|myntra|meesho|ajio|nykaa|tata cliq|decathlon|zara|h&m|uniqlo|shoppers stop|westside|pantaloons|trends|croma|vijay sales|reliance digital|ikea|lenskart|clothing|footwear|mall)\b/i,
    category: "Shopping",
    type: "EXPENSE",
  },
  // Entertainment & Subscriptions
  {
    pattern: /\b(netflix|spotify|hotstar|disney|prime video|youtube|bookmyshow|pvr|inox|cinepolis|sonyliv|zee5|apple|google play|play store|playstation|xbox|steam|audible|movie|cinema)\b/i,
    category: "Entertainment",
    type: "EXPENSE",
  },
  // Health, Medical & Fitness
  {
    pattern: /\b(apollo|medplus|netmeds|pharmeasy|1mg|tata 1mg|medico|chemist|druggist|pharmacy|hospital|clinic|diagnostic|pathology|dr lal|metropolis|dental|doctor|healthcare|lab|medicine|gym|cult\.fit|fitness)\b/i,
    category: "Healthcare",
    type: "EXPENSE",
  },
  // Investments & Wealth
  {
    pattern: /\b(zerodha|groww|angelone|angel one|upstox|kuvera|coin|mutual fund|sip|amc|uti|hdfc mf|sbi mf|icici pru|nippon|motilal|ppf|nps|fixed deposit|recurring deposit|rd\b|fd\b|sgb|gold bond|shares|stock)\b/i,
    category: "Investments",
    type: "EXPENSE",
  },
  // ATM & Cash
  {
    pattern: /\b(atm wdl|atm cash|cash wdl|nfs\b|cash withdrawal|atm)\b/i,
    category: "Cash Withdrawal",
    type: "EXPENSE",
  },
  // Education & Books
  {
    pattern: /\b(school|college|tuition|classes|coaching|coursera|udemy|edx|books|stationery|university|exam fee|allen|resonance|unacademy)\b/i,
    category: "Education",
    type: "EXPENSE",
  },
  // Personal Care & Salon
  {
    pattern: /\b(salon|spa|barber|parlour|haircut|beauty|nails|grooming)\b/i,
    category: "Personal Care",
    type: "EXPENSE",
  },
  // Credit Cards, Loans & EMI
  {
    pattern: /\b(credit card|hdfc cc|sbi card|icici cc|axis cc|cred\b|cheq\b|loan emi|home loan|car loan|personal loan|bajaj finance)\b/i,
    category: "Loans & EMI",
    type: "EXPENSE",
  },
  // Income / Salary / Professional
  {
    pattern: /\b(salary|payroll|stipend|wages|bonus|incentive|consultancy|freelance|client payment)\b/i,
    category: "Salary",
    type: "INCOME",
  },
  // Interest & Dividends
  {
    pattern: /\b(dividend|interest credited|int\.pd|int pd|sweep in|int coll|fd interest|savings interest)\b/i,
    category: "Interest & Dividends",
    type: "INCOME",
  },
  // Refunds & Cashbacks
  {
    pattern: /\b(refund|cashback|reversal|cb\b|chargeback)\b/i,
    category: "Refunds & Cashbacks",
    type: "INCOME",
  },
];

/**
 * Clean messy bank narration into a clean human merchant/payee name
 */
function cleanMerchantName(rawNarration) {
  if (!rawNarration || typeof rawNarration !== "string") return null;

  const text = rawNarration.trim();

  // Pattern 1: Indian UPI Standard with reference / bank routing
  // Examples:
  // "WDL TFR UPI/DR/953797501240/PRERANA /YESB/paytmqr70u/Paym 0097693162093 AT 03443 JEUR" -> "Prerana"
  // "WDL TFR UPI/DR/434849142397/MUKESH J/HDFC/Vyapar.172/Paym 0097693162093 AT 03443 JEUR" -> "Mukesh J"
  // "DEP TFR UPI/CR/627491570051/VIRAJ SU/BKID/vm7253427@/UPI 0097735162098 AT 03443 JEUR" -> "Viraj Su"
  // "UPI/DR/874219153286/SWIGGY I/ICIC/swiggy@icici" -> "Swiggy"
  const upiMatch = text.match(/UPI\/(?:DR|CR)\/\d+\/([^/]+)/i);
  if (upiMatch && upiMatch[1]) {
    const candidate = cleanCandidateString(upiMatch[1]);
    if (candidate && candidate.length > 1 && !/^\d+$/.test(candidate)) {
      return formatTitleCase(candidate);
    }
  }

  // Pattern 2: UPI without reference number
  const upiAltMatch = text.match(/UPI\/(?:DR|CR)\/([^/]+)/i);
  if (upiAltMatch && upiAltMatch[1]) {
    const candidate = cleanCandidateString(upiAltMatch[1]);
    if (candidate && candidate.length > 1 && !/^\d+$/.test(candidate)) {
      return formatTitleCase(candidate);
    }
  }

  // Pattern 3: NEFT / RTGS with sender/beneficiary name
  // "DEP TFR NEFT*ICIC0099999*IN22627431774488*HERITAGE FOODS" -> "Heritage Foods"
  const neftMatch = text.match(/NEFT\*[^*]+\*[^*]+\*([^/*\n\r]+)/i);
  if (neftMatch && neftMatch[1]) {
    return formatTitleCase(cleanCandidateString(neftMatch[1]));
  }

  // Pattern 4: IMPS transfer
  const impsMatch = text.match(/IMPS\/(?:P2A|P2P)\/\d+\/([^/*\n\r]+)/i);
  if (impsMatch && impsMatch[1]) {
    return formatTitleCase(cleanCandidateString(impsMatch[1]));
  }

  // Pattern 5: ATM Cash Withdrawal
  if (/ATM\s*(?:WDL|CASH)/i.test(text)) {
    return "ATM Cash Withdrawal";
  }

  // Pattern 6: Bank Interest
  if (/INT(?:\.|\s*)PD|INTEREST CREDITED/i.test(text)) {
    return "Bank Interest Credit";
  }

  // Pattern 7: POS (Point of Sale / Card swipe)
  // "POS 401234XXXXXX1234 RELIANCE SMART PUNE"
  const posMatch = text.match(/POS\s+[\dX*]+\s+([^/*\n\r]+)/i);
  if (posMatch && posMatch[1]) {
    return formatTitleCase(cleanCandidateString(posMatch[1]));
  }

  // Fallback: Strip common bank prefixes and suffixes
  let cleaned = text
    .replace(/^(?:WDL TFR|DEP TFR|ACH DR|ACH CR|ACH D|ACH C|ACH|ECS|NEFT|RTGS|IMPS|POS|UPI)\s*[-:]?\s*(?:SIP\s*[-:]?\s*)?(?:[0-9]{4,}\s*[-:]?\s*)?/i, "")
    .replace(/\b(?:PVT\s*LTD|LTD|LLP|INC)\b/gi, "")
    .replace(/\bAT\s+\d+\s+[\w\s]+$/i, "") // strip trailing "AT 03443 JEUR"
    .replace(/[0-9]{8,}/g, "") // remove long reference numbers
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 50) cleaned = cleaned.slice(0, 50).trim();
  return cleaned ? formatTitleCase(cleaned) : null;
}

function cleanCandidateString(str) {
  if (!str) return "";
  return str
    .replace(/^(?:PAYTMQR|BHARATPE|GPAY|PHONEPE|AMZNQR|VYAPAR)\S*\s*/i, "")
    .replace(/\bAT\s+\d+\b.*$/i, "")
    .replace(/\s+[A-Z]$/i, "") // strip trailing single character suffix (e.g. SWIGGY I -> SWIGGY)
    .replace(/[*_#@]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTitleCase(str) {
  if (!str) return "";
  const clean = cleanCandidateString(str);

  return clean
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fuzzy similarity score between two merchant strings (0.0 to 1.0)
 * Uses Jaccard word token overlap and substring containment
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Substring containment check
  if (s1.includes(s2) || s2.includes(s1)) {
    const lenRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return Math.max(0.75, lenRatio);
  }

  // Token set overlap (Jaccard similarity)
  const tokens1 = new Set(s1.split(/[\s\-_./]+/).filter((t) => t.length > 2));
  const tokens2 = new Set(s2.split(/[\s\-_./]+/).filter((t) => t.length > 2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let common = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) common++;
  }

  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return common / unionSize;
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

  // 1b. Check User History with Fuzzy Similarity Match
  if (normMerchant) {
    let bestHistMatch = null;
    let highestSim = 0;

    for (const [histMerchant, data] of userHistoryMap.entries()) {
      if (transactionType && data.category_type !== transactionType) continue;
      const sim = calculateSimilarity(normMerchant, histMerchant);
      if (sim > highestSim && sim >= 0.6) {
        highestSim = sim;
        bestHistMatch = { merchant: histMerchant, ...data };
      }
    }

    if (bestHistMatch) {
      return {
        category_id: bestHistMatch.category_id,
        category_name: bestHistMatch.category_name,
        is_new_category: false,
        confidence: highestSim >= 0.8 ? "HIGH" : "MEDIUM",
        reason: `Learned pattern: similar to "${formatTitleCase(bestHistMatch.merchant)}" (${Math.round(highestSim * 100)}% match)`,
      };
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

  // 3. Match by keywords or fuzzy similarity in user's existing categories
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
    const catSim = calculateSimilarity(normMerchant, cat.name);
    if (catSim >= 0.6) {
      return {
        category_id: cat.id,
        category_name: cat.name,
        is_new_category: false,
        confidence: "MEDIUM",
        reason: `Matched category name: ${cat.name}`,
      };
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
