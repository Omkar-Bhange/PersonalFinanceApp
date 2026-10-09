
const pool = require("../config/database");

async function getTransactions(userId, filters = {}) {
  const conditions = ["user_id = $1"];
  const values = [userId];

  if (filters.transaction_type) {
    values.push(filters.transaction_type);
    conditions.push(`transaction_type = $${values.length}`);
  }

  if (filters.from) {
    values.push(filters.from);
    conditions.push(`transaction_date >= $${values.length}`);
  }

  if (filters.to) {
    values.push(filters.to);
    conditions.push(`transaction_date <= $${values.length}`);
  }

  values.push(filters.limit || 50);
  const limitPosition = values.length;

  const result = await pool.query(
    `SELECT id, account_id, category_id, transaction_type,
            amount, transaction_date, description, merchant,
            notes, created_at
     FROM transactions
     WHERE ${conditions.join(" AND ")}
     ORDER BY transaction_date DESC, id DESC
     LIMIT $${limitPosition}`,
    values
  );

  return result.rows;
}

async function createTransaction(userId, data) {
  if (data.category_id !== undefined && data.category_id !== null) {
    const categoryCheck = await pool.query(
      `SELECT id
       FROM categories
       WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [data.category_id, userId]
    );

    if (categoryCheck.rowCount === 0) {
      const error = new Error("Account or category does not exist or is not accessible");
      error.statusCode = 400;
      error.code = "INVALID_CATEGORY";
      throw error;
    }
  }

  const result = await pool.query(
    `INSERT INTO transactions
       (user_id, account_id, category_id, transaction_type,
        amount, transaction_date, description, merchant, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, account_id, category_id, transaction_type,
               amount, transaction_date, description, merchant,
               notes, created_at`,
    [
      userId,
      data.account_id,
      data.category_id ?? null,
      data.transaction_type,
      data.amount,
      data.transaction_date,
      data.description ?? null,
      data.merchant ?? null,
      data.notes ?? null,
    ]
  );

  return result.rows[0];
}

async function updateTransaction(userId, transactionId, data) {
  // 1. Verify account ownership
  const accountCheck = await pool.query(
    `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
    [data.account_id, userId]
  );

  if (accountCheck.rowCount === 0) {
    const error = new Error("Account or category does not exist or is not accessible");
    error.statusCode = 400;
    error.code = "INVALID_ACCOUNT";
    throw error;
  }

  // 2. Verify category ownership if provided and not null
  if (data.category_id !== undefined && data.category_id !== null) {
    const categoryCheck = await pool.query(
      `SELECT id
       FROM categories
       WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [data.category_id, userId]
    );

    if (categoryCheck.rowCount === 0) {
      const error = new Error("Account or category does not exist or is not accessible");
      error.statusCode = 400;
      error.code = "INVALID_CATEGORY";
      throw error;
    }
  }

  // 3. Update the transaction scoped to user_id and id
  const result = await pool.query(
    `UPDATE transactions
     SET account_id = $1,
         category_id = $2,
         transaction_type = $3,
         amount = $4,
         transaction_date = $5,
         description = $6,
         merchant = $7,
         notes = $8,
         updated_at = NOW()
     WHERE id = $9 AND user_id = $10
     RETURNING id, account_id, category_id, transaction_type,
               amount, transaction_date, description, merchant,
               notes, created_at, updated_at`,
    [
      data.account_id,
      data.category_id ?? null,
      data.transaction_type,
      data.amount,
      data.transaction_date,
      data.description ?? null,
      data.merchant ?? null,
      data.notes ?? null,
      transactionId,
      userId,
    ]
  );

  return result.rows[0] || null;
}

async function deleteTransaction(userId, transactionId) {
  const result = await pool.query(
    `DELETE FROM transactions
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [transactionId, userId]
  );

  return result.rowCount > 0;
}

function getMonthDateRange(monthStr) {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthStartDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const previousMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  return {
    month: monthStr,
    startDate,
    nextMonthStartDate,
    previousMonth: previousMonthStr,
    prevMonthStartDate,
  };
}

function calculatePercentageChange(currentStr, previousStr) {
  const current = Number(currentStr);
  const previous = Number(previousStr);

  if (previous === 0) {
    if (current === 0) {
      return 0;
    }
    // Mathematically undefined when the baseline (previous) is 0
    return null;
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number(change.toFixed(2));
}

async function getMonthlySummary(userId, monthStr) {
  const {
    month,
    startDate,
    nextMonthStartDate,
    previousMonth,
    prevMonthStartDate,
  } = getMonthDateRange(monthStr);

  // 1. Query totals for selected month and previous month
  const totalsResult = await pool.query(
    `SELECT
       COALESCE(
         SUM(CASE WHEN transaction_date >= $2 AND transaction_date < $3 AND transaction_type = 'INCOME' THEN amount ELSE 0 END),
         0
       )::NUMERIC(14,2) AS current_income,
       COALESCE(
         SUM(CASE WHEN transaction_date >= $2 AND transaction_date < $3 AND transaction_type = 'EXPENSE' THEN amount ELSE 0 END),
         0
       )::NUMERIC(14,2) AS current_expenses,
       COALESCE(
         SUM(CASE WHEN transaction_date >= $2 AND transaction_date < $3 THEN (CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) ELSE 0 END),
         0
       )::NUMERIC(14,2) AS current_net_savings,
       COALESCE(
         SUM(CASE WHEN transaction_date >= $4 AND transaction_date < $2 AND transaction_type = 'INCOME' THEN amount ELSE 0 END),
         0
       )::NUMERIC(14,2) AS prev_income,
       COALESCE(
         SUM(CASE WHEN transaction_date >= $4 AND transaction_date < $2 AND transaction_type = 'EXPENSE' THEN amount ELSE 0 END),
         0
       )::NUMERIC(14,2) AS prev_expenses,
       COALESCE(
         SUM(CASE WHEN transaction_date >= $4 AND transaction_date < $2 THEN (CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) ELSE 0 END),
         0
       )::NUMERIC(14,2) AS prev_net_savings
     FROM transactions
     WHERE user_id = $1
       AND transaction_date >= $4
       AND transaction_date < $3`,
    [userId, startDate, nextMonthStartDate, prevMonthStartDate]
  );

  const totals = totalsResult.rows[0];

  const totalIncome = totals.current_income;
  const totalExpenses = totals.current_expenses;
  const netSavings = totals.current_net_savings;

  const prevIncome = totals.prev_income;
  const prevExpenses = totals.prev_expenses;
  const prevNetSavings = totals.prev_net_savings;

  // 2. Query category breakdown for the selected month
  const categoryResult = await pool.query(
    `SELECT
       t.transaction_type,
       t.category_id,
       COALESCE(c.name, 'Uncategorized') AS category_name,
       SUM(t.amount)::NUMERIC(14,2) AS total_amount,
       COUNT(t.id)::INT AS transaction_count
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1
       AND t.transaction_date >= $2
       AND t.transaction_date < $3
     GROUP BY t.transaction_type, t.category_id, c.name
     ORDER BY total_amount DESC`,
    [userId, startDate, nextMonthStartDate]
  );

  const incomeByCategory = [];
  const expensesByCategory = [];

  const numTotalIncome = Number(totalIncome);
  const numTotalExpenses = Number(totalExpenses);

  for (const row of categoryResult.rows) {
    const amountNum = Number(row.total_amount);
    if (row.transaction_type === "INCOME") {
      const percentage =
        numTotalIncome > 0
          ? Number(((amountNum / numTotalIncome) * 100).toFixed(2))
          : 0;
      incomeByCategory.push({
        category_id: row.category_id ? Number(row.category_id) : null,
        category_name: row.category_name,
        total_amount: row.total_amount,
        transaction_count: row.transaction_count,
        percentage_of_total: percentage,
      });
    } else if (row.transaction_type === "EXPENSE") {
      const percentage =
        numTotalExpenses > 0
          ? Number(((amountNum / numTotalExpenses) * 100).toFixed(2))
          : 0;
      expensesByCategory.push({
        category_id: row.category_id ? Number(row.category_id) : null,
        category_name: row.category_name,
        total_amount: row.total_amount,
        transaction_count: row.transaction_count,
        percentage_of_total: percentage,
      });
    }
  }

  return {
    month,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_savings: netSavings,
    previous_month: {
      month: previousMonth,
      total_income: prevIncome,
      total_expenses: prevExpenses,
      net_savings: prevNetSavings,
    },
    percentage_change: {
      income: calculatePercentageChange(totalIncome, prevIncome),
      expenses: calculatePercentageChange(totalExpenses, prevExpenses),
      net_savings: calculatePercentageChange(netSavings, prevNetSavings),
    },
    income_by_category: incomeByCategory,
    expenses_by_category: expensesByCategory,
  };
}

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
};

