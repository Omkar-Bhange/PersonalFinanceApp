
const { z } = require("zod");
const {
  registerUser,
  loginUser,
} = require("../services/authService");
const { createAccessToken } = require("../utils/tokenUtils");

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

async function register(req, res) {
  const validation = registrationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid registration details",
    });
  }

  try {
    const user = await registerUser(validation.data);
    const accessToken = createAccessToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: { user, accessToken },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Registration failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to register account",
    });
  }
}

async function login(req, res) {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid email or password format",
    });
  }

  try {
    const user = await loginUser(validation.data);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const accessToken = createAccessToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user, accessToken },
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
}

module.exports = { register, login };
  