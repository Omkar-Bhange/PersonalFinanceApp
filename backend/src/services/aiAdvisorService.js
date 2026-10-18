const pool = require("../config/database");
const { callGemini } = require("./aiService");
const { getMonthlyBudgets, getCurrentMonthString } = require("./budgetService");

/**
 * Gathers user financial history across past 90-180 days
 */
async function gatherUserFinancialData(userId) {
  const currentMonth = getCurrentMonthString();

  // 1. Account balances
  const accountsRes = await pool.query(
    `SELECT id, name, account_type, opening_balance FROM accounts WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  // Compute live balance per account
  const accountBalances = [];
  let totalNetWorth = 0;

  for (const acc of accountsRes.rows) {
    const txSum = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS total_expense
       FROM transactions
       WHERE user_id = $1 AND account_id = $2`,
      [userId, acc.id]
    );

    const inc = parseFloat(txSum.rows[0].total_income) || 0;
    const exp = parseFloat(txSum.rows[0].total_expense) || 0;
    const currentBal = (parseFloat(acc.opening_balance) || 0) + inc - exp;
    totalNetWorth += currentBal;

    accountBalances.push({
      name: acc.name,
      type: acc.account_type,
      current_balance: Number(currentBal.toFixed(2)),
    });
  }

  // 2. Monthly aggregates (last 6 months)
  const monthlyRes = await pool.query(
    `SELECT 
       TO_CHAR(transaction_date, 'YYYY-MM') AS month,
       COALESCE(SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense,
       COUNT(*) AS tx_count
     FROM transactions
     WHERE user_id = $1 AND transaction_date >= CURRENT_DATE - INTERVAL '180 days'
     GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
     ORDER BY month DESC`,
    [userId]
  );

  // 3. Category spending breakdown (last 90 days)
  const categoryRes = await pool.query(
    `SELECT 
       COALESCE(c.name, 'Uncategorized') AS category_name,
       c.color,
       SUM(t.amount) AS total_amount,
       COUNT(t.id) AS tx_count,
       ROUND(AVG(t.amount), 2) AS avg_per_tx
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1 
       AND t.transaction_type = 'EXPENSE'
       AND t.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
     GROUP BY c.name, c.color
     ORDER BY total_amount DESC`,
    [userId]
  );

  // 4. Top merchants (last 90 days)
  const merchantRes = await pool.query(
    `SELECT 
       COALESCE(merchant, description, 'Unknown') AS merchant_name,
       SUM(amount) AS total_spent,
       COUNT(*) AS frequency
     FROM transactions
     WHERE user_id = $1 
       AND transaction_type = 'EXPENSE'
       AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'
       AND (merchant IS NOT NULL OR description IS NOT NULL)
     GROUP BY COALESCE(merchant, description, 'Unknown')
     ORDER BY total_spent DESC
     LIMIT 10`,
    [userId]
  );

  // 5. Current month budget data
  const currentBudgets = await getMonthlyBudgets(userId, currentMonth);

  // Calculate averages
  const pastMonths = monthlyRes.rows.filter((r) => r.month !== currentMonth);
  const avgIncome = pastMonths.length
    ? pastMonths.reduce((s, m) => s + parseFloat(m.income), 0) / pastMonths.length
    : parseFloat(monthlyRes.rows[0]?.income || 0);

  const avgExpense = pastMonths.length
    ? pastMonths.reduce((s, m) => s + parseFloat(m.expense), 0) / pastMonths.length
    : parseFloat(monthlyRes.rows[0]?.expense || 0);

  const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0;

  return {
    accounts: accountBalances,
    total_liquid_net_worth: Number(totalNetWorth.toFixed(2)),
    monthly_history: monthlyRes.rows.map((r) => ({
      month: r.month,
      income: Number(parseFloat(r.income).toFixed(2)),
      expense: Number(parseFloat(r.expense).toFixed(2)),
      net_savings: Number((parseFloat(r.income) - parseFloat(r.expense)).toFixed(2)),
      tx_count: parseInt(r.tx_count, 10),
    })),
    categories: categoryRes.rows.map((c) => ({
      name: c.category_name,
      total_amount: Number(parseFloat(c.total_amount).toFixed(2)),
      tx_count: parseInt(c.tx_count, 10),
      avg_per_tx: Number(parseFloat(c.avg_per_tx).toFixed(2)),
    })),
    top_merchants: merchantRes.rows.map((m) => ({
      name: m.merchant_name,
      total_spent: Number(parseFloat(m.total_spent).toFixed(2)),
      frequency: parseInt(m.frequency, 10),
    })),
    current_budgets: currentBudgets,
    metrics: {
      avg_monthly_income: Number(avgIncome.toFixed(2)),
      avg_monthly_expense: Number(avgExpense.toFixed(2)),
      historical_savings_rate: Number(savingsRate.toFixed(1)),
    },
  };
}

