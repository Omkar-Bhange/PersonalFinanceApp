const pool = require("../config/database");
const env = require("../config/env");
const { categorizeTransaction, cleanMerchantName } = require("./categorizationEngine");
const { getMonthlyBudgets, checkBudgetAlert } = require("./budgetService");

function renderProgressBar(percentage, length = 10) {
  const filled = Math.min(length, Math.max(0, Math.round((percentage / 100) * length)));
  return "█".repeat(filled) + "░".repeat(length - filled);
}

let cachedBotInfo = null;

/**
 * Make a request to the Telegram Bot API
 */
async function callTelegramApi(method, body = {}) {
  const token = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API Error: ${data.description || res.statusText}`);
  }

  return data.result;
}

/**
 * Get Bot profile info (username, id)
 */
async function getBotInfo() {
  if (cachedBotInfo) return cachedBotInfo;

  try {
    const info = await callTelegramApi("getMe");
    cachedBotInfo = info;
    return info;
  } catch (err) {
    console.warn("[Telegram] Could not fetch bot info:", err.message);
    return null;
  }
}

/**
 * Send a message to a Telegram chat
 */
async function sendTelegramMessage(chatId, text, extraParams = {}) {
  try {
    return await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...extraParams,
    });
  } catch (err) {
    console.error(`[Telegram] Failed to send message to ${chatId}:`, err.message);
    // If Markdown parsing fails, retry with plain text
    if (extraParams.parse_mode) {
      try {
        return await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: text.replace(/[*_`\[\]()]/g, ""),
          ...extraParams,
          parse_mode: undefined,
        });
      } catch (retryErr) {
        console.error(`[Telegram] Plain retry also failed:`, retryErr.message);
      }
    }
  }
}

/**
 * Set Webhook URL
 */
async function setTelegramWebhook(webhookUrl) {
  return await callTelegramApi("setWebhook", {
    url: webhookUrl,
    drop_pending_updates: false,
  });
}

/**
 * Generate a 6-digit linking code for the web user
 */
