import api from "./api";

export const budgetService = {
  /**
   * Fetch budgets and spending progress for a given month (YYYY-MM)
   */
  async getBudgets(month) {
    const params = month ? { month } : {};
    const res = await api.get("/budgets", { params });
    return res.data?.data;
  },

  /**
   * Create or update a budget limit (overall or category-specific)
   */
  async upsertBudget({ category_id, month, amount_limit }) {
    const res = await api.post("/budgets", {
      category_id: category_id || null,
      month,
      amount_limit,
    });
    return res.data?.data;
  },

  /**
   * Delete a budget
   */
  async deleteBudget(id) {
    const res = await api.delete(`/budgets/${id}`);
    return res.data;
  },

  /**
   * Auto-generate budgets based on past 3 months spending history
   */
  async autoGenerateBudgets(month) {
    const res = await api.post("/budgets/auto-generate", { month });
    return res.data?.data;
  },

  /**
   * Fetch AI Advisor historical spending analysis & recommendations
   */
  async getAdvisorInsights() {
    const res = await api.get("/budgets/advisor-insights");
    return res.data?.data;
  },

  /**
   * Ask interactive question to AI Financial Advisor
   */
  async askAdvisor(question, history = []) {
    const res = await api.post("/budgets/ask-advisor", { question, history });
    return res.data?.data;
  },
};
