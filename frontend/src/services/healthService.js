import api from "./api";

export const healthService = {
  async checkHealth() {
    const response = await api.get("/health");
    return response.data;
  },
};

