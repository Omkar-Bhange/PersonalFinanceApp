
const pool = require("../config/database");

async function getAccounts(userId) {
  const result = await pool.query(
    `SELECT
       a.id,
       a.name,
       a.account_type,
       a.opening_balance,
       COALESCE(t.total_income, 0)::NUMERIC(14,2) AS total_income,
       COALESCE(t.total_expenses, 0)::NUMERIC(14,2) AS total_expenses,
       (
         a.opening_balance
         + COALESCE(t.net_transactions, 0)
         + COALESCE(l.net_lending_principal, 0)
         + COALESCE(r.net_repayments, 0)
       )::NUMERIC(14,2) AS current_balance,
       a.is_active,
       a.created_at
     FROM accounts a
     LEFT JOIN (
       SELECT
         account_id,
         SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) AS total_income,
         SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expenses,
         SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) AS net_transactions
       FROM transactions
       WHERE user_id = $1
       GROUP BY account_id
     ) t ON a.id = t.account_id
     LEFT JOIN (
       SELECT
         account_id,
         SUM(CASE WHEN direction = 'BORROWED' THEN principal_amount ELSE -principal_amount END) AS net_lending_principal
       FROM lending_records
       WHERE user_id = $1
       GROUP BY account_id
     ) l ON a.id = l.account_id
     LEFT JOIN (
       SELECT
         r.account_id,
         SUM(CASE WHEN lr.direction = 'LENT' THEN r.amount ELSE -r.amount END) AS net_repayments
       FROM repayments r
       JOIN lending_records lr ON r.lending_id = lr.id
       WHERE r.user_id = $1
       GROUP BY r.account_id
     ) r ON a.id = r.account_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function getAccountById(userId, accountId) {
  const result = await pool.query(
    `SELECT
       a.id,
       a.name,
       a.account_type,
       a.opening_balance,
       COALESCE(t.total_income, 0)::NUMERIC(14,2) AS total_income,
       COALESCE(t.total_expenses, 0)::NUMERIC(14,2) AS total_expenses,
       (
         a.opening_balance
         + COALESCE(t.net_transactions, 0)
         + COALESCE(l.net_lending_principal, 0)
         + COALESCE(r.net_repayments, 0)
       )::NUMERIC(14,2) AS current_balance,
       a.is_active,
       a.created_at,
       a.updated_at
     FROM accounts a
     LEFT JOIN (
       SELECT
         account_id,
         SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) AS total_income,
         SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expenses,
         SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) AS net_transactions
       FROM transactions
       WHERE user_id = $1
       GROUP BY account_id
     ) t ON a.id = t.account_id
     LEFT JOIN (
       SELECT
         account_id,
         SUM(CASE WHEN direction = 'BORROWED' THEN principal_amount ELSE -principal_amount END) AS net_lending_principal
       FROM lending_records
       WHERE user_id = $1
       GROUP BY account_id
     ) l ON a.id = l.account_id
     LEFT JOIN (
       SELECT
         r.account_id,
         SUM(CASE WHEN lr.direction = 'LENT' THEN r.amount ELSE -r.amount END) AS net_repayments
       FROM repayments r
       JOIN lending_records lr ON r.lending_id = lr.id
       WHERE r.user_id = $1
       GROUP BY r.account_id
     ) r ON a.id = r.account_id
     WHERE a.user_id = $1 AND a.id = $2`,
    [userId, accountId]
  );

  return result.rows[0] || null;
}

async function createAccount(userId, data) {
  const result = await pool.query(
    `INSERT INTO accounts
       (user_id, name, account_type, opening_balance)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, account_type, opening_balance,
               is_active, created_at`,
    [
      userId,
      data.name,
      data.account_type,
      data.opening_balance,
    ]
  );

  const row = result.rows[0];

  return {
    ...row,
    total_income: "0.00",
    total_expenses: "0.00",
    current_balance: Number(row.opening_balance).toFixed(2),
  };
}

async function updateAccount(userId, accountId, data) {
  const updateRes = await pool.query(
    `UPDATE accounts
     SET name = $1,
         account_type = $2,
         updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id`,
    [data.name, data.account_type, accountId, userId]
  );

  if (updateRes.rowCount === 0) {
    return null;
  }

  return getAccountById(userId, accountId);
}

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
};

