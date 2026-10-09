
const { z } = require("zod");
const accountService = require("../services/accountService");

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  account_type: z.enum(["CASH", "BANK", "WALLET", "OTHER"]),
  opening_balance: z.coerce.number().finite().min(-999999999999).max(999999999999).default(0),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  account_type: z.enum(["CASH", "BANK", "WALLET", "OTHER"]),
});

async function getAccounts(req, res) {
  try {
    const accounts = await accountService.getAccounts(req.user.id);

    res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    console.error("Get accounts failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve accounts",
    });
  }
}

async function createAccount(req, res) {
  const validation = createSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid account details",
    });
  }

  try {
    const account = await accountService.createAccount(
      req.user.id,
      validation.data
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: account,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this name already exists",
      });
    }

    console.error("Create account failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
}

async function updateAccount(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid account ID",
    });
  }

  const validation = updateSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid account details",
    });
  }

  try {
    const account = await accountService.updateAccount(
      req.user.id,
      id,
      validation.data
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Account updated successfully",
      data: account,
    });
  } catch (error) {
    console.error("Update account failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update account",
    });
  }
}

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
};

