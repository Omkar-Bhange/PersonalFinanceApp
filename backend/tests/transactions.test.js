const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/database");
const { assertTestDatabase } = require("./helpers/testDbGuard");
const { clearTestDatabase } = require("./helpers/testUtils");

describe("Transactions API Integration & Isolation Tests", () => {
  let userAToken;
  let userBToken;
  let userAAccountId;
  let userBAccountId;
  let globalCategoryId;
  let userACategoryId;
  let userBCategoryId;
  let userATransactionId;

  beforeAll(async () => {
    assertTestDatabase();
    await clearTestDatabase();

    // Register User A
    const resA = await request(app).post("/api/v1/auth/register").send({
      name: "Tx User A",
      email: "txa@example.com",
      password: "Password12345!",
    });
    userAToken = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post("/api/v1/auth/register").send({
      name: "Tx User B",
      email: "txb@example.com",
      password: "Password12345!",
    });
    userBToken = resB.body.data.accessToken;

    // Create Account for User A
    const accA = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ name: "User A Bank", account_type: "BANK", opening_balance: 500 });
    userAAccountId = accA.body.data.id;

    // Create Account for User B
    const accB = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ name: "User B Bank", account_type: "BANK", opening_balance: 500 });
    userBAccountId = accB.body.data.id;

    // Create Global Category
    const globalCat = await pool.query(`
      INSERT INTO categories (user_id, name, category_type)
      VALUES (NULL, 'Global Groceries', 'EXPENSE')
      RETURNING id
    `);
    globalCategoryId = globalCat.rows[0].id;

    // Create Private Category for User A
    const catA = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ name: "A Dining", category_type: "EXPENSE" });
    userACategoryId = catA.body.data.id;

    // Create Private Category for User B
    const catB = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ name: "B Consulting", category_type: "INCOME" });
    userBCategoryId = catB.body.data.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/v1/transactions (Creation & Validation)", () => {
    it("should allow User A to create a transaction referencing a global category", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: globalCategoryId,
          transaction_type: "EXPENSE",
          amount: 45.5,
          description: "Supermarket shopping",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe("45.50");
      userATransactionId = res.body.data.id;
    });

    it("should allow User A to create a transaction referencing their own private category", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: userACategoryId,
          transaction_type: "EXPENSE",
          amount: 25.0,
          description: "Dinner out",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should allow creating an uncategorized transaction (category_id: null)", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: null,
          transaction_type: "EXPENSE",
          amount: 10.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category_id).toBeNull();
    });

    it("should prevent User A from using User B's private category", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: userBCategoryId,
          transaction_type: "INCOME",
          amount: 100.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Account or category does not exist or is not accessible");
    });

    it("should prevent User A from attaching a transaction to User B's account", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userBAccountId,
          category_id: globalCategoryId,
          transaction_type: "EXPENSE",
          amount: 50.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Account or category does not exist or is not accessible");
    });

    it("should reject negative transaction amounts", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: globalCategoryId,
          transaction_type: "EXPENSE",
          amount: -50.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/transactions (Filtering & Isolation)", () => {
    it("should return only User A's transactions for User A", async () => {
      const res = await request(app)
        .get("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it("should return empty list for User B before they create transactions", async () => {
      const res = await request(app)
        .get("/api/v1/transactions")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("PUT /api/v1/transactions/:id (Update & Ownership Validation)", () => {
    let transactionToUpdateId;

    beforeAll(async () => {
      const createRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: userACategoryId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          description: "Original description",
          transaction_date: "2026-10-01",
        });
      transactionToUpdateId = createRes.body.data.id;
    });

    it("should successfully update transaction amount, date, description, and global category", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: globalCategoryId,
          transaction_type: "EXPENSE",
          amount: 75.5,
          transaction_date: "2026-10-05",
          description: "Updated description",
          merchant: "New Merchant",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe("75.50");
      expect(res.body.data.category_id).toBe(globalCategoryId);
      expect(res.body.data.description).toBe("Updated description");
      expect(res.body.data.merchant).toBe("New Merchant");
      expect(res.body.data.updated_at).toBeDefined();
    });

    it("should allow updating transaction to have null category (uncategorized)", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: null,
          transaction_type: "EXPENSE",
          amount: 75.5,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category_id).toBeNull();
    });

    it("should reject update with invalid transaction ID format", async () => {
      const res = await request(app)
        .put("/api/v1/transactions/invalid-id")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid transaction ID");
    });

    it("should reject update with negative amount", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          transaction_type: "EXPENSE",
          amount: -10.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject update with invalid date format", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          transaction_date: "not-a-valid-date",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when updating non-existent transaction", async () => {
      const res = await request(app)
        .put("/api/v1/transactions/999999")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Transaction not found");
    });

    it("should prevent User B from updating User A's transaction (404 Not Found)", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          account_id: userBAccountId,
          transaction_type: "EXPENSE",
          amount: 100.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Transaction not found");
    });

    it("should prevent User A from updating transaction with User B's private category (400 Bad Request)", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccountId,
          category_id: userBCategoryId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Account or category does not exist or is not accessible");
    });

    it("should prevent User A from updating transaction with User B's account (400 Bad Request)", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userBAccountId,
          category_id: userACategoryId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Account or category does not exist or is not accessible");
    });

    it("should reject unauthenticated transaction update request with 401", async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${transactionToUpdateId}`)
        .send({
          account_id: userAAccountId,
          transaction_type: "EXPENSE",
          amount: 50.0,
          transaction_date: "2026-10-05",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required");
    });
  });

  describe("DELETE /api/v1/transactions/:id (Cross-User Isolation)", () => {
    it("should prevent User B from deleting User A's transaction", async () => {
      const res = await request(app)
        .delete(`/api/v1/transactions/${userATransactionId}`)
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Transaction not found");
    });

    it("should allow User A to delete their own transaction", async () => {
      const res = await request(app)
        .delete(`/api/v1/transactions/${userATransactionId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/v1/transactions/summary (Monthly Financial Summary)", () => {
    let summaryUserAToken;
    let summaryUserBToken;
    let summaryUserAAccId;
    let summaryUserBAccId;
    let salaryCatId;
    let foodCatId;

    beforeAll(async () => {
      // Register distinct users for summary tests
      const resA = await request(app).post("/api/v1/auth/register").send({
        name: "Summary User A",
        email: "summary_a@example.com",
        password: "Password12345!",
      });
      summaryUserAToken = resA.body.data.accessToken;

      const resB = await request(app).post("/api/v1/auth/register").send({
        name: "Summary User B",
        email: "summary_b@example.com",
        password: "Password12345!",
      });
      summaryUserBToken = resB.body.data.accessToken;

      // Create accounts
      const accA = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({ name: "Summary Checking A", account_type: "BANK", opening_balance: 1000 });
      summaryUserAAccId = accA.body.data.id;

      const accB = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${summaryUserBToken}`)
        .send({ name: "Summary Checking B", account_type: "BANK", opening_balance: 500 });
      summaryUserBAccId = accB.body.data.id;

      // Create categories for User A
      const catSalary = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({ name: "Salary", category_type: "INCOME" });
      salaryCatId = catSalary.body.data.id;

      const catFood = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({ name: "Food & Dining", category_type: "EXPENSE" });
      foodCatId = catFood.body.data.id;

      // Setup transactions for User A:
      // September 2026 (Previous Month):
      // Income: 2000.00 (Salary)
      // Expense: 500.00 (Food)
      // Net: 1500.00
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: salaryCatId,
          transaction_type: "INCOME",
          amount: 2000.0,
          transaction_date: "2026-09-15",
        });

      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: foodCatId,
          transaction_type: "EXPENSE",
          amount: 500.0,
          transaction_date: "2026-09-20",
        });

      // October 2026 (Current Month):
      // Boundary start: 2026-10-01 Income 3000.00 (Salary)
      // Mid-month: 2026-10-15 Expense 450.50 (Food)
      // Mid-month: 2026-10-20 Expense 150.25 (Uncategorized)
      // Boundary end: 2026-10-31 Expense 99.25 (Food)
      // Total October Income: 3000.00
      // Total October Expenses: 450.50 + 150.25 + 99.25 = 700.00
      // October Net Savings: 2300.00
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: salaryCatId,
          transaction_type: "INCOME",
          amount: 3000.0,
          transaction_date: "2026-10-01",
        });

      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: foodCatId,
          transaction_type: "EXPENSE",
          amount: 450.5,
          transaction_date: "2026-10-15",
        });

      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: null,
          transaction_type: "EXPENSE",
          amount: 150.25,
          transaction_date: "2026-10-20",
        });

      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: foodCatId,
          transaction_type: "EXPENSE",
          amount: 99.25,
          transaction_date: "2026-10-31",
        });

      // Next month boundary (November 2026 - must NOT leak into October):
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserAToken}`)
        .send({
          account_id: summaryUserAAccId,
          category_id: foodCatId,
          transaction_type: "EXPENSE",
          amount: 80.0,
          transaction_date: "2026-11-01",
        });

      // User B transaction in October (must NOT leak into User A):
      await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserBToken}`)
        .send({
          account_id: summaryUserBAccId,
          transaction_type: "INCOME",
          amount: 9999.0,
          transaction_date: "2026-10-10",
        });
    });

    it("should return accurate monthly summary with income, expenses, and previous month comparison", async () => {
      const res = await request(app)
        .get("/api/v1/transactions/summary?month=2026-10")
        .set("Authorization", `Bearer ${summaryUserAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.month).toBe("2026-10");
      expect(data.total_income).toBe("3000.00");
      expect(data.total_expenses).toBe("700.00");
      expect(data.net_savings).toBe("2300.00");

      // Previous month check (September 2026)
      expect(data.previous_month.month).toBe("2026-09");
      expect(data.previous_month.total_income).toBe("2000.00");
      expect(data.previous_month.total_expenses).toBe("500.00");
      expect(data.previous_month.net_savings).toBe("1500.00");

      // Percentage change check
      // Income: ((3000 - 2000) / 2000) * 100 = 50.0%
      // Expenses: ((700 - 500) / 500) * 100 = 40.0%
      // Net Savings: ((2300 - 1500) / 1500) * 100 = 53.33%
      expect(data.percentage_change.income).toBe(50.0);
      expect(data.percentage_change.expenses).toBe(40.0);
      expect(data.percentage_change.net_savings).toBe(53.33);

      // Income category breakdown
      expect(data.income_by_category).toHaveLength(1);
      expect(data.income_by_category[0].category_name).toBe("Salary");
      expect(data.income_by_category[0].total_amount).toBe("3000.00");
      expect(data.income_by_category[0].percentage_of_total).toBe(100.0);
      expect(data.income_by_category[0].transaction_count).toBe(1);

      // Expense category breakdown including uncategorized
      expect(data.expenses_by_category).toHaveLength(2);
      const foodItem = data.expenses_by_category.find((c) => c.category_name === "Food & Dining");
      const uncatItem = data.expenses_by_category.find((c) => c.category_name === "Uncategorized");

      expect(foodItem).toBeDefined();
      expect(foodItem.total_amount).toBe("549.75"); // 450.50 + 99.25
      expect(foodItem.transaction_count).toBe(2);
      expect(foodItem.percentage_of_total).toBe(78.54); // (549.75 / 700.00) * 100

      expect(uncatItem).toBeDefined();
      expect(uncatItem.category_id).toBeNull();
      expect(uncatItem.total_amount).toBe("150.25");
      expect(uncatItem.transaction_count).toBe(1);
      expect(uncatItem.percentage_of_total).toBe(21.46); // (150.25 / 700.00) * 100
    });

    it("should return zero totals for a month with no transactions", async () => {
      const res = await request(app)
        .get("/api/v1/transactions/summary?month=2025-01")
        .set("Authorization", `Bearer ${summaryUserAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.month).toBe("2025-01");
      expect(data.total_income).toBe("0.00");
      expect(data.total_expenses).toBe("0.00");
      expect(data.net_savings).toBe("0.00");
      expect(data.previous_month.month).toBe("2024-12");
      expect(data.previous_month.total_income).toBe("0.00");
      expect(data.previous_month.total_expenses).toBe("0.00");
      expect(data.previous_month.net_savings).toBe("0.00");
      expect(data.percentage_change.income).toBe(0);
      expect(data.percentage_change.expenses).toBe(0);
      expect(data.percentage_change.net_savings).toBe(0);
      expect(data.income_by_category).toHaveLength(0);
      expect(data.expenses_by_category).toHaveLength(0);
    });

    it("should handle months with income only (no expenses)", async () => {
      // Create user with income only in 2026-06
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserBToken}`)
        .send({
          account_id: summaryUserBAccId,
          transaction_type: "INCOME",
          amount: 1200.0,
          transaction_date: "2026-06-10",
        });
      expect(res.status).toBe(201);

      const summaryRes = await request(app)
        .get("/api/v1/transactions/summary?month=2026-06")
        .set("Authorization", `Bearer ${summaryUserBToken}`);

      expect(summaryRes.status).toBe(200);
      const data = summaryRes.body.data;
      expect(data.total_income).toBe("1200.00");
      expect(data.total_expenses).toBe("0.00");
      expect(data.net_savings).toBe("1200.00");
      expect(data.income_by_category).toHaveLength(1);
      expect(data.expenses_by_category).toHaveLength(0);
    });

    it("should handle months with expenses only (no income)", async () => {
      // Create expense only for User B in 2026-07
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${summaryUserBToken}`)
        .send({
          account_id: summaryUserBAccId,
          transaction_type: "EXPENSE",
          amount: 350.0,
          transaction_date: "2026-07-15",
        });
      expect(res.status).toBe(201);

      const summaryRes = await request(app)
        .get("/api/v1/transactions/summary?month=2026-07")
        .set("Authorization", `Bearer ${summaryUserBToken}`);

      expect(summaryRes.status).toBe(200);
      const data = summaryRes.body.data;
      expect(data.total_income).toBe("0.00");
      expect(data.total_expenses).toBe("350.00");
      expect(data.net_savings).toBe("-350.00");
      expect(data.income_by_category).toHaveLength(0);
      expect(data.expenses_by_category).toHaveLength(1);
    });

    it("should handle previous month having zero baseline (returns null percentage_change)", async () => {
      // User B in 2026-06 had income 1200, previous month (2026-05) had 0 income
      const summaryRes = await request(app)
        .get("/api/v1/transactions/summary?month=2026-06")
        .set("Authorization", `Bearer ${summaryUserBToken}`);

      expect(summaryRes.status).toBe(200);
      const data = summaryRes.body.data;
      expect(data.previous_month.total_income).toBe("0.00");
      expect(data.percentage_change.income).toBeNull();
    });

    it("should isolate transactions between different users", async () => {
      const resA = await request(app)
        .get("/api/v1/transactions/summary?month=2026-10")
        .set("Authorization", `Bearer ${summaryUserAToken}`);

      const resB = await request(app)
        .get("/api/v1/transactions/summary?month=2026-10")
        .set("Authorization", `Bearer ${summaryUserBToken}`);

      expect(resA.body.data.total_income).toBe("3000.00");
      expect(resB.body.data.total_income).toBe("9999.00");
    });

    it("should default to current month when month parameter is omitted", async () => {
      const res = await request(app)
        .get("/api/v1/transactions/summary")
        .set("Authorization", `Bearer ${summaryUserAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.month).toMatch(/^\d{4}-\d{2}$/);
    });

    it("should reject invalid month format with 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/v1/transactions/summary?month=2026-13")
        .set("Authorization", `Bearer ${summaryUserAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid month");
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/v1/transactions/summary?month=2026-10");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required");
    });
  });
});


