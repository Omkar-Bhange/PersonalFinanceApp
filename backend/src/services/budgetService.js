const pool = require("../config/database");

/**
 * Returns YYYY-MM formatted string for current date
 */
function getCurrentMonthString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get monthly budgets with current spending, percentage, run-rate projection and status
 */
async function getMonthlyBudgets(userId, month = getCurrentMonthString()) {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    month = getCurrentMonthString();
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const now = new Date();
  const currentMonthStr = getCurrentMonthString();
  const isCurrentMonth = month === currentMonthStr;
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const dayOfMonth = isCurrentMonth
    ? now.getDate()
    : month < currentMonthStr
    ? daysInMonth
    : 0;
  const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - dayOfMonth) : 0;

  // 1. Fetch budgets for the user & month
  const budgetsRes = await pool.query(
    `SELECT b.id, b.category_id, b.month, b.amount_limit, b.created_at, b.updated_at,
            c.name AS category_name, c.color AS category_color, c.icon AS category_icon, c.category_type
     FROM budgets b
     LEFT JOIN categories c ON b.category_id = c.id
     WHERE b.user_id = $1 AND b.month = $2
     ORDER BY b.category_id NULLS FIRST, c.name ASC`,
    [userId, month]
  );

  // 2. Fetch spending grouped by category for that month
  const spendingRes = await pool.query(
    `SELECT category_id, COALESCE(SUM(amount), 0) AS total_spent, COUNT(*) AS tx_count
     FROM transactions
     WHERE user_id = $1
       AND transaction_type = 'EXPENSE'
       AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
     GROUP BY category_id`,
    [userId, month]
  );

  const spendingMap = new Map();
  let totalExpenseSpent = 0;
  let totalExpenseTxCount = 0;

  for (const row of spendingRes.rows) {
    const spentVal = parseFloat(row.total_spent) || 0;
    const txCount = parseInt(row.tx_count, 10) || 0;
    if (row.category_id !== null) {
      spendingMap.set(String(row.category_id), { spent: spentVal, txCount });
    }
    totalExpenseSpent += spentVal;
    totalExpenseTxCount += txCount;
  }

  // 3. Process each configured budget
  let overallBudget = null;
  const categoryBudgets = [];
  const budgetedCategoryIds = new Set();

  for (const b of budgetsRes.rows) {
    const limit = parseFloat(b.amount_limit) || 0;
    const isOverall = b.category_id === null;

    let spent = 0;
    let txCount = 0;

    if (isOverall) {
      spent = totalExpenseSpent;
      txCount = totalExpenseTxCount;
    } else {
      budgetedCategoryIds.add(String(b.category_id));
      const catSpend = spendingMap.get(String(b.category_id));
      if (catSpend) {
        spent = catSpend.spent;
        txCount = catSpend.txCount;
      }
    }

    const remaining = limit - spent;
    const percentage = limit > 0 ? Number(((spent / limit) * 100).toFixed(1)) : 0;

    // Run-rate projected spending
    let projected = spent;
    if (isCurrentMonth && dayOfMonth > 0) {
      projected = Number(((spent / dayOfMonth) * daysInMonth).toFixed(2));
    } else if (month > currentMonthStr) {
      projected = 0;
    }
    const projectedPercentage = limit > 0 ? Number(((projected / limit) * 100).toFixed(1)) : 0;

    let status = "ON_TRACK";
    if (percentage >= 100) {
      status = "EXCEEDED";
    } else if (percentage >= 80) {
      status = "WARNING";
    }

    const item = {
      id: b.id,
      category_id: b.category_id,
      category_name: b.category_name || (isOverall ? "Overall Monthly Budget" : "Uncategorized"),
      category_color: b.category_color || "#6366f1",
      category_icon: b.category_icon || (isOverall ? "wallet" : "tag"),
      month: b.month,
      amount_limit: limit,
      spent: Number(spent.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      percentage,
      projected_spend: projected,
      projected_percentage: projectedPercentage,
      status,
      transaction_count: txCount,
      updated_at: b.updated_at,
    };

    if (isOverall) {
      overallBudget = item;
    } else {
      categoryBudgets.push(item);
    }
  }

  // 4. Find categories with expenses that do not have a budget configured for this month
  const unbudgetedCategories = [];
  if (spendingRes.rows.length > 0) {
    const unbudgetedCatIds = spendingRes.rows
      .filter((r) => r.category_id && !budgetedCategoryIds.has(String(r.category_id)))
      .map((r) => r.category_id);

    if (unbudgetedCatIds.length > 0) {
      const catDetailsRes = await pool.query(
        `SELECT id, name, color, icon FROM categories WHERE id = ANY($1::bigint[])`,
        [unbudgetedCatIds]
      );
      const catDetailsMap = new Map(catDetailsRes.rows.map((c) => [String(c.id), c]));

      for (const catId of unbudgetedCatIds) {
        const catInfo = catDetailsMap.get(String(catId));
        const spendInfo = spendingMap.get(String(catId));
        if (spendInfo && spendInfo.spent > 0) {
          unbudgetedCategories.push({
            category_id: catId,
            category_name: catInfo?.name || "Other Expense",
            category_color: catInfo?.color || "#94a3b8",
            category_icon: catInfo?.icon || "tag",
            spent: Number(spendInfo.spent.toFixed(2)),
            transaction_count: spendInfo.txCount,
          });
        }
      }
    }
  }

  // 5. Construct Overall Summary
  const sumCategoryLimits = categoryBudgets.reduce((sum, b) => sum + b.amount_limit, 0);
  const effectiveTotalLimit = overallBudget ? overallBudget.amount_limit : sumCategoryLimits;
  const effectiveRemaining = effectiveTotalLimit > 0 ? effectiveTotalLimit - totalExpenseSpent : 0;
  const effectivePercentage = effectiveTotalLimit > 0 ? Number(((totalExpenseSpent / effectiveTotalLimit) * 100).toFixed(1)) : 0;

  let totalProjected = totalExpenseSpent;
  if (isCurrentMonth && dayOfMonth > 0) {
    totalProjected = Number(((totalExpenseSpent / dayOfMonth) * daysInMonth).toFixed(2));
  } else if (month > currentMonthStr) {
    totalProjected = 0;
  }

  return {
    month,
    calendar: {
      days_in_month: daysInMonth,
      day_of_month: dayOfMonth,
      days_remaining: daysRemaining,
      is_current_month: isCurrentMonth,
    },
    overall_budget: overallBudget,
    summary: {
      total_limit: effectiveTotalLimit,
      total_spent: Number(totalExpenseSpent.toFixed(2)),
      total_remaining: Number(effectiveRemaining.toFixed(2)),
      percentage: effectivePercentage,
      projected_spend: totalProjected,
      transaction_count: totalExpenseTxCount,
      has_overall_budget: !!overallBudget,
      status: effectivePercentage >= 100 ? "EXCEEDED" : effectivePercentage >= 80 ? "WARNING" : "ON_TRACK",
    },
    category_budgets: categoryBudgets,
    unbudgeted_categories: unbudgetedCategories,
  };
}

