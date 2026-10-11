
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

async function updateCategory(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid category ID",
    });
  }

  try {
    const { name, icon, color } = req.body;

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

    const catCheck = await pool.query(
      `SELECT id, user_id FROM categories WHERE id = $1`,
      [id]
    );

    if (catCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (catCheck.rows[0].user_id === null) {
      return res.status(403).json({
        success: false,
        message: "Default system categories cannot be modified. You can create a custom category instead.",
      });
    }

    if (String(catCheck.rows[0].user_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to modify this category",
      });
    }

    const cleanIcon = typeof icon === "string" && icon.trim().length > 0 ? icon.trim() : null;
    const cleanColor = typeof color === "string" && color.trim().length > 0 ? color.trim() : null;

    const result = await pool.query(
      `UPDATE categories
       SET name = $1, icon = $2, color = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, name, category_type, icon, color, created_at`,
      [name.trim(), cleanIcon, cleanColor, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    console.error("Update category failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update category",
    });
  }
}

async function deleteCategory(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid category ID",
    });
  }

  try {
    const catCheck = await pool.query(
      `SELECT id, user_id FROM categories WHERE id = $1`,
      [id]
    );

    if (catCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (catCheck.rows[0].user_id === null) {
      return res.status(403).json({
        success: false,
        message: "Default system categories cannot be deleted",
      });
    }

    if (String(catCheck.rows[0].user_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this category",
      });
    }

    const txCheck = await pool.query(
      `SELECT id FROM transactions WHERE category_id = $1 AND user_id = $2 LIMIT 1`,
      [id, req.user.id]
    );

    if (txCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category because it is used in existing transactions. Please reassign or delete them first.",
      });
    }

    await pool.query(
      `DELETE FROM categories WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to delete category",
    });
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};

