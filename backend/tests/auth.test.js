const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/database");
const { assertTestDatabase } = require("./helpers/testDbGuard");
const { clearTestDatabase } = require("./helpers/testUtils");

describe("Authentication Integration Tests", () => {
  beforeAll(async () => {
    assertTestDatabase();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a new user with valid details", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Alice Developer",
          email: "alice@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe("alice@example.com");
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
    });

    it("should reject duplicate email registration with 409 conflict", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Alice Duplicate",
          email: "ALICE@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("An account with this email already exists");
    });

    it("should reject registration with invalid email format", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Invalid Email",
          email: "not-an-email",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject registration with short password (<12 chars)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Short Pass",
          email: "shortpass@example.com",
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should successfully log in with valid credentials and return access token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("alice@example.com");
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
    });

    it("should reject login with incorrect password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice@example.com",
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("should reject login for non-existent email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("GET /api/v1/users/me & Token Security Verification", () => {
    let validToken;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice@example.com",
          password: "SecurePassword123!",
        });
      validToken = loginRes.body.data.accessToken;
    });

    it("should return the authenticated user profile with valid token", async () => {
      const profileRes = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.data.email).toBe("alice@example.com");
      expect(profileRes.body.data.password_hash).toBeUndefined();
    });

    it("should reject request without Authorization header (401)", async () => {
      const res = await request(app).get("/api/v1/users/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required");
    });

    it("should reject request with malformed Authorization header (401)", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", "Basic dXNlcjpwYXNz");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required");
    });

    it("should reject request with tampered/forged token (401)", async () => {
      const tamperedToken = validToken.slice(0, -5) + "abcde";
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid or expired access token");
    });
  });
});