/**
 * Deterministic fallback insights in case Gemini is unavailable or rate-limited
 */
function buildDeterministicInsights(financialData) {
  const { metrics, categories, top_merchants, current_budgets, total_liquid_net_worth } = financialData;

  const totalCatSpend = categories.reduce((sum, c) => sum + c.total_amount, 0);
  const topDrivers = categories.slice(0, 4).map((c) => {
    const pct = totalCatSpend > 0 ? Math.round((c.total_amount / totalCatSpend) * 100) : 0;
    return {
      category: c.name,
      monthly_avg: Number((c.total_amount / 3).toFixed(2)),
      percentage: pct,
      insight: `${c.name} accounts for ${pct}% of recent spending across ${c.tx_count} transactions.`,
    };
  });

  const savingsOps = [];
  if (topDrivers.length > 0) {
    const highest = topDrivers[0];
    const cut10 = Math.round(highest.monthly_avg * 0.1);
    savingsOps.push({
      title: `Optimize ${highest.category} Spending`,
      potential_monthly_savings: cut10,
      difficulty: "Moderate",
      recommendation: `Trimming just 10% from ${highest.category} could save ₹${cut10.toLocaleString("en-IN")} each month.`,
    });
  }

  if (top_merchants.length > 0) {
    const topM = top_merchants[0];
    savingsOps.push({
      title: `Frequent Outflow to ${topM.name}`,
      potential_monthly_savings: Math.round(topM.total_spent * 0.15 / 3),
      difficulty: "Easy",
      recommendation: `You transacted ${topM.frequency} times with ${topM.name}. Consolidating or setting a weekly budget will keep expenses disciplined.`,
    });
  }

  // Calculate health score (0 to 100)
  let score = 50;
  if (metrics.historical_savings_rate >= 30) score += 30;
  else if (metrics.historical_savings_rate >= 15) score += 20;
  else if (metrics.historical_savings_rate >= 5) score += 10;
  else if (metrics.historical_savings_rate < 0) score -= 20;

  if (current_budgets.summary?.percentage <= 85) score += 15;
  else if (current_budgets.summary?.percentage > 100) score -= 15;

  if (total_liquid_net_worth > metrics.avg_monthly_expense * 3) score += 10;

  score = Math.max(15, Math.min(95, score));

  let healthStatus = "Fair";
  if (score >= 80) healthStatus = "Excellent";
  else if (score >= 65) healthStatus = "Good";
  else if (score < 45) healthStatus = "Needs Attention";

  const budgetRecs = topDrivers.map((d) => ({
    category_name: d.category,
    current_spend: d.monthly_avg,
    recommended_limit: Math.ceil((d.monthly_avg * 0.95) / 100) * 100,
    rationale: `Targeting a 5% optimization against your 3-month average of ₹${d.monthly_avg.toLocaleString("en-IN")}.`,
  }));

  return {
    summary_headline: `Your financial trajectory is ${healthStatus.toLowerCase()} with a ${metrics.historical_savings_rate}% savings rate.`,
    financial_health_score: score,
    health_status: healthStatus,
    monthly_run_rate: {
      projected_month_end_expense: current_budgets.summary?.projected_spend || metrics.avg_monthly_expense,
      projected_savings_rate: metrics.historical_savings_rate,
      days_remaining_in_month: current_budgets.calendar?.days_remaining || 0,
    },
    top_expense_drivers: topDrivers,
    savings_opportunities: savingsOps,
    budget_recommendations: budgetRecs,
    actionable_tips: [
      `Maintain an emergency buffer covering at least 3-6 months of essential living expenses (approx ₹${(metrics.avg_monthly_expense * 3).toLocaleString("en-IN")}).`,
      `Track discretionary dining and shopping on weekends to avoid month-end budget slippage.`,
      `Review recurring subscriptions and automated UPI payments quarterly.`,
    ],
    historical_metrics: {
      avg_monthly_income: metrics.avg_monthly_income,
      avg_monthly_expense: metrics.avg_monthly_expense,
      savings_rate: metrics.historical_savings_rate,
      liquid_net_worth: total_liquid_net_worth,
      top_merchants: top_merchants.slice(0, 5),
    },
  };
}

