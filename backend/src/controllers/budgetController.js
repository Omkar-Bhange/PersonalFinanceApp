const budgetService = require("../services/budgetService");
const aiAdvisorService = require("../services/aiAdvisorService");

async function getBudgets(req, res, next) {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    const data = await budgetService.getMonthlyBudgets(userId, month);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function upsertBudget(req, res, next) {
  try {
    const userId = req.user.id;
    const { category_id, month, amount_limit } = req.body;

    const result = await budgetService.upsertBudget(userId, {
      category_id: category_id || null,
      month,
      amount_limit,
    });

    res.status(200).json({
      success: true,
      message: "Budget saved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteBudget(req, res, next) {
  try {
    const userId = req.user.id;
    const budgetId = req.params.id;

    const result = await budgetService.deleteBudget(userId, budgetId);

    res.json({
      success: true,
      message: "Budget deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function autoGenerateBudgets(req, res, next) {
  try {
    const userId = req.user.id;
    const { month } = req.body;

    const result = await budgetService.autoGenerateBudgets(userId, month);

    res.json({
      success: true,
      message: "Budgets generated based on 3-month spending history",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getAdvisorInsights(req, res, next) {
  try {
    const userId = req.user.id;
    const insights = await aiAdvisorService.generateFinancialInsights(userId);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    next(error);
  }
}

async function askAdvisor(req, res, next) {
  try {
    const userId = req.user.id;
    const { question, history } = req.body;

    const advice = await aiAdvisorService.askAdvisor(userId, question, history);

    res.json({
      success: true,
      data: advice,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBudgets,
  upsertBudget,
  deleteBudget,
  autoGenerateBudgets,
  getAdvisorInsights,
  askAdvisor,
};
