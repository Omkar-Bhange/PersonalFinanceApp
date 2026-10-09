import api from "./api";

export const lendingService = {
  async getLendingRecords(filters = {}) {
    const params = new URLSearchParams();
    if (filters.direction) {
      params.append("direction", filters.direction);
    }
    const queryString = params.toString();
    const url = queryString ? `/lending?${queryString}` : "/lending";

    const response = await api.get(url);
    return response.data;
  },

  async getLendingSummary() {
    const response = await api.get("/lending/summary");
    return response.data;
  },

  async getLendingRecordById(id) {
    const response = await api.get(`/lending/${id}`);
    return response.data;
  },

  async createLendingRecord(data) {
    const response = await api.post("/lending", data);
    return response.data;
  },

  async createRepayment(lendingId, data) {
    const response = await api.post(`/lending/${lendingId}/repayments`, data);
    return response.data;
  },
};

