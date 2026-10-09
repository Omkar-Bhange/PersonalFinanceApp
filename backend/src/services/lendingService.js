const pool = require("../config/database");

async function getLendingRecords(userId, filters = {}) {
  const conditions = ["lr.user_id = $1"];
  const values = [userId];

  if (filters.direction) {
    values.push(filters.direction);
    conditions.push(`lr.direction = $${values.length}`);
  }

  const result = await pool.query(
    `SELECT
       lr.id,
       lr.user_id,
       lr.account_id,
       a.name AS account_name,
       lr.direction,
       lr.person_name,
       lr.phone,
       lr.principal_amount,
       COALESCE(r.total_repaid, 0)::NUMERIC(14,2) AS total_repaid,
       (lr.principal_amount - COALESCE(r.total_repaid, 0))::NUMERIC(14,2) AS outstanding_amount,
       CASE
         WHEN (lr.principal_amount - COALESCE(r.total_repaid, 0)) <= 0 THEN 'SETTLED'
         WHEN lr.due_date IS NOT NULL AND lr.due_date < CURRENT_DATE THEN 'OVERDUE'
         WHEN COALESCE(r.total_repaid, 0) > 0 THEN 'PARTIALLY_SETTLED'
         ELSE 'OPEN'
       END AS status,
       lr.start_date,
       lr.due_date,
       lr.notes,
       lr.created_at,
       lr.updated_at
     FROM lending_records lr
     JOIN accounts a ON lr.account_id = a.id AND lr.user_id = a.user_id
     LEFT JOIN (
       SELECT lending_id, SUM(amount) AS total_repaid
       FROM repayments
       WHERE user_id = $1
       GROUP BY lending_id
     ) r ON lr.id = r.lending_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY lr.start_date DESC, lr.id DESC`,
    values
  );

  return result.rows;
}

async function getLendingRecordById(userId, lendingId) {
  const recordResult = await pool.query(
    `SELECT
       lr.id,
       lr.user_id,
       lr.account_id,
       a.name AS account_name,
       lr.direction,
       lr.person_name,
       lr.phone,
       lr.principal_amount,
       COALESCE(r.total_repaid, 0)::NUMERIC(14,2) AS total_repaid,
       (lr.principal_amount - COALESCE(r.total_repaid, 0))::NUMERIC(14,2) AS outstanding_amount,
       CASE
         WHEN (lr.principal_amount - COALESCE(r.total_repaid, 0)) <= 0 THEN 'SETTLED'
         WHEN lr.due_date IS NOT NULL AND lr.due_date < CURRENT_DATE THEN 'OVERDUE'
         WHEN COALESCE(r.total_repaid, 0) > 0 THEN 'PARTIALLY_SETTLED'
         ELSE 'OPEN'
       END AS status,
       lr.start_date,
       lr.due_date,
       lr.notes,
       lr.created_at,
       lr.updated_at
     FROM lending_records lr
     JOIN accounts a ON lr.account_id = a.id AND lr.user_id = a.user_id
     LEFT JOIN (
       SELECT lending_id, SUM(amount) AS total_repaid
       FROM repayments
       WHERE user_id = $1
       GROUP BY lending_id
     ) r ON lr.id = r.lending_id
     WHERE lr.id = $2 AND lr.user_id = $1`,
    [userId, lendingId]
  );

  if (recordResult.rowCount === 0) {
    return null;
  }

  const record = recordResult.rows[0];

  // Fetch repayments history
  const repaymentsResult = await pool.query(
    `SELECT
       r.id,
       r.lending_id,
       r.account_id,
       a.name AS account_name,
       r.amount,
       r.repayment_date,
       r.notes,
       r.created_at
     FROM repayments r
     JOIN accounts a ON r.account_id = a.id AND r.user_id = a.user_id
     WHERE r.lending_id = $1 AND r.user_id = $2
     ORDER BY r.repayment_date ASC, r.id ASC`,
    [lendingId, userId]
  );

  return {
    ...record,
    repayments: repaymentsResult.rows,
  };
}

