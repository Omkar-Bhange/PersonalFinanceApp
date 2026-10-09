import api from "./api";

export const transactionService = {
  async getTransactions(filters = {}) {
    const params = new URLSearchParams();

    if (filters.transaction_type) {
      params.append("transaction_type", filters.transaction_type);
    }
    if (filters.from) {
      params.append("from", filters.from);
    }
    if (filters.to) {
      params.append("to", filters.to);
    }
    if (filters.limit) {
      params.append("limit", filters.limit);
    }

    const queryString = params.toString();
    const url = queryString ? `/transactions?${queryString}` : "/transactions";

    const response = await api.get(url);
    return response.data;
  },

  async createTransaction(data) {
    const response = await api.post("/transactions", data);
    return response.data;
  },

  async getMonthlySummary(month) {
    const url = month ? `/transactions/summary?month=${month}` : "/transactions/summary";
    const response = await api.get(url);
    return response.data;
  },
};

