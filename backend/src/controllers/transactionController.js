
const { z } = require("zod");
const transactionService = require("../services/transactionService");

const createSchema = z.object({
  account_id: z.coerce.number().int().positive(),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  transaction_type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().finite().positive().max(999999999999.99),
  transaction_date: z.iso.date().optional(),
  description: z.string().trim().max(255).nullable().optional(),
  merchant: z.string().trim().max(150).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

async function getTransactions(req, res) {
  const filterSchema = z.object({
    transaction_type: z.enum(["INCOME", "EXPENSE"]).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  });

  const validation = filterSchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction filters",
    });
  }

  const { from, to } = validation.data;

  if (from && to && from > to) {
    return res.status(400).json({
      success: false,
      message: "Start date cannot be after end date",
    });
  }

  try {
    const data = await transactionService.getTransactions(
      req.user.id,
      validation.data
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get transactions failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve transactions",
    });
  }
}

async function createTransaction(req, res) {
  const validation = createSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction details",
    });
  }

  try {
    const data = await transactionService.createTransaction(
      req.user.id,
      {
        ...validation.data,
        transaction_date:
          validation.data.transaction_date ||
          new Date().toISOString().slice(0, 10),
      }
    );

    return res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data,
    });
  } catch (error) {
    if (
      error.code === "23503" ||
      error.code === "INVALID_CATEGORY" ||
      error.statusCode === 400
    ) {
      return res.status(400).json({
        success: false,
        message: "Account or category does not exist or is not accessible",
      });
    }

    console.error("Create transaction failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create transaction",
    });
  }
}

const updateSchema = z.object({
  account_id: z.coerce.number().int().positive(),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  transaction_type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().finite().positive().max(999999999999.99),
  transaction_date: z.iso.date(),
  description: z.string().trim().max(255).nullable().optional(),
  merchant: z.string().trim().max(150).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

async function updateTransaction(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction ID",
    });
  }

  const validation = updateSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction details",
    });
  }

  try {
    const updated = await transactionService.updateTransaction(
      req.user.id,
      id,
      validation.data
    );
    

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: updated,
    });
  } catch (error) {
    if (
      error.code === "23503" ||
      error.code === "INVALID_CATEGORY" ||
      error.code === "INVALID_ACCOUNT" ||
      error.statusCode === 400
    ) {
      return res.status(400).json({
        success: false,
        message: "Account or category does not exist or is not accessible",
      });
    }

    console.error("Update transaction failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update transaction",
    });
  }
}

async function deleteTransaction(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction ID",
    });
  }

  try {
    const deleted = await transactionService.deleteTransaction(
      req.user.id,
      id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete transaction failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete transaction",
    });
  }
}

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const summaryQuerySchema = z.object({
  month: z
    .string()
    .regex(monthRegex, "Invalid month format. Expected YYYY-MM")
    .optional(),
});

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function getTransactionSummary(req, res) {
  const validation = summaryQuerySchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.issues[0]?.message || "Invalid month parameter",
    });
  }

  try {
    const selectedMonth = validation.data.month || getCurrentMonth();
    const summary = await transactionService.getMonthlySummary(
      req.user.id,
      selectedMonth
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get transaction summary failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve monthly summary",
    });
  }
}

module.exports = {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};

