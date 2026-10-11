
const { Pool } = require("pg");
const env = require("./env");

const isCloudOrSsl = env.DB_SSL || (env.DB_HOST && !["localhost", "127.0.0.1"].includes(env.DB_HOST));

const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 10,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      connectionTimeoutMillis: 5000,
      max: 10,
      idleTimeoutMillis: 30000,
      ...(isCloudOrSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };

const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;

