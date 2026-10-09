const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/database");
const { assertTestDatabase } = require("./helpers/testDbGuard");
const { clearTestDatabase } = require("./helpers/testUtils");

describe("T-16A: Financial Reconciliation & Integrity Audit", () => {
  let userToken;
  let userBToken;
  let userId;
  let userBId;

  beforeAll(async () => {
    assertTestDatabase();
    await clearTestDatabase();

    // Register primary user
    const resA = await request(app).post("/api/v1/auth/register").send({
      name: "Audit User A",
      email: "audit_a@example.com",
      password: "Password12345!",
    });
    userToken = resA.body.data.accessToken;
    userId = resA.body.data.user.id;

    // Register secondary user for isolation tests
    const resB = await request(app).post("/api/v1/auth/register").send({
      name: "Audit User B",
      email: "audit_b@example.com",
      password: "Password12345!",
    });
    userBToken = resB.body.data.accessToken;
    userBId = resB.body.data.user.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  // Helper to fetch account by ID from GET /api/v1/accounts
  async function getAccount(accountId, token = userToken) {
    const res = await request(app)
      .get("/api/v1/accounts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.data.find((a) => a.id === accountId);
  }

  describe("Scenario A: Normal income and expenses", () => {
    let accountId;
    const currentMonth = new Date().toISOString().slice(0, 7);

    it("verifies ₹10,000 starting + ₹2,000 income - ₹500 expense = ₹11,500", async () => {
      // Create Account with ₹10,000 opening balance
      const accRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Scenario A Checking",
          account_type: "BANK",
          opening_balance: 10000.0,
        });
      expect(accRes.status).toBe(201);
      accountId = accRes.body.data.id;
      expect(parseFloat(accRes.body.data.current_balance)).toBe(10000.0);

      // Record ₹2,000 Income
      const incRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          transaction_type: "INCOME",
          amount: 2000.0,
          transaction_date: new Date().toISOString().slice(0, 10),
          description: "Consulting Bonus",
        });
      expect(incRes.status).toBe(201);

      // Record ₹500 Expense
      const expRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          transaction_type: "EXPENSE",
          amount: 500.0,
          transaction_date: new Date().toISOString().slice(0, 10),
          description: "Grocery supplies",
        });
      expect(expRes.status).toBe(201);

      // Check Account Balance
      const account = await getAccount(accountId);
      expect(account).toBeDefined();
      expect(parseFloat(account.current_balance)).toBe(11500.0);
      expect(parseFloat(account.total_income)).toBe(2000.0);
      expect(parseFloat(account.total_expenses)).toBe(500.0);

      // Check Monthly Summary
      const sumRes = await request(app)
        .get(`/api/v1/transactions/summary?month=${currentMonth}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(sumRes.status).toBe(200);
      expect(parseFloat(sumRes.body.data.total_income)).toBe(2000.0);
      expect(parseFloat(sumRes.body.data.total_expenses)).toBe(500.0);
      expect(parseFloat(sumRes.body.data.net_savings)).toBe(1500.0);
    });
  });

  describe("Scenario B: Lending and repayment reconciliation", () => {
    let accountId;
    let lendingId;

    it("verifies ₹10,000 -> lend ₹3,000 (₹7,000) -> repay ₹1,000 (₹8,000) -> repay ₹2,000 (₹10,000)", async () => {
      // Create Account with ₹10,000
      const accRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Scenario B Account",
          account_type: "BANK",
          opening_balance: 10000.0,
        });
      accountId = accRes.body.data.id;

      // 1. Lend ₹3,000 to Bob
      const lendRes = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          direction: "LENT",
          person_name: "Bob Friend",
          principal_amount: 3000.0,
        });
      expect(lendRes.status).toBe(201);
      lendingId = lendRes.body.data.id;

      // Balance should be ₹7,000
      const accAfterLend = await getAccount(accountId);
      expect(parseFloat(accAfterLend.current_balance)).toBe(7000.0);

      // 2. Receive partial repayment of ₹1,000
      const rep1 = await request(app)
        .post(`/api/v1/lending/${lendingId}/repayments`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          amount: 1000.0,
        });
      expect(rep1.status).toBe(201);

      // Balance should be ₹8,000, outstanding ₹2,000
      const accAfterRep1 = await getAccount(accountId);
      expect(parseFloat(accAfterRep1.current_balance)).toBe(8000.0);

      const lendDetail1 = await request(app)
        .get(`/api/v1/lending/${lendingId}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(parseFloat(lendDetail1.body.data.outstanding_amount)).toBe(2000.0);
      expect(lendDetail1.body.data.status).toBe("PARTIALLY_SETTLED");

      // 3. Receive remaining repayment of ₹2,000
      const rep2 = await request(app)
        .post(`/api/v1/lending/${lendingId}/repayments`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          amount: 2000.0,
        });
      expect(rep2.status).toBe(201);

      // Balance should be ₹10,000, outstanding ₹0, SETTLED
      const accAfterRep2 = await getAccount(accountId);
      expect(parseFloat(accAfterRep2.current_balance)).toBe(10000.0);

      const lendDetail2 = await request(app)
        .get(`/api/v1/lending/${lendingId}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(parseFloat(lendDetail2.body.data.outstanding_amount)).toBe(0.0);
      expect(lendDetail2.body.data.status).toBe("SETTLED");

      // Monthly transaction summary should NOT be inflated
      const currentMonth = new Date().toISOString().slice(0, 7);
      const sumRes = await request(app)
        .get(`/api/v1/transactions/summary?month=${currentMonth}`)
        .set("Authorization", `Bearer ${userToken}`);
      // Income and expenses must still be 2000 and 500 from Scenario A
      expect(parseFloat(sumRes.body.data.total_income)).toBe(2000.0);
      expect(parseFloat(sumRes.body.data.total_expenses)).toBe(500.0);
    });
  });

  describe("Scenario C: Borrowing and repayment reconciliation", () => {
    let accountId;
    let lendingId;

    it("verifies ₹10,000 -> borrow ₹4,000 (₹14,000) -> repay ₹1,500 (₹12,500) -> repay ₹2,500 (₹10,000)", async () => {
      // Create Account with ₹10,000
      const accRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Scenario C Account",
          account_type: "BANK",
          opening_balance: 10000.0,
        });
      accountId = accRes.body.data.id;

      // 1. Borrow ₹4,000
      const lendRes = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          direction: "BORROWED",
          person_name: "Lender Charlie",
          principal_amount: 4000.0,
        });
      expect(lendRes.status).toBe(201);
      lendingId = lendRes.body.data.id;

      // Balance should be ₹14,000
      const accAfterBorrow = await getAccount(accountId);
      expect(parseFloat(accAfterBorrow.current_balance)).toBe(14000.0);

      // 2. Repay ₹1,500
      const rep1 = await request(app)
        .post(`/api/v1/lending/${lendingId}/repayments`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          amount: 1500.0,
        });
      expect(rep1.status).toBe(201);

      // Balance should be ₹12,500
      const accAfterRep1 = await getAccount(accountId);
      expect(parseFloat(accAfterRep1.current_balance)).toBe(12500.0);

      // 3. Repay remaining ₹2,500
      const rep2 = await request(app)
        .post(`/api/v1/lending/${lendingId}/repayments`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accountId,
          amount: 2500.0,
        });
      expect(rep2.status).toBe(201);

      // Balance should be ₹10,000, outstanding ₹0
      const accAfterRep2 = await getAccount(accountId);
      expect(parseFloat(accAfterRep2.current_balance)).toBe(10000.0);

      const lendDetail = await request(app)
        .get(`/api/v1/lending/${lendingId}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(parseFloat(lendDetail.body.data.outstanding_amount)).toBe(0.0);
      expect(lendDetail.body.data.status).toBe("SETTLED");
    });
  });

  describe("Scenario D: Multiple accounts cross-account flows", () => {
    it("verifies lending from Account 1 and repayment deposited into Account 2", async () => {
      // Account 1: ₹10,000
      const acc1Res = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Scenario D Account 1",
          account_type: "BANK",
          opening_balance: 10000.0,
        });
      const acc1Id = acc1Res.body.data.id;

      // Account 2: ₹5,000
      const acc2Res = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Scenario D Account 2",
          account_type: "WALLET",
          opening_balance: 5000.0,
        });
      const acc2Id = acc2Res.body.data.id;

      // Lend ₹3,000 from Account 1
      const lendRes = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: acc1Id,
          direction: "LENT",
          person_name: "Dana",
          principal_amount: 3000.0,
        });
      const lendingId = lendRes.body.data.id;

      // Repay ₹3,000 into Account 2
      const repRes = await request(app)
        .post(`/api/v1/lending/${lendingId}/repayments`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: acc2Id,
          amount: 3000.0,
        });
      expect(repRes.status).toBe(201);

      // Verify Account 1 = ₹7,000, Account 2 = ₹8,000
      const acc1Final = await getAccount(acc1Id);
      expect(parseFloat(acc1Final.current_balance)).toBe(7000.0);

      const acc2Final = await getAccount(acc2Id);
      expect(parseFloat(acc2Final.current_balance)).toBe(8000.0);

      // Combined = ₹15,000
      expect(
        parseFloat(acc1Final.current_balance) +
        parseFloat(acc2Final.current_balance)
      ).toBe(15000.0);
    });
  });

  describe("Scenario E: Concurrency, Overpayment & User Isolation Guards", () => {
    it("rejects repayment exceeding outstanding balance", async () => {
      const accRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Scenario E Acc",
          account_type: "CASH",
          opening_balance: 5000.0,
        });
      const accId = accRes.body.data.id;

      const lendRes = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accId,
          direction: "LENT",
          person_name: "Eve",
          principal_amount: 1000.0,
        });
      const lendingId = lendRes.body.data.id;

      // Attempt repayment of ₹1,500 (exceeds ₹1,000)
      const overpayRes = await request(app)
        .post(`/api/v1/lending/${lendingId}/repayments`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accId,
          amount: 1500.0,
        });
      expect(overpayRes.status).toBe(400);
      expect(overpayRes.body.message).toMatch(/exceeds outstanding balance/i);
    });

    it("prevents User B from accessing or repaying User A's loan record", async () => {
      // User B creates an account
      const accBRes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          name: "User B Cash",
          account_type: "CASH",
          opening_balance: 2000.0,
        });
      const accBId = accBRes.body.data.id;

      // User A creates an account and loan
      const accARes = await request(app)
        .post("/api/v1/accounts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "User A Lending Source",
          account_type: "BANK",
          opening_balance: 5000.0,
        });
      const accAId = accARes.body.data.id;

      const lendRes = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          account_id: accAId,
          direction: "LENT",
          person_name: "Frank",
          principal_amount: 500.0,
        });
      const userALendingId = lendRes.body.data.id;

      // User B attempts to fetch User A's lending record
      const getBRes = await request(app)
        .get(`/api/v1/lending/${userALendingId}`)
        .set("Authorization", `Bearer ${userBToken}`);
      expect(getBRes.status).toBe(404);

      // User B attempts to repay User A's lending record
      const repBRes = await request(app)
        .post(`/api/v1/lending/${userALendingId}/repayments`)
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          account_id: accBId,
          amount: 100.0,
        });
      expect(repBRes.status).toBe(404);
    });
  });
});