async function createLendingRecord(userId, data) {
  // Verify account ownership
  const accountCheck = await pool.query(
    `SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
    [data.account_id, userId]
  );

  if (accountCheck.rowCount === 0) {
    const error = new Error("Account does not exist, is inactive, or is not accessible");
    error.statusCode = 400;
    error.code = "INVALID_ACCOUNT";
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO lending_records
       (user_id, account_id, direction, person_name, phone,
        principal_amount, start_date, due_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      userId,
      data.account_id,
      data.direction,
      data.person_name,
      data.phone || null,
      data.principal_amount,
      data.start_date || new Date().toISOString().slice(0, 10),
      data.due_date || null,
      data.notes || null,
    ]
  );

  return getLendingRecordById(userId, result.rows[0].id);
}

async function createRepayment(userId, lendingId, data) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Lock parent lending record to guarantee concurrency protection
    const lendingRes = await client.query(
      `SELECT id, user_id, direction, principal_amount, due_date
       FROM lending_records
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [lendingId, userId]
    );

    if (lendingRes.rowCount === 0) {
      await client.query("ROLLBACK");
      const err = new Error("Lending record not found");
      err.statusCode = 404;
      throw err;
    }

    const lending = lendingRes.rows[0];

    // 2. Verify repayment account ownership
    const accountRes = await client.query(
      `SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
      [data.account_id, userId]
    );

    if (accountRes.rowCount === 0) {
      await client.query("ROLLBACK");
      const err = new Error("Account does not exist, is inactive, or is not accessible");
      err.statusCode = 400;
      err.code = "INVALID_ACCOUNT";
      throw err;
    }

    // 3. Compute current total repaid and remaining balance
    const repaidRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::NUMERIC(14,2) AS total_repaid
       FROM repayments
       WHERE lending_id = $1`,
      [lendingId]
    );

    const totalRepaid = parseFloat(repaidRes.rows[0].total_repaid);
    const principal = parseFloat(lending.principal_amount);
    const outstanding = Number((principal - totalRepaid).toFixed(2));
    const repaymentAmount = parseFloat(data.amount);

    if (repaymentAmount > outstanding) {
      await client.query("ROLLBACK");
      const err = new Error(
        `Repayment amount (${repaymentAmount.toFixed(2)}) exceeds outstanding balance of ${outstanding.toFixed(2)}`
      );
      err.statusCode = 400;
      err.code = "EXCEEDS_OUTSTANDING";
      throw err;
    }

    // 4. Insert repayment
    const insertRes = await client.query(
      `INSERT INTO repayments
         (user_id, lending_id, account_id, amount, repayment_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, lending_id, account_id, amount, repayment_date, notes, created_at`,
      [
        userId,
        lendingId,
        data.account_id,
        repaymentAmount,
        data.repayment_date || new Date().toISOString().slice(0, 10),
        data.notes || null,
      ]
    );

    // Update timestamp on parent lending record
    await client.query(
      `UPDATE lending_records SET updated_at = NOW() WHERE id = $1`,
      [lendingId]
    );

    await client.query("COMMIT");
    return insertRes.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getLendingSummary(userId) {
  const records = await getLendingRecords(userId);

  let totalReceivable = 0;
  let totalPayable = 0;
  let openCount = 0;
  let partiallySettledCount = 0;
  let overdueCount = 0;
  let settledCount = 0;

  for (const rec of records) {
    const outstanding = parseFloat(rec.outstanding_amount);

    if (rec.direction === "LENT") {
      totalReceivable += outstanding;
    } else if (rec.direction === "BORROWED") {
      totalPayable += outstanding;
    }

    if (rec.status === "SETTLED") {
      settledCount += 1;
    } else if (rec.status === "OVERDUE") {
      overdueCount += 1;
    } else if (rec.status === "PARTIALLY_SETTLED") {
      partiallySettledCount += 1;
    } else {
      openCount += 1;
    }
  }

  return {
    total_receivables: totalReceivable.toFixed(2),
    total_payables: totalPayable.toFixed(2),
    net_position: (totalReceivable - totalPayable).toFixed(2),
    total_records: records.length,
    open_count: openCount,
    partially_settled_count: partiallySettledCount,
    overdue_count: overdueCount,
    settled_count: settledCount,
  };
}

module.exports = {
  getLendingRecords,
  getLendingRecordById,
  createLendingRecord,
  createRepayment,
  getLendingSummary,
};

