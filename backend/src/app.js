
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const healthRoutes = require("./routes/healthRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const lendingRoutes = require("./routes/lendingRoutes");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  })
);

app.use(express.json({ limit: "100kb" }));


app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Personal Finance API is running",
  });
});

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/lending", lendingRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : 500;

  const clientMessage =
    statusCode >= 400 && statusCode < 500
      ? err.message || "Bad request"
      : "Internal server error";

  console.error(
    `[ERROR] ${req.method} ${req.originalUrl}:`,
    err.message || err
  );

  return res.status(statusCode).json({
    success: false,
    message: clientMessage,
  });
});

module.exports = app;