/**
 * Upsert a budget (overall or category-specific)
 */
async function upsertBudget(userId, { category_id, month, amount_limit }) {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const error = new Error("Valid month format 'YYYY-MM' is required.");
    error.statusCode = 400;
    throw error;
  }

  const limitNum = parseFloat(amount_limit);
  if (isNaN(limitNum) || limitNum <= 0) {
    const error = new Error("Budget amount limit must be greater than 0.");
    error.statusCode = 400;
    throw error;
  }

  // If category_id provided, ensure valid category
  if (category_id !== null && category_id !== undefined && category_id !== "") {
    const catCheck = await pool.query(
      `SELECT id, name FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [category_id, userId]
    );
    if (catCheck.rowCount === 0) {
      const error = new Error("Category does not exist or is not accessible.");
      error.statusCode = 400;
      throw error;
    }

    const res = await pool.query(
      `INSERT INTO budgets (user_id, category_id, month, amount_limit, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, category_id, month) WHERE category_id IS NOT NULL
       DO UPDATE SET amount_limit = EXCLUDED.amount_limit, updated_at = NOW()
       RETURNING *`,
      [userId, category_id, month, limitNum]
    );
    return res.rows[0];
  } else {
    // Overall monthly budget (category_id is NULL)
    const res = await pool.query(
      `INSERT INTO budgets (user_id, category_id, month, amount_limit, updated_at)
       VALUES ($1, NULL, $2, $3, NOW())
       ON CONFLICT (user_id, month) WHERE category_id IS NULL
       DO UPDATE SET amount_limit = EXCLUDED.amount_limit, updated_at = NOW()
       RETURNING *`,
      [userId, month, limitNum]
    );
    return res.rows[0];
  }
}

/**
 * Delete a budget item
 */
async function deleteBudget(userId, budgetId) {
  const res = await pool.query(
    `DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING *`,
    [budgetId, userId]
  );

  if (res.rowCount === 0) {
    const error = new Error("Budget not found or unauthorized.");
    error.statusCode = 404;
    throw error;
  }

  return res.rows[0];
}

/**
 * Auto-generate budgets for a target month based on past 3 months average spending
 */
async function autoGenerateBudgets(userId, targetMonth = getCurrentMonthString()) {
  if (!targetMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
    targetMonth = getCurrentMonthString();
  }

  // Calculate past 3 calendar months before targetMonth
  const [tYear, tMonth] = targetMonth.split("-").map(Number);
  const targetDate = new Date(tYear, tMonth - 1, 1);

  const pastMonths = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(targetDate.getFullYear(), targetDate.getMonth() - i, 1);
    pastMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // First try prior 3 months
  let avgQuery = await pool.query(
    `SELECT category_id,
            SUM(amount) AS total_past_spend,
            COUNT(DISTINCT TO_CHAR(transaction_date, 'YYYY-MM')) AS months_active
     FROM transactions
     WHERE user_id = $1
       AND transaction_type = 'EXPENSE'
       AND TO_CHAR(transaction_date, 'YYYY-MM') = ANY($2::text[])
       AND category_id IS NOT NULL
     GROUP BY category_id`,
    [userId, pastMonths]
  );

  // If user is new and has no transactions in prior months, use targetMonth's data with run-rate projection
  let usingCurrentMonthOnly = false;
  if (avgQuery.rows.length === 0) {
    usingCurrentMonthOnly = true;
    avgQuery = await pool.query(
      `SELECT category_id,
              SUM(amount) AS total_past_spend,
              1 AS months_active
       FROM transactions
       WHERE user_id = $1
         AND transaction_type = 'EXPENSE'
         AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
         AND category_id IS NOT NULL
       GROUP BY category_id`,
      [userId, targetMonth]
    );
  }

  const now = new Date();
  const isCurrent = targetMonth === getCurrentMonthString();
  const daysInMonth = new Date(tYear, tMonth, 0).getDate();
  const dayOfMonth = isCurrent ? now.getDate() : daysInMonth;
  const runRateMultiplier = (usingCurrentMonthOnly && isCurrent && dayOfMonth > 0)
    ? (daysInMonth / dayOfMonth)
    : 1;

  const generated = [];
  let totalSuggestedOverall = 0;

  for (const row of avgQuery.rows) {
    const totalSpend = parseFloat(row.total_past_spend) || 0;
    const months = parseInt(row.months_active, 10) || 1;
    const monthlyAvg = (totalSpend / months) * runRateMultiplier;

    if (monthlyAvg >= 50) {
      // Suggest rounded limit with a 10% comfort buffer
      const buffered = monthlyAvg * 1.10;
      // Round to nearest 100
      const suggestedLimit = Math.ceil(buffered / 100) * 100;

      const upserted = await upsertBudget(userId, {
        category_id: row.category_id,
        month: targetMonth,
        amount_limit: suggestedLimit,
      });

      generated.push(upserted);
      totalSuggestedOverall += suggestedLimit;
    }
  }

  // Also upsert overall monthly budget if we generated category budgets
  if (totalSuggestedOverall > 0) {
    // Round overall to nearest 500
    const overallLimit = Math.ceil(totalSuggestedOverall / 500) * 500;
    await upsertBudget(userId, {
      category_id: null,
      month: targetMonth,
      amount_limit: overallLimit,
    });
  }

  return await getMonthlyBudgets(userId, targetMonth);
}

/**
 * Check if an expense transaction pushes a category or overall budget past 80% or 100%
 */
async function checkBudgetAlert(userId, categoryId, amount) {
  try {
    const currentMonth = getCurrentMonthString();
    const data = await getMonthlyBudgets(userId, currentMonth);

    const alerts = [];

    // Check category budget
    if (categoryId) {
      const catBudget = data.category_budgets.find(
        (b) => String(b.category_id) === String(categoryId)
      );
      if (catBudget) {
        if (catBudget.spent >= catBudget.amount_limit) {
          alerts.push({
            type: "EXCEEDED",
            category: catBudget.category_name,
            spent: catBudget.spent,
            limit: catBudget.amount_limit,
            percentage: catBudget.percentage,
          });
        } else if (catBudget.percentage >= 80) {
          alerts.push({
            type: "WARNING",
            category: catBudget.category_name,
            spent: catBudget.spent,
            limit: catBudget.amount_limit,
            percentage: catBudget.percentage,
          });
        }
      }
    }

    // Check overall budget
    if (data.overall_budget) {
      const ob = data.overall_budget;
      if (ob.spent >= ob.amount_limit) {
        alerts.push({
          type: "OVERALL_EXCEEDED",
          spent: ob.spent,
          limit: ob.amount_limit,
          percentage: ob.percentage,
        });
      } else if (ob.percentage >= 80) {
        alerts.push({
          type: "OVERALL_WARNING",
          spent: ob.spent,
          limit: ob.amount_limit,
          percentage: ob.percentage,
        });
      }
    }

    return alerts;
  } catch (err) {
    console.warn("[BudgetAlert] Error checking budget alerts:", err.message);
    return [];
  }
}

module.exports = {
  getCurrentMonthString,
  getMonthlyBudgets,
  upsertBudget,
  deleteBudget,
  autoGenerateBudgets,
  checkBudgetAlert,
};
