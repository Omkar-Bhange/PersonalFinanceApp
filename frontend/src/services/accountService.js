import api from "./api";

export const accountService = {
  async getAccounts() {
    const response = await api.get("/accounts");
    return response.data;
  },

  async createAccount(data) {
    const response = await api.post("/accounts", data);
    return response.data;
  },

  async updateAccount(id, data) {
    const response = await api.put(`/accounts/${id}`, data);
    return response.data;
  },
};

