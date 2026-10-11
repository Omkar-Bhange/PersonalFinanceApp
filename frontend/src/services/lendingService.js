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

  async updateLendingRecord(id, data) {
    const response = await api.put(`/lending/${id}`, data);
    return response.data;
  },

  async topUpLendingRecord(id, data) {
    const response = await api.post(`/lending/${id}/topup`, data);
    return response.data;
  },

  async deleteLendingRecord(id) {
    const response = await api.delete(`/lending/${id}`);
    return response.data;
  },

  async deleteRepayment(lendingId, repaymentId) {
    const response = await api.delete(`/lending/${lendingId}/repayments/${repaymentId}`);
    return response.data;
  },
};