/**
 * Generate comprehensive AI Advisor Insights using Gemini with historical data
 */
async function generateFinancialInsights(userId) {
  const financialData = await gatherUserFinancialData(userId);

  // If no transactions exist, return clean empty starter insights
  if (financialData.monthly_history.length === 0 && financialData.categories.length === 0) {
    return {
      summary_headline: "Welcome to your AI Financial Advisor!",
      financial_health_score: 50,
      health_status: "Neutral",
      monthly_run_rate: {
        projected_month_end_expense: 0,
        projected_savings_rate: 0,
        days_remaining_in_month: 0,
      },
      top_expense_drivers: [],
      savings_opportunities: [],
      budget_recommendations: [],
      actionable_tips: [
        "Upload bank statements or log expenses via the Telegram Bot to get personalized insights.",
        "Set your first monthly category budget to stay on track.",
      ],
      historical_metrics: {
        avg_monthly_income: 0,
        avg_monthly_expense: 0,
        savings_rate: 0,
        liquid_net_worth: financialData.total_liquid_net_worth,
        top_merchants: [],
      },
    };
  }

  const prompt = `
Analyze this user's personal financial profile based on historical transaction data and current budgets:

=== FINANCIAL OVERVIEW ===
- Liquid Net Worth (Bank/Cash Balances): ₹${financialData.total_liquid_net_worth.toLocaleString("en-IN")}
- Average Monthly Income: ₹${financialData.metrics.avg_monthly_income.toLocaleString("en-IN")}
- Average Monthly Expense: ₹${financialData.metrics.avg_monthly_expense.toLocaleString("en-IN")}
- Historical Savings Rate: ${financialData.metrics.historical_savings_rate}%

=== MONTHLY TRENDS (Last 6 Months) ===
${JSON.stringify(financialData.monthly_history, null, 2)}

=== TOP EXPENSE CATEGORIES (Last 90 Days) ===
${JSON.stringify(financialData.categories.slice(0, 8), null, 2)}

=== FREQUENT MERCHANTS / PAYEES ===
${JSON.stringify(financialData.top_merchants.slice(0, 8), null, 2)}

=== CURRENT MONTH BUDGET TRACKING ===
- Month: ${financialData.current_budgets.month}
- Budget Limit: ₹${financialData.current_budgets.summary?.total_limit || 0}
- Spent So Far: ₹${financialData.current_budgets.summary?.total_spent || 0}
- Projected Month-End Spending: ₹${financialData.current_budgets.summary?.projected_spend || 0}
- Category Budgets: ${JSON.stringify(
    financialData.current_budgets.category_budgets.map((b) => ({
      category: b.category_name,
      limit: b.amount_limit,
      spent: b.spent,
      status: b.status,
    })),
    null,
    2
  )}

TASK:
Provide professional, mathematically sound, empathetic financial advisor insights formatted as a JSON object matching this exact schema:
{
  "summary_headline": "Short punchy executive headline on user's current financial trajectory",
  "financial_health_score": <number between 1 and 100>,
  "health_status": "Excellent" | "Good" | "Fair" | "Needs Attention",
  "monthly_run_rate": {
    "projected_month_end_expense": <number>,
    "projected_savings_rate": <number percentage>,
    "burn_rate_comment": "<string explaining daily burn rate and if month-end will be safe>"
  },
  "top_expense_drivers": [
    {
      "category": "<Category Name>",
      "monthly_avg": <number>,
      "percentage": <percentage of total spend>,
      "insight": "<Specific observation regarding patterns, frequency, or spikes>"
    }
  ],
  "savings_opportunities": [
    {
      "title": "<Concise strategy>",
      "potential_monthly_savings": <number in INR>,
      "difficulty": "Easy" | "Moderate" | "Challenging",
      "recommendation": "<Specific tactical advice on what to substitute, cap, or eliminate>"
    }
  ],
  "budget_recommendations": [
    {
      "category_name": "<Category>",
      "current_spend": <number>,
      "recommended_limit": <number>,
      "rationale": "<Reason based on historical baseline>"
    }
  ],
  "actionable_tips": [
    "<3 to 4 actionable, highly personalized bullet points>"
  ]
}
`;

  try {
    const aiResult = await callGemini(
      [{ text: prompt }],
      "You are an elite certified financial planner and behavioral economist providing hyper-personalized, data-driven budgeting advice in Indian Rupees (INR). Always return valid JSON."
    );

    // Merge deterministic metrics with AI insights for completeness
    return {
      ...aiResult,
      historical_metrics: {
        avg_monthly_income: financialData.metrics.avg_monthly_income,
        avg_monthly_expense: financialData.metrics.avg_monthly_expense,
        savings_rate: financialData.metrics.historical_savings_rate,
        liquid_net_worth: financialData.total_liquid_net_worth,
        top_merchants: financialData.top_merchants.slice(0, 5),
      },
    };
  } catch (err) {
    console.warn("[AIAdvisor] Gemini call failed, using deterministic insights:", err.message);
    return buildDeterministicInsights(financialData);
  }
}