async function generateLinkCode(userId) {
  // Generate random 6-digit numeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Clean old expired codes for this user
  await pool.query(
    `DELETE FROM telegram_link_codes WHERE user_id = $1 OR expires_at < NOW()`,
    [userId]
  );

  await pool.query(
    `INSERT INTO telegram_link_codes (code, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [code, userId, expiresAt]
  );

  const bot = await getBotInfo();
  const botUsername = bot?.username || "YourFinanceBot";
  const linkUrl = `https://t.me/${botUsername}?start=${code}`;

  return {
    code,
    bot_username: botUsername,
    link_url: linkUrl,
    expires_at: expiresAt,
  };
}

/**
 * Verify code and link telegram chat to user
 */
async function verifyAndLinkTelegram(code, telegramUser, chatId) {
  const codeCheck = await pool.query(
    `SELECT user_id, expires_at
     FROM telegram_link_codes
     WHERE code = $1 AND expires_at > NOW()`,
    [code.trim()]
  );

  if (codeCheck.rowCount === 0) {
    return {
      success: false,
      message: "Invalid or expired link code. Please generate a new code from your web app dashboard.",
    };
  }

  const userId = codeCheck.rows[0].user_id;

  // Find user's default/first account
  const accRes = await pool.query(
    `SELECT id, name FROM accounts WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  const defaultAccountId = accRes.rows[0]?.id || null;
  const defaultAccountName = accRes.rows[0]?.name || "Primary Account";

  // Upsert telegram_users
  await pool.query(
    `INSERT INTO telegram_users
       (user_id, telegram_chat_id, telegram_username, first_name, default_account_id, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
     ON CONFLICT (telegram_chat_id)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       telegram_username = EXCLUDED.telegram_username,
       first_name = EXCLUDED.first_name,
       default_account_id = COALESCE(EXCLUDED.default_account_id, telegram_users.default_account_id),
       is_active = TRUE,
       updated_at = NOW()`,
    [
      userId,
      chatId,
      telegramUser.username || null,
      telegramUser.first_name || null,
      defaultAccountId,
    ]
  );

  // Consume used code
  await pool.query(`DELETE FROM telegram_link_codes WHERE code = $1`, [code.trim()]);

  // Fetch user name
  const userRow = await pool.query(`SELECT name, currency FROM users WHERE id = $1`, [userId]);
  const userName = userRow.rows[0]?.name || "Friend";

  return {
    success: true,
    user_id: userId,
    user_name: userName,
    default_account_name: defaultAccountName,
  };
}

/**
 * Get Telegram connection status for a web user
 */
async function getTelegramStatus(userId) {
  const res = await pool.query(
    `SELECT
       tu.telegram_chat_id,
       tu.telegram_username,
       tu.first_name,
       tu.is_active,
       tu.created_at,
       a.name AS default_account_name
     FROM telegram_users tu
     LEFT JOIN accounts a ON tu.default_account_id = a.id
     WHERE tu.user_id = $1 AND tu.is_active = TRUE`,
    [userId]
  );

  const bot = await getBotInfo();

  if (res.rowCount === 0) {
    return {
      is_connected: false,
      bot_username: bot?.username || null,
    };
  }

  const row = res.rows[0];
  return {
    is_connected: true,
    telegram_username: row.telegram_username,
    first_name: row.first_name,
    default_account_name: row.default_account_name,
    connected_at: row.created_at,
    bot_username: bot?.username || null,
  };
}

/**
 * Disconnect/unlink Telegram account
 */
async function unlinkTelegram(userId) {
  const res = await pool.query(
    `UPDATE telegram_users SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1 RETURNING telegram_chat_id`,
    [userId]
  );

  if (res.rowCount > 0) {
    const chatId = res.rows[0].telegram_chat_id;
    await sendTelegramMessage(
      chatId,
      "ℹ️ Your Telegram account has been disconnected from Personal Finance App. You can reconnect anytime from the web app."
    );
  }

  return { success: true };
}

/**
 * Parse an informal expense text or bank SMS into structured transaction data
 */
function parseTransactionText(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  const text = rawText.trim();

  // Pattern 1: Bank SMS - Debit
  // "INR 450.00 debited from a/c ...1234 on 18-Oct-26 at SWIGGY"
  // "Sent Rs.150.00 from SBI A/C 9012 to SWIGGY on 18-10-26 via UPI"
  // "Paid Rs. 240 to Cafe Bistro"
  let amount = null;
  let transactionType = "EXPENSE";
  let merchant = null;
  let accountLast4 = null;
  let date = new Date().toISOString().slice(0, 10);

  // Check direction (Credit / Income vs Debit / Expense)
  if (/\b(?:credited|deposit(?:ed)?|received|salary|refund|cashback|cr\b)/i.test(text)) {
    transactionType = "INCOME";
  } else if (/\b(?:debited|spent|paid|withdrawn|wdl|transfer(?:red)? to|dr\b)/i.test(text)) {
    transactionType = "EXPENSE";
  }

  // Extract amount: (Rs.|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)
  const amtMatch = text.match(/(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                   text.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\s*(?:rs|inr|rupees?)\b/i) ||
                   text.match(/\b([0-9]{2,7}(?:\.[0-9]{1,2})?)\b/); // fallback to standalone number

  if (amtMatch && amtMatch[1]) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ""));
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return null; // Not a financial message
  }

  // Extract Account last 4 if present: "A/C ...1234", "a/c 9012", "Account *9012"
  const accMatch = text.match(/(?:a\/c|account|acct)[^0-9]*?([0-9]{3,4})\b/i);
  if (accMatch && accMatch[1]) {
    accountLast4 = accMatch[1];
  }

  // Extract date if present (e.g. 18-Oct-2026, 18/10/2026)
  const dateMatch = text.match(/\b(\d{1,2})[-/](\d{1,2}|[a-z]{3})[-/](\d{2,4})\b/i);
  if (dateMatch) {
    const dStr = dateMatch[0];
    const parsed = new Date(dStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString().slice(0, 10);
    }
  }

  // Extract Merchant/Payee:
  // Bank SMS patterns: "to <MERCHANT> on", "at <MERCHANT>.", "VPA <MERCHANT>", "by <SOURCE> on"
  const isIncome = transactionType === "INCOME";
  const regex = !isIncome
    ? /\b(?:at|to|vpa)\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+){0,4})/i
    : /\b(?:by|from)\s+([A-Za-z0-9&'.-]+(?:\s+[A-Za-z0-9&'.-]+){0,4})/i;

  const match = text.match(regex);
  if (match && match[1]) {
    const cand = match[1].split(/\b(?:on|via|ref|using|avl|bal|inr|rs)\b|[.,]/i)[0].trim();
    if (cand && !/^(?:your|a\/c|account|sbi|hdfc|icici|axis|upi|bank)$/i.test(cand)) {
      merchant = cleanMerchantName(cand) || cand;
    }
  }

  // Fallback informal text: "Coffee 120", "Spent 350 for fuel", "Uber 450"
  if (!merchant) {
    const words = text
      .replace(/(?:rs\.?|inr|₹)\s*[0-9,]+(?:\.[0-9]{1,2})?/gi, "")
      .replace(/\b[0-9]+(?:\.[0-9]{1,2})?\b/g, "")
      .replace(/\b(?:spent|paid|for|at|on|today|yesterday|debited|credited|from|to)\b/gi, "")
      .replace(/[*_#@]+/g, " ")
      .trim();

    if (words && words.length >= 2) {
      merchant = cleanMerchantName(words) || words.slice(0, 50).trim();
    }
  }

  return {
    amount,
    transaction_type: transactionType,
    merchant: merchant || (transactionType === "INCOME" ? "Income Credit" : "Expense"),
    raw_text: text,
    account_last4: accountLast4,
    transaction_date: date,
  };
}

/**
 * Process an incoming Telegram update (message, command, photo)
 */
async function processTelegramUpdate(update) {
  const message = update?.message || update?.edited_message;
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const rawText = message.text ? message.text.trim() : "";
  const telegramUser = message.from || {};

  // 1. Check if chat is already linked to a user
  const linkCheck = await pool.query(
    `SELECT tu.user_id, tu.default_account_id, u.name AS user_name, u.currency
     FROM telegram_users tu
     JOIN users u ON tu.user_id = u.id
     WHERE tu.telegram_chat_id = $1 AND tu.is_active = TRUE`,
    [chatId]
  );

  const isLinked = linkCheck.rowCount > 0;
  const linkedUser = isLinked ? linkCheck.rows[0] : null;

  // 2. Handle /start or /link commands (Linking Flow)
  if (rawText.startsWith("/start") || rawText.startsWith("/link")) {
    const parts = rawText.split(/\s+/);
    const codeArg = parts[1]?.trim();

    if (codeArg) {
      // User sent linking code! e.g. /start 839201 or /link 839201
      const linkResult = await verifyAndLinkTelegram(codeArg, telegramUser, chatId);
      if (linkResult.success) {
        await sendTelegramMessage(
          chatId,
          `🎉 *Account Connected Successfully!*\n\n` +
          `Hello *${linkResult.user_name}*, your Telegram is now linked to your Personal Finance App account.\n\n` +
          `🏦 *Default Account:* ${linkResult.default_account_name}\n\n` +
          `💡 *How to use:*\n` +
          `• Forward any bank SMS (e.g. UPI debit, salary credit)\n` +
          `• Type quick expenses (e.g. \`Coffee 120\`, \`Spent 500 on Fuel\`)\n` +
          `• Check balance anytime with /balance\n` +
          `• See recent transactions with /recent`
        );
        return;
      } else {
        await sendTelegramMessage(chatId, `⚠️ ${linkResult.message}`);
        return;
      }
    }

    if (isLinked) {
      await sendTelegramMessage(
        chatId,
        `👋 Welcome back, *${linkedUser.user_name}*!\n\n` +
        `Your account is active and connected.\n` +
        `You can forward bank SMS messages or text quick expenses anytime.\n\n` +
        `• /balance - Check current balances\n` +
        `• /recent - See last 5 transactions\n` +
        `• /help - Full command list`
      );
      return;
    } else {
      await sendTelegramMessage(
        chatId,
        `👋 *Welcome to Personal Finance Assistant Bot!*\n\n` +
        `To start recording transactions from Telegram:\n` +
        `1️⃣ Open your Personal Finance App dashboard in your browser.\n` +
        `2️⃣ Click **Connect Telegram Bot** to generate your secure link code.\n` +
        `3️⃣ Reply here with: \`/link <YOUR_CODE>\`\n\n` +
        `_Example:_ \`/link 839201\``
      );
      return;
    }
  }

  // If NOT linked, remind user to connect first
  if (!isLinked) {
    await sendTelegramMessage(
      chatId,
      `🔒 *Account Not Connected Yet*\n\n` +
      `Please connect your Personal Finance App account first.\n` +
      `Generate a link code from your web app dashboard and send:\n` +
      `\`/link <YOUR_CODE>\``
    );
    return;
  }

  const userId = linkedUser.user_id;
  const userCurrency = linkedUser.currency || "INR";

  // 3. Handle Commands for Linked User
  if (rawText === "/help") {
    await sendTelegramMessage(
      chatId,
      `📖 *Personal Finance Bot Guide*\n\n` +
      `⚡ *Quick Expense Entry:*\n` +
      `• Just type: \`Coffee 150\`\n` +
      `• Or: \`Spent 450 for Swiggy\`\n` +
      `• Or: \`Salary 50000 received\`\n\n` +
      `📲 *Bank SMS Auto-Recording:*\n` +
      `Forward any bank debit/credit SMS directly to this chat! The AI will automatically parse the amount, payee, and category.\n\n` +
      `📊 *Commands:*\n` +
      `• /balance - View balances of all your accounts\n` +
      `• /recent - View your 5 most recent transactions\n` +
      `• /budget - View your monthly budget progress & limits\n` +
      `• /unlink - Disconnect this Telegram chat`
    );
    return;
  }

  if (rawText === "/budget") {
    const budgetData = await getMonthlyBudgets(userId);
    const { summary, category_budgets, calendar } = budgetData;

    if (!summary.total_limit && category_budgets.length === 0) {
      await sendTelegramMessage(
        chatId,
        `📊 *Budget Tracker:*\n\n` +
        `You haven't set any budgets for this month yet.\n` +
        `💡 Go to the *Budgets* tab in your web app to set limits or click *Auto-Generate* to build them from your past 3 months of spending!`
      );
      return;
    }

    const spentStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(summary.total_spent);
    const limitStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(summary.total_limit);
    const remainingStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(Math.max(0, summary.total_remaining));
    const projStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(summary.projected_spend);

    const overallBar = renderProgressBar(summary.percentage, 10);
    const statusEmoji = summary.percentage >= 100 ? "🚨 OVER BUDGET" : summary.percentage >= 80 ? "⚠️ WARNING" : "🟢 ON TRACK";

    let text = `📊 *Budget Overview for ${budgetData.month}*\n\n`;
    text += `🎯 *Overall Budget:* ${statusEmoji}\n`;
    text += `\`[${overallBar}]\` *${summary.percentage}%*\n`;
    text += `• Spent: *${spentStr}* of ${limitStr}\n`;
    text += `• Remaining: *${remainingStr}*\n`;
    text += `• Projected Month-End: *${projStr}*\n`;
    text += `• Days Remaining: *${calendar.days_remaining} days*\n\n`;

    if (category_budgets.length > 0) {
      text += `📁 *Category Limits:*\n`;
      for (const cat of category_budgets.slice(0, 8)) {
        const catBar = renderProgressBar(cat.percentage, 8);
        const catSpent = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(cat.spent);
        const catLimit = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(cat.amount_limit);
        const catEmoji = cat.percentage >= 100 ? "🔴" : cat.percentage >= 80 ? "🟡" : "🟢";
        text += `\n${catEmoji} *${cat.category_name}* (${cat.percentage}%)\n`;
        text += `   \`[${catBar}]\` ${catSpent} / ${catLimit}`;
      }
    }

    await sendTelegramMessage(chatId, text);
    return;
  }

  if (rawText === "/balance") {
    const accQuery = await pool.query(
      `SELECT
         a.name,
         a.account_type,
         (
           a.opening_balance
           + COALESCE(t.net_transactions, 0)
           + COALESCE(l.net_lending, 0)
           + COALESCE(r.net_repayments, 0)
         )::NUMERIC(14,2) AS current_balance
       FROM accounts a
       LEFT JOIN (
         SELECT account_id, SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) AS net_transactions
         FROM transactions WHERE user_id = $1 GROUP BY account_id
       ) t ON a.id = t.account_id
       LEFT JOIN (
         SELECT account_id, SUM(CASE WHEN direction = 'BORROWED' THEN principal_amount ELSE -principal_amount END) AS net_lending
         FROM lending_records WHERE user_id = $1 GROUP BY account_id
       ) l ON a.id = l.account_id
       LEFT JOIN (
         SELECT r.account_id, SUM(CASE WHEN lr.direction = 'LENT' THEN r.amount ELSE -r.amount END) AS net_repayments
         FROM repayments r
         JOIN lending_records lr ON r.lending_id = lr.id
         WHERE r.user_id = $1 GROUP BY r.account_id
       ) r ON a.id = r.account_id
       WHERE a.user_id = $1 AND a.is_active = TRUE
       ORDER BY a.created_at ASC`,
      [userId]
    );

    if (accQuery.rowCount === 0) {
      await sendTelegramMessage(chatId, "You haven't set up any accounts yet in your web app.");
      return;
    }

    let total = 0;
    const lines = accQuery.rows.map((a) => {
      const bal = parseFloat(a.current_balance || 0);
      total += bal;
      const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(bal);
      return `• *${a.name}:* ${formatted}`;
    });

    const totalFormatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(total);

    await sendTelegramMessage(
      chatId,
      `💳 *Your Accounts Balance:*\n\n` + lines.join("\n") + `\n\n💰 *Total Net Worth:* ${totalFormatted}`
    );
    return;
  }

  if (rawText === "/recent") {
    const txQuery = await pool.query(
      `SELECT t.transaction_date, t.merchant, t.description, t.amount, t.transaction_type, c.name AS category_name, a.name AS account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = $1
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT 5`,
      [userId]
    );

    if (txQuery.rowCount === 0) {
      await sendTelegramMessage(chatId, "No transactions recorded yet.");
      return;
    }

    const txLines = txQuery.rows.map((t) => {
      const isExp = t.transaction_type === "EXPENSE";
      const icon = isExp ? "🔴" : "🟢";
      const sign = isExp ? "−" : "+";
      const amtStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(t.amount);
      const title = t.merchant || t.description || "Transaction";
      const cat = t.category_name ? ` • ${t.category_name}` : "";
      return `${icon} *${sign}${amtStr}* | ${title}${cat}\n   _${t.transaction_date.toISOString().slice(0, 10)}_ (${t.account_name})`;
    });

    await sendTelegramMessage(chatId, `🕒 *Your Last 5 Transactions:*\n\n` + txLines.join("\n\n"));
    return;
  }

  if (rawText === "/unlink") {
    await pool.query(
      `UPDATE telegram_users SET is_active = FALSE, updated_at = NOW() WHERE telegram_chat_id = $1`,
      [chatId]
    );
    await sendTelegramMessage(
      chatId,
      "👋 Your Telegram account has been disconnected. You can reconnect anytime with `/link <CODE>`."
    );
    return;
  }

  // 4. Record Transaction from Text / Forwarded SMS
  if (rawText) {
    const parsed = parseTransactionText(rawText);

    if (!parsed) {
      await sendTelegramMessage(
        chatId,
        `🤔 I couldn't detect a clear transaction amount in your message.\n\n` +
        `Try typing like this:\n` +
        `• \`Coffee 120\`\n` +
        `• \`Spent 500 on Shell Petrol\`\n` +
        `• Or forward any bank debit/credit SMS!`
      );
      return;
    }

    // Match target account
    let targetAccountId = linkedUser.default_account_id;

    if (parsed.account_last4) {
      const matchedAcc = await pool.query(
        `SELECT id, name FROM accounts WHERE user_id = $1 AND is_active = TRUE AND (name ILIKE $2 OR name ILIKE $3) LIMIT 1`,
        [userId, `%${parsed.account_last4}%`, `%...${parsed.account_last4}%`]
      );
      if (matchedAcc.rowCount > 0) {
        targetAccountId = matchedAcc.rows[0].id;
      }
    }

    if (!targetAccountId) {
      const firstAcc = await pool.query(
        `SELECT id, name FROM accounts WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
        [userId]
      );
      if (firstAcc.rowCount > 0) {
        targetAccountId = firstAcc.rows[0].id;
      } else {
        // Auto create primary account if none exists
        const newAcc = await pool.query(
          `INSERT INTO accounts (user_id, name, account_type, opening_balance) VALUES ($1, 'Primary Bank Account', 'BANK', 0) RETURNING id`,
          [userId]
        );
        targetAccountId = newAcc.rows[0].id;
      }
    }

    // Fetch account name for confirmation
    const accNameRes = await pool.query(`SELECT name FROM accounts WHERE id = $1`, [targetAccountId]);
    const accountName = accNameRes.rows[0]?.name || "Account";

    // Fetch user categories & history to run categorization engine
    const [catRes, userHistRes] = await pool.all ? await pool.all() : await Promise.all([
      pool.query(`SELECT id, name, category_type FROM categories WHERE user_id IS NULL OR user_id = $1`, [userId]),
      pool.query(
        `SELECT LOWER(TRIM(merchant)) AS merchant_clean, category_id, COUNT(*) AS freq
         FROM transactions
         WHERE user_id = $1 AND merchant IS NOT NULL AND TRIM(merchant) != ''
         GROUP BY LOWER(TRIM(merchant)), category_id
         ORDER BY freq DESC`,
        [userId]
      ),
    ]);

    const userCategories = catRes.rows;
    const historyMap = new Map();
    for (const h of userHistRes.rows) {
      if (!historyMap.has(h.merchant_clean)) {
        historyMap.set(h.merchant_clean, { category_id: h.category_id });
      }
    }

    const catMatch = categorizeTransaction({
      merchant: parsed.merchant,
      rawNarration: rawText,
      transactionType: parsed.transaction_type,
      userCategories,
      userHistoryMap: historyMap,
    });

    let categoryId = catMatch.category_id || null;
    let categoryName = catMatch.category_name || "General";

    // Auto-create category if needed
    if (!categoryId && catMatch.category_name) {
      const newCat = await pool.query(
        `INSERT INTO categories (user_id, name, category_type, icon, color)
         VALUES ($1, $2, $3, 'tag', '#10b981')
         RETURNING id`,
        [userId, catMatch.category_name, parsed.transaction_type]
      );
      categoryId = newCat.rows[0].id;
    }

    // Insert transaction
    await pool.query(
      `INSERT INTO transactions
         (user_id, account_id, category_id, transaction_type, amount, transaction_date, description, merchant, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        targetAccountId,
        categoryId,
        parsed.transaction_type,
        parsed.amount,
        parsed.transaction_date,
        parsed.merchant,
        parsed.merchant,
        `Recorded via Telegram: ${rawText.slice(0, 100)}`,
      ]
    );

    const isExpense = parsed.transaction_type === "EXPENSE";
    const amtFormatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: userCurrency }).format(parsed.amount);

    let budgetNotice = "";
    if (isExpense) {
      try {
        const alerts = await checkBudgetAlert(userId, categoryId, parsed.amount);
        if (alerts && alerts.length > 0) {
          const lines = alerts.map((a) => {
            if (a.type === "EXCEEDED" || a.type === "OVERALL_EXCEEDED") {
              return `🚨 *Budget Exceeded!* You've reached *${a.percentage}%* of your *${a.category || "Overall"}* limit.`;
            } else {
              return `⚠️ *Budget Notice:* You've reached *${a.percentage}%* of your *${a.category || "Overall"}* limit.`;
            }
          });
          budgetNotice = "\n\n" + lines.join("\n");
        }
      } catch (alertErr) {
        // Non-blocking
      }
    }

    await sendTelegramMessage(
      chatId,
      `✅ *Transaction Logged Successfully!*\n\n` +
      `💸 *Amount:* ${amtFormatted} (${isExpense ? "Expense" : "Income"})\n` +
      `🏪 *Payee:* ${parsed.merchant}\n` +
      `🏷️ *Category:* ${categoryName}\n` +
      `🏦 *Account:* ${accountName}\n` +
      `📅 *Date:* ${parsed.transaction_date}` +
      budgetNotice
    );
  }
}

module.exports = {
  getBotInfo,
  sendTelegramMessage,
  setTelegramWebhook,
  generateLinkCode,
  verifyAndLinkTelegram,
  getTelegramStatus,
  unlinkTelegram,
  parseTransactionText,
  processTelegramUpdate,
};
