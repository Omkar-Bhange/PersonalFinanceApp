const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/database");
const { assertTestDatabase } = require("./helpers/testDbGuard");
const { clearTestDatabase } = require("./helpers/testUtils");

describe("Categories API Integration & Isolation Tests", () => {
  let userAToken;
  let userBToken;

  beforeAll(async () => {
    assertTestDatabase();
    await clearTestDatabase();

    // Register User A
    const resA = await request(app).post("/api/v1/auth/register").send({
      name: "Cat User A",
      email: "cata@example.com",
      password: "Password12345!",
    });
    userAToken = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post("/api/v1/auth/register").send({
      name: "Cat User B",
      email: "catb@example.com",
      password: "Password12345!",
    });
    userBToken = resB.body.data.accessToken;

    // Insert a global category (user_id = NULL)
    await pool.query(`
      INSERT INTO categories (user_id, name, category_type, icon, color)
      VALUES (NULL, 'Global Salary', 'INCOME', 'briefcase', '#2ecc71')
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("GET /api/v1/categories (Global Visibility & User Isolation)", () => {
    it("should allow User A to see the global category", async () => {
      const res = await request(app)
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const names = res.body.data.map((c) => c.name);
      expect(names).toContain("Global Salary");
    });

    it("should allow User A to create a private category", async () => {
      const res = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Alice Freelance",
          category_type: "INCOME",
          icon: "laptop",
          color: "#3498db",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Alice Freelance");
    });

    it("should allow User A to view their private category along with global ones", async () => {
      const res = await request(app)
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      const names = res.body.data.map((c) => c.name);
      expect(names).toContain("Global Salary");
      expect(names).toContain("Alice Freelance");
    });

    it("should strictly hide User A's private category from User B", async () => {
      const res = await request(app)
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      const names = res.body.data.map((c) => c.name);
      expect(names).toContain("Global Salary");
      expect(names).not.toContain("Alice Freelance");
    });
  });

  describe("POST /api/v1/categories (Validation & Conflict)", () => {
    it("should reject category creation with invalid category_type", async () => {
      const res = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Invalid Type",
          category_type: "INVESTMENT",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject duplicate category name and type for the same user", async () => {
      const res = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Alice Freelance",
          category_type: "INCOME",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });
});

