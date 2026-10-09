const { z } = require("zod");
const lendingService = require("../services/lendingService");

const createLendingSchema = z.object({
  account_id: z.coerce.number().int().positive(),
  direction: z.enum(["LENT", "BORROWED"]),
  person_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).nullable().optional(),
  principal_amount: z.coerce.number().finite().positive().max(999999999999.99),
  start_date: z.iso.date().optional(),
  due_date: z.iso.date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const createRepaymentSchema = z.object({
  account_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().finite().positive().max(999999999999.99),
  repayment_date: z.iso.date().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

async function getLendingRecords(req, res) {
  const filterSchema = z.object({
    direction: z.enum(["LENT", "BORROWED"]).optional(),
  });

  const validation = filterSchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid query filters",
    });
  }

  try {
    const data = await lendingService.getLendingRecords(
      req.user.id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get lending records failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve lending records",
    });
  }
}

async function getLendingSummary(req, res) {
  try {
    const data = await lendingService.getLendingSummary(req.user.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get lending summary failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve lending summary",
    });
  }
}

async function getLendingRecordById(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid lending record ID",
    });
  }

  try {
    const record = await lendingService.getLendingRecordById(req.user.id, id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Lending record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Get lending record failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve lending record",
    });
  }
}

async function createLendingRecord(req, res) {
  const validation = createLendingSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid lending record details",
      errors: validation.error.issues,
    });
  }

  try {
    const data = await lendingService.createLendingRecord(
      req.user.id,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Lending record created successfully",
      data,
    });
  } catch (error) {
    if (error.code === "INVALID_ACCOUNT" || error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create lending record failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create lending record",
    });
  }
}

async function createRepayment(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid lending record ID",
    });
  }

  const validation = createRepaymentSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid repayment details",
      errors: validation.error.issues,
    });
  }

  try {
    const data = await lendingService.createRepayment(
      req.user.id,
      id,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Repayment recorded successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.statusCode === 400 ||
      error.code === "INVALID_ACCOUNT" ||
      error.code === "EXCEEDS_OUTSTANDING"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create repayment failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to record repayment",
    });
  }
}

module.exports = {
  getLendingRecords,
  getLendingSummary,
  getLendingRecordById,
  createLendingRecord,
  createRepayment,
};

