const request = require("supertest");
const app = require("../src/app");

describe("Health Routing, 404 Catch-All & Authentication Middleware", () => {
  describe("Root & Health Routes", () => {
    it("should return root API status", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Personal Finance API is running",
      });
    });

    it("should return healthy status from /api/v1/health", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("API is healthy");
      expect(typeof res.body.timestamp).toBe("string");
    });
  });

  describe("JSON 404 Catch-All Handler", () => {
    it("should return JSON 404 for unknown GET endpoints", async () => {
      const res = await request(app).get("/api/v1/nonexistent-endpoint");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        message: "Route not found",
      });
    });

    it("should return JSON 404 for unknown POST endpoints", async () => {
      const res = await request(app)
        .post("/api/v1/invalid/resource")
        .send({ foo: "bar" });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        message: "Route not found",
      });
    });
  });

  describe("Authentication Gatekeeper on Protected Routes", () => {
    const protectedRoutes = [
      { method: "get", path: "/api/v1/users/me" },
      { method: "get", path: "/api/v1/accounts" },
      { method: "post", path: "/api/v1/accounts" },
      { method: "get", path: "/api/v1/categories" },
      { method: "post", path: "/api/v1/categories" },
      { method: "get", path: "/api/v1/transactions" },
      { method: "post", path: "/api/v1/transactions" },
      { method: "delete", path: "/api/v1/transactions/1" },
    ];

    test.each(protectedRoutes)(
      "should reject unauthenticated request to $method $path with 401",
      async ({ method, path }) => {
        const res = await request(app)[method](path);
        expect(res.status).toBe(401);
        expect(res.body).toEqual({
          success: false,
          message: "Authentication required",
        });
      }
    );

    it("should reject requests with invalid/tampered Bearer tokens", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer invalid.token.payload");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Invalid or expired access token",
      });
    });

    it("should reject requests with malformed Authorization header format", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", "Basic dXNlcjpwYXNz");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Authentication required",
      });
    });
  });

  describe("Security Headers & Environment Protections", () => {
    it("should include standard security headers via Helmet", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    });
  });

  describe("Test Database Guard Unit Verification", () => {
    const { assertTestDatabase } = require("./helpers/testDbGuard");
    const env = require("../src/config/env");

    it("should pass when DB_NAME points to isolated test database", () => {
      expect(() => assertTestDatabase()).not.toThrow();
    });

    it("should throw safety intercept when DB_NAME points to development database", () => {
      const originalDb = env.DB_NAME;
      try {
        env.DB_NAME = "personal_finance_db";
        expect(() => assertTestDatabase()).toThrow(/SAFETY INTERCEPT/);
      } finally {
        env.DB_NAME = originalDb;
      }
    });

    it("should throw safety intercept when DB_NAME does not contain test", () => {
      const originalDb = env.DB_NAME;
      try {
        env.DB_NAME = "production_db";
        expect(() => assertTestDatabase()).toThrow(/SAFETY INTERCEPT/);
      } finally {
        env.DB_NAME = originalDb;
      }
    });
  });
});


