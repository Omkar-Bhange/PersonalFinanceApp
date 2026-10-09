/**
 * Formats a monetary amount safely into currency format.
 * PostgreSQL numeric strings are converted to numbers.
 */
export function formatCurrency(amount, currency = "INR") {
  const numericAmount = typeof amount === "number" ? amount : parseFloat(amount) || 0;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    // Fallback if currency code is not supported
    return `${currency} ${numericAmount.toFixed(2)}`;
  }
}

/**
 * Formats an ISO date string (YYYY-MM-DD or full timestamp) into human readable format.
 */
export function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