/**
 * Interactive Q&A with AI Financial Advisor
 */
async function askAdvisor(userId, question, chatHistory = []) {
  if (!question || !question.trim()) {
    const error = new Error("Question is required.");
    error.statusCode = 400;
    throw error;
  }

  const financialData = await gatherUserFinancialData(userId);

  const contextPrompt = `
You are the user's dedicated AI Financial Advisor inside their Personal Finance app.
The user is asking: "${question.trim()}"

=== USER'S LIVE FINANCIAL PROFILE ===
- Liquid Bank & Cash Balances: ₹${financialData.total_liquid_net_worth.toLocaleString("en-IN")}
- Average Monthly Income: ₹${financialData.metrics.avg_monthly_income.toLocaleString("en-IN")}
- Average Monthly Expense: ₹${financialData.metrics.avg_monthly_expense.toLocaleString("en-IN")}
- Savings Rate: ${financialData.metrics.historical_savings_rate}%
- Current Month Budget Limit: ₹${financialData.current_budgets.summary?.total_limit || 0}
- Current Month Spent: ₹${financialData.current_budgets.summary?.total_spent || 0}
- Current Month Projected: ₹${financialData.current_budgets.summary?.projected_spend || 0}
- Top Categories: ${financialData.categories.slice(0, 5).map((c) => `${c.name} (₹${c.total_amount})`).join(", ")}
- Top Merchants: ${financialData.top_merchants.slice(0, 5).map((m) => `${m.name} (₹${m.total_spent})`).join(", ")}

=== RECENT CHAT HISTORY ===
${chatHistory.slice(-4).map((m) => `${m.role === "user" ? "User" : "Advisor"}: ${m.content}`).join("\n")}

Respond to the user with actionable, data-backed financial guidance.
If they ask whether they can afford something (e.g., a phone, a trip, an appliance):
- Calculate the impact on their current liquid net worth and monthly cash flow.
- Offer a safe roadmap (e.g., pay in full vs save ₹X over Y months).
- Keep the tone encouraging, realistic, and clear. Format key numbers with ₹.

Return a JSON object conforming strictly to:
{
  "answer": "Your comprehensive answer formatted with clean Markdown bullet points and bold highlights",
  "key_takeaway": "Single sentence summary or bottom-line verdict",
  "suggested_followups": ["Question 1", "Question 2", "Question 3"]
}
`;

  try {
    const response = await callGemini(
      [{ text: contextPrompt }],
      "You are an empathetic, disciplined AI Financial Advisor. Provide clear, direct financial analysis with Rupee figures and practical milestones. Always return valid JSON."
    );

    return response;
  } catch (err) {
    console.warn("[AIAdvisor] Q&A Gemini call failed, returning fallback:", err.message);
    return {
      answer: `Based on your average monthly income of **₹${financialData.metrics.avg_monthly_income.toLocaleString("en-IN")}** and current monthly spending of **₹${financialData.metrics.avg_monthly_expense.toLocaleString("en-IN")}**, your monthly net surplus is approximately **₹${(financialData.metrics.avg_monthly_income - financialData.metrics.avg_monthly_expense).toLocaleString("en-IN")}**.\n\nTo ensure your emergency cushion remains intact, aim to keep discretionary purchases within your monthly surplus rather than dipping into liquid reserves.`,
      key_takeaway: `Your current monthly surplus is ₹${(financialData.metrics.avg_monthly_income - financialData.metrics.avg_monthly_expense).toLocaleString("en-IN")}.`,
      suggested_followups: [
        "How can I save ₹5,000 more this month?",
        "What are my highest expense categories?",
        "Am I on track to meet my budget this month?",
      ],
    };
  }
}

module.exports = {
  gatherUserFinancialData,
  generateFinancialInsights,
  askAdvisor,
};
