import api from "./api";

export const telegramService = {
  async getStatus() {
    const response = await api.get("/telegram/status");
    return response.data;
  },

  async generateLinkCode() {
    const response = await api.post("/telegram/link-code");
    return response.data;
  },

  async unlink() {
    const response = await api.post("/telegram/unlink");
    return response.data;
  },

  async setupWebhook(webhookUrl) {
    const response = await api.post("/telegram/setup-webhook", { webhook_url: webhookUrl });
    return response.data;
  },
};
