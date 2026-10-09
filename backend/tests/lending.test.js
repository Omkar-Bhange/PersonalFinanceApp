const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/database");
const { assertTestDatabase } = require("./helpers/testDbGuard");
const { clearTestDatabase } = require("./helpers/testUtils");

describe("Lending & Borrowing Integration Tests", () => {
  let userAToken;
  let userBToken;
  let userAAccount1Id;
  let userAAccount2Id;
  let userBAccountId;
  let lentRecordId;
  let borrowedRecordId;

  beforeAll(async () => {
    assertTestDatabase();
    await clearTestDatabase();

    // Register User A
    const resA = await request(app).post("/api/v1/auth/register").send({
      name: "Lending User Alpha",
      email: "lending_alpha@example.com",
      password: "Password12345!",
    });
    userAToken = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post("/api/v1/auth/register").send({
      name: "Lending User Beta",
      email: "lending_beta@example.com",
      password: "Password12345!",
    });
    userBToken = resB.body.data.accessToken;

    // Create Account 1 for User A (Opening Balance: 10,000)
    const accA1 = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ name: "Alpha Main Checking", account_type: "BANK", opening_balance: 10000 });
    userAAccount1Id = accA1.body.data.id;

    // Create Account 2 for User A (Opening Balance: 5,000)
    const accA2 = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ name: "Alpha Cash Wallet", account_type: "CASH", opening_balance: 5000 });
    userAAccount2Id = accA2.body.data.id;

    // Create Account for User B (Opening Balance: 2,000)
    const accB = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ name: "Beta Bank", account_type: "BANK", opening_balance: 2000 });
    userBAccountId = accB.body.data.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/v1/lending (Creation & Validation)", () => {
    it("should successfully create a LENT record and reduce linked account balance without affecting income/expenses", async () => {
      // Lend 3,000 from Alpha Main Checking (10,000 opening)
      const res = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          direction: "LENT",
          person_name: "John Doe",
          phone: "+91 9876543210",
          principal_amount: 3000.0,
          start_date: "2026-10-01",
          due_date: "2026-12-01",
          notes: "Personal emergency loan",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.direction).toBe("LENT");
      expect(res.body.data.person_name).toBe("John Doe");
      expect(res.body.data.principal_amount).toBe("3000.00");
      expect(res.body.data.total_repaid).toBe("0.00");
      expect(res.body.data.outstanding_amount).toBe("3000.00");
      expect(res.body.data.status).toBe("OPEN");
      lentRecordId = res.body.data.id;

      // Verify Account Balance
      const accRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const acc1 = accRes.body.data.find((a) => a.id === userAAccount1Id);
      // 10,000 opening - 3,000 lent = 7,000 balance
      expect(acc1.opening_balance).toBe("10000.00");
      expect(acc1.total_income).toBe("0.00");
      expect(acc1.total_expenses).toBe("0.00");
      expect(acc1.current_balance).toBe("7000.00");
    });

    it("should successfully create a BORROWED record and increase linked account balance without affecting income/expenses", async () => {
      // Borrow 4,000 into Alpha Cash Wallet (5,000 opening)
      const res = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount2Id,
          direction: "BORROWED",
          person_name: "Sarah Friend",
          principal_amount: 4000.0,
          start_date: "2026-10-02",
          due_date: "2026-11-15",
          notes: "Short-term borrow for travel",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.direction).toBe("BORROWED");
      expect(res.body.data.principal_amount).toBe("4000.00");
      expect(res.body.data.outstanding_amount).toBe("4000.00");
      expect(res.body.data.status).toBe("OPEN");
      borrowedRecordId = res.body.data.id;

      // Verify Account Balance
      const accRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const acc2 = accRes.body.data.find((a) => a.id === userAAccount2Id);
      // 5,000 opening + 4,000 borrowed = 9,000 balance
      expect(acc2.opening_balance).toBe("5000.00");
      expect(acc2.total_income).toBe("0.00");
      expect(acc2.total_expenses).toBe("0.00");
      expect(acc2.current_balance).toBe("9000.00");
    });

    it("should reject lending creation with negative or zero amount", async () => {
      const res = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          direction: "LENT",
          person_name: "Bad Amount Person",
          principal_amount: -500,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject lending creation with invalid direction", async () => {
      const res = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          direction: "INVESTMENT",
          person_name: "Bad Direction",
          principal_amount: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should prevent User A from creating lending record referencing User B's account", async () => {
      const res = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userBAccountId,
          direction: "LENT",
          person_name: "Hijack Attempt",
          principal_amount: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Account does not exist");
    });
  });

  describe("POST /api/v1/lending/:id/repayments (Repayment & Row Locking)", () => {
    it("should record partial repayment for LENT record, update outstanding, status, and increase receiving account balance", async () => {
      // John returns 1,000 of 3,000 into Alpha Main Checking
      const res = await request(app)
        .post(`/api/v1/lending/${lentRecordId}/repayments`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          amount: 1000.0,
          repayment_date: "2026-10-10",
          notes: "First installment",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe("1000.00");

      // Verify Record status & amounts
      const recRes = await request(app)
        .get(`/api/v1/lending/${lentRecordId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(recRes.body.data.principal_amount).toBe("3000.00");
      expect(recRes.body.data.total_repaid).toBe("1000.00");
      expect(recRes.body.data.outstanding_amount).toBe("2000.00");
      expect(recRes.body.data.status).toBe("PARTIALLY_SETTLED");
      expect(recRes.body.data.repayments).toHaveLength(1);

      // Verify Account Balance
      const accRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const acc1 = accRes.body.data.find((a) => a.id === userAAccount1Id);
      // 10,000 opening - 3,000 lent + 1,000 repayment = 8,000
      expect(acc1.current_balance).toBe("8000.00");
    });

    it("should reject repayment exceeding remaining outstanding balance", async () => {
      // Remaining is 2,000. Try repaying 2,500.
      const res = await request(app)
        .post(`/api/v1/lending/${lentRecordId}/repayments`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          amount: 2500.0,
          repayment_date: "2026-10-11",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("exceeds outstanding balance");
    });

    it("should record remaining repayment, mark record as SETTLED, and update account balance", async () => {
      // John returns remaining 2,000 into Alpha Cash Wallet (acc2)
      const res = await request(app)
        .post(`/api/v1/lending/${lentRecordId}/repayments`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount2Id,
          amount: 2000.0,
          repayment_date: "2026-10-12",
          notes: "Final settlement",
        });

      expect(res.status).toBe(201);

      // Check Record
      const recRes = await request(app)
        .get(`/api/v1/lending/${lentRecordId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(recRes.body.data.total_repaid).toBe("3000.00");
      expect(recRes.body.data.outstanding_amount).toBe("0.00");
      expect(recRes.body.data.status).toBe("SETTLED");
      expect(recRes.body.data.repayments).toHaveLength(2);

      // Verify Account Balances:
      // acc1: 10,000 opening - 3,000 lent + 1,000 repayment = 8,000.00
      // acc2: 5,000 opening + 4,000 borrowed + 2,000 repayment = 11,000.00
      const accRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const acc1 = accRes.body.data.find((a) => a.id === userAAccount1Id);
      const acc2 = accRes.body.data.find((a) => a.id === userAAccount2Id);
      expect(acc1.current_balance).toBe("8000.00");
      expect(acc2.current_balance).toBe("11000.00");
    });

    it("should record repayment for BORROWED record, decrease account balance, and update status", async () => {
      // Sarah is owed 4,000. We repay 1,500 from Alpha Main Checking (acc1)
      const res = await request(app)
        .post(`/api/v1/lending/${borrowedRecordId}/repayments`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          amount: 1500.0,
          repayment_date: "2026-10-15",
          notes: "Repaid Sarah",
        });

      expect(res.status).toBe(201);

      // Check record status
      const recRes = await request(app)
        .get(`/api/v1/lending/${borrowedRecordId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(recRes.body.data.principal_amount).toBe("4000.00");
      expect(recRes.body.data.total_repaid).toBe("1500.00");
      expect(recRes.body.data.outstanding_amount).toBe("2500.00");
      expect(recRes.body.data.status).toBe("PARTIALLY_SETTLED");

      // Verify acc1 balance: 8,000 - 1,500 = 6,500
      const accRes = await request(app)
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${userAToken}`);

      const acc1 = accRes.body.data.find((a) => a.id === userAAccount1Id);
      expect(acc1.current_balance).toBe("6500.00");
    });
  });

  describe("Due Dates & OVERDUE Status Calculation", () => {
    it("should compute OVERDUE status when past due date and outstanding > 0", async () => {
      // Create record with past due date: 2026-01-01
      const res = await request(app)
        .post("/api/v1/lending")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          account_id: userAAccount1Id,
          direction: "LENT",
          person_name: "Overdue Debtor",
          principal_amount: 500.0,
          start_date: "2025-12-01",
          due_date: "2026-01-01",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("OVERDUE");
      expect(res.body.data.outstanding_amount).toBe("500.00");
    });
  });

  describe("Cross-User Isolation & Security", () => {
    it("should prevent User B from viewing User A's lending records", async () => {
      const res = await request(app)
        .get(`/api/v1/lending/${lentRecordId}`)
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Lending record not found");
    });

    it("should prevent User B from submitting repayments to User A's lending records", async () => {
      const res = await request(app)
        .post(`/api/v1/lending/${lentRecordId}/repayments`)
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          account_id: userBAccountId,
          amount: 100.0,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return empty lending list for User B before creating records", async () => {
      const res = await request(app)
        .get("/api/v1/lending")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/v1/lending/summary", () => {
    it("should return accurate portfolio totals and status counts", async () => {
      const res = await request(app)
        .get("/api/v1/lending/summary")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary.total_records).toBe(3); // lentRecord (settled), borrowedRecord (partially settled), overdueRecord (overdue)
      expect(summary.settled_count).toBe(1);
      expect(summary.partially_settled_count).toBe(1);
      expect(summary.overdue_count).toBe(1);
      expect(summary.open_count).toBe(0);

      // Receivables: 0.00 (settled) + 500.00 (overdue) = 500.00
      expect(summary.total_receivables).toBe("500.00");
      // Payables: 2500.00 (borrowed remaining)
      expect(summary.total_payables).toBe("2500.00");
      // Net: 500 - 2500 = -2000.00
      expect(summary.net_position).toBe("-2000.00");
    });
  });
});

