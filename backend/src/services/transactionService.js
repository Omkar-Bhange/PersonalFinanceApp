
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

async function createBulkTransactions(userId, { account_id, account_name, transactions, sync_closing_balance }) {
  if (!transactions || !transactions.length) {
    return [];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let targetAccountId = account_id ? Number(account_id) : null;

    // 1. If account_id provided, verify ownership
    if (targetAccountId) {
      const accountCheck = await client.query(
        `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
        [targetAccountId, userId]
      );

      if (accountCheck.rowCount === 0) {
        const error = new Error("Account does not exist or is not accessible");
        error.statusCode = 400;
        error.code = "INVALID_ACCOUNT";
        throw error;
      }
    } else if (account_name && typeof account_name === "string" && account_name.trim()) {
      // Find or auto-create account
      const cleanAccName = account_name.trim();
      const existingAcc = await client.query(
        `SELECT id FROM accounts WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER($2) LIMIT 1`,
        [userId, cleanAccName]
      );

      if (existingAcc.rowCount > 0) {
        targetAccountId = existingAcc.rows[0].id;
      } else {
        const newAcc = await client.query(
          `INSERT INTO accounts (user_id, name, account_type, opening_balance)
           VALUES ($1, $2, 'SAVINGS', 0)
           RETURNING id`,
          [userId, cleanAccName]
        );
        targetAccountId = newAcc.rows[0].id;
      }
    } else {
      const error = new Error("Please provide a target account_id or account_name");
      error.statusCode = 400;
      throw error;
    }

    // Cache of category name -> id to avoid redundant queries during bulk insert
    const categoryCache = new Map();

    const inserted = [];

    for (const tx of transactions) {
      let validCategoryId = null;

      if (tx.category_id && Number(tx.category_id) > 0) {
        const catCheck = await client.query(
          `SELECT id FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
          [tx.category_id, userId]
        );
        if (catCheck.rowCount > 0) {
          validCategoryId = tx.category_id;
        }
      }

      // If category_id not resolved, check or auto-create via category_name
      if (!validCategoryId && tx.category_name && typeof tx.category_name === "string" && tx.category_name.trim()) {
        const cleanCatName = tx.category_name.trim();
        const cacheKey = `${cleanCatName.toLowerCase()}_${tx.transaction_type || "EXPENSE"}`;

        if (categoryCache.has(cacheKey)) {
          validCategoryId = categoryCache.get(cacheKey);
        } else {
          const catCheck = await client.query(
            `SELECT id FROM categories
             WHERE (user_id IS NULL OR user_id = $1)
               AND LOWER(TRIM(name)) = LOWER($2)
             LIMIT 1`,
            [userId, cleanCatName]
          );

          if (catCheck.rowCount > 0) {
            validCategoryId = catCheck.rows[0].id;
          } else {
            // Auto-create category for user
            const catColor = (tx.transaction_type === "INCOME") ? "#10b981" : "#0284c7";
            const newCat = await client.query(
              `INSERT INTO categories (user_id, name, category_type, icon, color)
               VALUES ($1, $2, $3, 'tag', $4)
               RETURNING id`,
              [userId, cleanCatName, tx.transaction_type || "EXPENSE", catColor]
            );
            validCategoryId = newCat.rows[0].id;
          }

          categoryCache.set(cacheKey, validCategoryId);
        }
      }

      const res = await client.query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, transaction_type,
            amount, transaction_date, description, merchant, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, account_id, category_id, transaction_type,
                   amount, transaction_date, description, merchant,
                   notes, created_at`,
        [
          userId,
          targetAccountId,
          validCategoryId,
          tx.transaction_type || "EXPENSE",
          tx.amount,
          tx.transaction_date || new Date().toISOString().slice(0, 10),
          tx.description ?? tx.raw_narration ?? null,
          tx.merchant ?? null,
          tx.notes ?? null,
        ]
      );

      inserted.push(res.rows[0]);
    }

    // If sync_closing_balance is provided, adjust account opening_balance so current_balance equals statement closing balance
    if (sync_closing_balance !== undefined && sync_closing_balance !== null && !isNaN(Number(sync_closing_balance))) {
      const targetClosingBalance = Number(sync_closing_balance);

      const balQuery = await client.query(
        `SELECT
           COALESCE(t.net_transactions, 0) AS net_transactions,
           COALESCE(l.net_lending_principal, 0) AS net_lending,
           COALESCE(r.net_repayments, 0) AS net_repayments
         FROM (
           SELECT SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) AS net_transactions
           FROM transactions
           WHERE account_id = $1 AND user_id = $2
         ) t
         CROSS JOIN (
           SELECT SUM(CASE WHEN direction = 'BORROWED' THEN principal_amount ELSE -principal_amount END) AS net_lending_principal
           FROM lending_records
           WHERE account_id = $1 AND user_id = $2
         ) l
         CROSS JOIN (
           SELECT SUM(CASE WHEN lr.direction = 'LENT' THEN r.amount ELSE -r.amount END) AS net_repayments
           FROM repayments r
           JOIN lending_records lr ON r.lending_id = lr.id
           WHERE r.account_id = $1 AND r.user_id = $2
         ) r`,
        [targetAccountId, userId]
      );

      const netDelta =
        parseFloat(balQuery.rows[0]?.net_transactions || 0) +
        parseFloat(balQuery.rows[0]?.net_lending || 0) +
        parseFloat(balQuery.rows[0]?.net_repayments || 0);

      const neededOpeningBalance = targetClosingBalance - netDelta;

      await client.query(
        `UPDATE accounts
         SET opening_balance = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [neededOpeningBalance, targetAccountId, userId]
      );
    }

    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
  createBulkTransactions,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
};

