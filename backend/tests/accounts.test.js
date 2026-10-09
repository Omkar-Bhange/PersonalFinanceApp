const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/database");
const { assertTestDatabase } = require("./helpers/testDbGuard");
const { clearTestDatabase } = require("./helpers/testUtils");

describe("Accounts API Integration Tests", () => {
  let userAToken;
  let userBToken;
  let userAAccountId;

  beforeAll(async () => {
    assertTestDatabase();
    await clearTestDatabase();

    // Register User A
    const resA = await request(app).post("/api/v1/auth/register").send({
      name: "User Alpha",
      email: "alpha@example.com",
      password: "Password12345!",
    });
    userAToken = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post("/api/v1/auth/register").send({
      name: "User Beta",
      email: "beta@example.com",
      password: "Password12345!",
    });
    userBToken = resB.body.data.accessToken;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/v1/accounts", () => {
    it("should allow User A to create a bank account", async () => {
      const res = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Alpha Checking",
          account_type: "BANK",
          opening_balance: 1000.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Alpha Checking");
      expect(res.body.data.account_type).toBe("BANK");
      expect(res.body.data.opening_balance).toBe("1000.50");
      expect(res.body.data.total_income).toBe("0.00");
      expect(res.body.data.total_expenses).toBe("0.00");
      expect(res.body.data.current_balance).toBe("1000.50");
      userAAccountId = res.body.data.id;
    });

    it("should reject account creation with invalid account_type", async () => {
      const res = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Invalid Type Account",
          account_type: "CRYPTO",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject duplicate account name for the same user", async () => {
      const res = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Alpha Checking",
          account_type: "CASH",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/accounts (User Isolation)", () => {
    it("should return only User A's accounts for User A with calculated balances", async () => {
      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Alpha Checking");
      expect(res.body.data[0].opening_balance).toBe("1000.50");
      expect(res.body.data[0].total_income).toBe("0.00");
      expect(res.body.data[0].total_expenses).toBe("0.00");
      expect(res.body.data[0].current_balance).toBe("1000.50");
    });

    it("should return empty list for User B before they create accounts", async () => {
      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("PUT /api/v1/accounts/:id (Cross-User Protection)", () => {
    it("should allow User A to update their own account and return balance fields", async () => {
      const res = await request(app)
        .put(`/api/v1/accounts/${userAAccountId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Alpha Primary Checking",
          account_type: "BANK",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Alpha Primary Checking");
      expect(res.body.data.opening_balance).toBe("1000.50");
      expect(res.body.data.total_income).toBe("0.00");
      expect(res.body.data.total_expenses).toBe("0.00");
      expect(res.body.data.current_balance).toBe("1000.50");
    });

    it("should prevent User B from modifying User A's account (404 Not Found)", async () => {
      const res = await request(app)
        .put(`/api/v1/accounts/${userAAccountId}`)
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          name: "Hijacked Account",
          account_type: "CASH",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Account not found");
    });
  });

  describe("Dynamic Account Balance Calculation & Reconciliation", () => {
    let secondAccountId;
    let userBAccountId;
    let reconciledTxId;

    it("Scenario 1: Account with no transactions returns opening balance as current balance", async () => {
      const createRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Alpha Savings",
          account_type: "BANK",
          opening_balance: 500.25,
        });

      expect(createRes.status).toBe(201);
      secondAccountId = createRes.body.data.id;

      const getRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = getRes.body.data.find((acc) => acc.id === secondAccountId);
      expect(savings.opening_balance).toBe("500.25");
      expect(savings.total_income).toBe("0.00");
      expect(savings.total_expenses).toBe("0.00");
      expect(savings.current_balance).toBe("500.25");
    });

    it("Scenario 2: Account with income-only transactions increases current balance", async () => {
      // Add income: 250.75
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: secondAccountId,
          transaction_type: "INCOME",
          amount: 250.75,
          transaction_date: "2026-10-01",
        });

      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = res.body.data.find((acc) => acc.id === secondAccountId);
      // 500.25 + 250.75 = 751.00
      expect(savings.total_income).toBe("250.75");
      expect(savings.total_expenses).toBe("0.00");
      expect(savings.current_balance).toBe("751.00");
    });

    it("Scenario 3: Account with expense transactions decreases current balance", async () => {
      // Add expense: 51.50
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: secondAccountId,
          transaction_type: "EXPENSE",
          amount: 51.50,
          transaction_date: "2026-10-02",
        });

      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = res.body.data.find((acc) => acc.id === secondAccountId);
      // 500.25 + 250.75 - 51.50 = 699.50
      expect(savings.total_income).toBe("250.75");
      expect(savings.total_expenses).toBe("51.50");
      expect(savings.current_balance).toBe("699.50");
    });

    it("Scenario 4 & 10: Mixed transactions with decimal precision and single opening balance calculation", async () => {
      // Add another income: 100.20
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: secondAccountId,
          transaction_type: "INCOME",
          amount: 100.20,
          transaction_date: "2026-10-03",
        });

      // Add another expense: 48.20
      const txRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: secondAccountId,
          transaction_type: "EXPENSE",
          amount: 48.20,
          transaction_date: "2026-10-04",
        });
      reconciledTxId = txRes.body.data.id;

      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = res.body.data.find((acc) => acc.id === secondAccountId);
      // Total income: 250.75 + 100.20 = 350.95
      // Total expenses: 51.50 + 48.20 = 99.70
      // Current balance: 500.25 + 350.95 - 99.70 = 751.50
      expect(savings.opening_balance).toBe("500.25");
      expect(savings.total_income).toBe("350.95");
      expect(savings.total_expenses).toBe("99.70");
      expect(savings.current_balance).toBe("751.50");
    });

    it("Scenario 5: Multiple independent accounts for the same user calculate balances independently", async () => {
      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const primary = res.body.data.find((acc) => acc.id === userAAccountId);
      const savings = res.body.data.find((acc) => acc.id === secondAccountId);

      // Primary has no transactions
      expect(primary.opening_balance).toBe("1000.50");
      expect(primary.total_income).toBe("0.00");
      expect(primary.total_expenses).toBe("0.00");
      expect(primary.current_balance).toBe("1000.50");

      // Savings has 4 transactions
      expect(savings.opening_balance).toBe("500.25");
      expect(savings.total_income).toBe("350.95");
      expect(savings.total_expenses).toBe("99.70");
      expect(savings.current_balance).toBe("751.50");
    });

    it("Scenario 6: Cross-user balance isolation ensures User A transactions do not affect User B accounts", async () => {
      // Create account for User B with opening balance 300.00
      const bAccRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          name: "Beta Wallet",
          account_type: "WALLET",
          opening_balance: 300.00,
        });

      userBAccountId = bAccRes.body.data.id;

      // User B creates a 50.00 expense
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          account_id: userBAccountId,
          transaction_type: "EXPENSE",
          amount: 50.00,
          transaction_date: "2026-10-04",
        });

      // Check User B account
      const bRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(bRes.body.data).toHaveLength(1);
      expect(bRes.body.data[0].opening_balance).toBe("300.00");
      expect(bRes.body.data[0].total_income).toBe("0.00");
      expect(bRes.body.data[0].total_expenses).toBe("50.00");
      expect(bRes.body.data[0].current_balance).toBe("250.00");

      // Verify User A accounts remain completely unchanged
      const aRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = aRes.body.data.find((acc) => acc.id === secondAccountId);
      expect(savings.current_balance).toBe("751.50");
    });

    it("Scenario 7: Transaction update dynamically reconciles account balance", async () => {
      // Update reconciledTxId (expense of 48.20 -> expense of 98.20)
      const updateTxRes = await request(app)
        .put(`/api/v1/transactions/${reconciledTxId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: secondAccountId,
          transaction_type: "EXPENSE",
          amount: 98.20,
          transaction_date: "2026-10-04",
          description: "Adjusted expense amount",
        });

      expect(updateTxRes.status).toBe(200);

      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = res.body.data.find((acc) => acc.id === secondAccountId);
      // Expenses: 51.50 + 98.20 = 149.70
      // Current balance: 500.25 + 350.95 - 149.70 = 701.50
      expect(savings.total_expenses).toBe("149.70");
      expect(savings.current_balance).toBe("701.50");
    });

    it("Scenario 8: Transaction deletion dynamically reconciles account balance", async () => {
      // Delete reconciledTxId (expense of 98.20)
      const delTxRes = await request(app)
        .delete(`/api/v1/transactions/${reconciledTxId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(delTxRes.status).toBe(200);

      const res = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const savings = res.body.data.find((acc) => acc.id === secondAccountId);
      // Expenses: reverted back to 51.50
      // Current balance: 500.25 + 350.95 - 51.50 = 799.70
      expect(savings.total_expenses).toBe("51.50");
      expect(savings.current_balance).toBe("799.70");
    });
  });
});

