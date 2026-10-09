const { z } = require("zod");
const dotenv = require("dotenv");

// Load .env before validation
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  DB_HOST: z.string().trim().min(1).default("localhost"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().trim().min(1, "DB_NAME is required"),
  DB_USER: z.string().trim().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().default(""),

  JWT_SECRET: z
    .string()
    .min(1, "JWT_SECRET is required and must not be empty"),
  JWT_EXPIRES_IN: z.string().trim().min(1).default("15m"),


  CORS_ORIGIN: z.string().trim().min(1).default("http://localhost:5173"),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      `[FATAL CONFIG ERROR] Invalid or missing environment variables:\n${errorDetails}`
    );

    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  return result.data;
}

const env = validateEnv();

module.exports = env;
