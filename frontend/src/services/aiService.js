import api from "./api";

export const aiService = {
  /**
   * Parse a bank statement via file upload (PDF, CSV, image) or raw text/SMS
   * @param {{ file?: File, text?: string }} options
   */
  async parseStatement({ file, text }) {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/ai/parse-statement", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } else {
      const response = await api.post("/ai/parse-statement", { text });
      return response.data;
    }
  },

  /**
   * Auto-suggest category for a transaction
   */
  async suggestCategory({ description, merchant, amount, type }) {
    const response = await api.post("/ai/suggest-category", {
      description,
      merchant,
      amount,
      type,
    });
    return response.data;
  },
};

