
const pool = require("../config/database");

async function getCategories(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, category_type, icon, color, created_at
       FROM categories
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY category_type, name`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get categories failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve categories",
    });
  }
}

async function createCategory(req, res) {
  try {
    const { name, category_type, icon, color } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be at most 100 characters",
      });
    }

    if (!["INCOME", "EXPENSE"].includes(category_type)) {
      return res.status(400).json({
        success: false,
        message: "Category type must be INCOME or EXPENSE",
      });
    }

    if (
      icon !== undefined &&
      icon !== null &&
      (typeof icon !== "string" || icon.trim().length > 50)
    ) {
      return res.status(400).json({
        success: false,
        message: "Icon must be a string of at most 50 characters",
      });
    }

    if (
      color !== undefined &&
      color !== null &&
      (typeof color !== "string" || color.trim().length > 20)
    ) {
      return res.status(400).json({
        success: false,
        message: "Color must be a string of at most 20 characters",
      });
    }

    const cleanIcon = typeof icon === "string" && icon.trim().length > 0 ? icon.trim() : null;
    const cleanColor = typeof color === "string" && color.trim().length > 0 ? color.trim() : null;

    const result = await pool.query(
      `INSERT INTO categories (user_id, name, category_type, icon, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, name, category_type, icon, color, created_at`,
      [
        req.user.id,
        name.trim(),
        category_type,
        cleanIcon,
        cleanColor,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A category with this name and type already exists",
      });
    }

    console.error("Create category failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create category",
    });
  }
}

module.exports = {
  getCategories,
  createCategory,
};

