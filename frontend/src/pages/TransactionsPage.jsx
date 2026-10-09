import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeftRight,
  Plus,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  Tags,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { transactionService } from "../services/transactionService";
import { accountService } from "../services/accountService";
import { categoryService } from "../services/categoryService";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, formatDate } from "../utils/currency";

export function TransactionsPage() {
  const { user } = useAuth();
  const userCurrency = user?.currency || "INR";

  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filtering states
  const [filterType, setFilterType] = useState(""); // "" | "INCOME" | "EXPENSE"
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Transaction Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    account_id: "",
    category_id: "",
    transaction_type: "EXPENSE",
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "",
    merchant: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load dropdown resources (accounts & categories)
  const fetchResources = useCallback(async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        accountService.getAccounts(),
        categoryService.getCategories(),
      ]);

      if (accRes?.success && Array.isArray(accRes.data)) {
        setAccounts(accRes.data);
      }
      if (catRes?.success && Array.isArray(catRes.data)) {
        setCategories(catRes.data);
      }
    } catch (err) {
      console.error("Failed to load accounts/categories for transactions:", err.message);
    }
  }, []);

  // Fetch transactions with active filters
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const filters = {};
      if (filterType) filters.transaction_type = filterType;
      if (filterFrom) filters.from = filterFrom;
      if (filterTo) filters.to = filterTo;

      const response = await transactionService.getTransactions(filters);
      if (response?.success && Array.isArray(response.data)) {
        setTransactions(response.data);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load transactions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [filterType, filterFrom, filterTo]);

  useEffect(() => {
    fetchResources();
    fetchTransactions();
  }, [fetchResources, fetchTransactions]);

  const handleOpenModal = () => {
    setFormData({
      account_id: accounts.length > 0 ? String(accounts[0].id) : "",
      category_id: "",
      transaction_type: "EXPENSE",
      amount: "",
      transaction_date: new Date().toISOString().slice(0, 10),
      description: "",
      merchant: "",
      notes: "",
    });
    setFormErrors({});
    setFormServerError("");
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.account_id) {
      errors.account_id = "Please select an account";
    }

    if (!["INCOME", "EXPENSE"].includes(formData.transaction_type)) {
      errors.transaction_type = "Transaction type must be INCOME or EXPENSE";
    }

    const numAmount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = "Amount must be a positive number greater than zero";
    } else if (numAmount > 999999999999.99) {
      errors.amount = "Amount exceeds the maximum supported balance";
    }

    if (!formData.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(formData.transaction_date)) {
      errors.transaction_date = "Please enter a valid date in YYYY-MM-DD format";
    }

    if (formData.description && formData.description.length > 255) {
      errors.description = "Description must not exceed 255 characters";
    }

    if (formData.merchant && formData.merchant.length > 150) {
      errors.merchant = "Merchant name must not exceed 150 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (formServerError) {
      setFormServerError("");
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormServerError("");

    try {
      const payload = {
        account_id: Number(formData.account_id),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        transaction_type: formData.transaction_type,
        amount: parseFloat(formData.amount),
        transaction_date: formData.transaction_date,
        description: formData.description.trim() || null,
        merchant: formData.merchant.trim() || null,
        notes: formData.notes.trim() || null,
      };

      const response = await transactionService.createTransaction(payload);

      if (response?.success) {
        setIsModalOpen(false);
        setSuccessMessage("Transaction recorded successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchTransactions(), fetchResources()]);
      }
    } catch (err) {
      setFormServerError(err.message || "Failed to create transaction. Please verify your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setFilterType("");
    setFilterFrom("");
    setFilterTo("");
  };

  // Filter categories by selected transaction type
  const availableCategories = categories.filter(
    (c) => c.category_type === formData.transaction_type
  );

  // Helper lookups for table rendering
  const accountMap = new Map(accounts.map((a) => [String(a.id), a]));
  const categoryMap = new Map(categories.map((c) => [String(c.id), c]));

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Transactions History
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Track and record your day-to-day income credits and expense debits
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTransactions}
            disabled={isLoading}
            className="flex items-center space-x-1.5"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenModal}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Transaction</span>
          </Button>
        </div>
      </div>

      {/* Global Success Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center space-x-2.5 text-emerald-800 text-sm shadow-xs animate-fadeIn"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start space-x-3 text-rose-800 text-sm animate-fadeIn"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Failed to load transactions</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTransactions}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters Bar Card */}
      <Card className="p-4 border-slate-200/80 bg-white shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Type Filter
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">All Transactions</option>
              <option value="INCOME">Income Only</option>
              <option value="EXPENSE">Expense Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex space-x-2">
            {(filterType || filterFrom || filterTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="w-full text-xs text-slate-500 hover:text-slate-900"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Transactions List / Table */}
      {isLoading ? (
        <Card className="p-12 text-center border-slate-200/80">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-slate-500">Loading transactions...</span>
          </div>
        </Card>
      ) : transactions.length === 0 ? (
        /* Empty State */
        <Card className="p-8 sm:p-12 text-center border-slate-200/80">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
              <ArrowLeftRight className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {filterType || filterFrom || filterTo
                  ? "No transactions match your filters"
                  : "No transactions recorded yet"}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {filterType || filterFrom || filterTo
                  ? "Try adjusting or resetting your search filter parameters."
                  : "Start logging your income credits and daily expense debits."}
              </p>
            </div>
            {filterType || filterFrom || filterTo ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear Active Filters
              </Button>
            ) : (
              <Button variant="primary" onClick={handleOpenModal} className="mt-2">
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Record Your First Transaction</span>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        /* Transactions Table Card */
        <Card className="overflow-hidden border-slate-200/80 shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-4">Description / Merchant</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Account</th>
                  <th className="py-3.5 px-4 text-center">Type</th>
                  <th className="py-3.5 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.map((tx) => {
                  const isIncome = tx.transaction_type === "INCOME";
                  const account = accountMap.get(String(tx.account_id));
                  const category = categoryMap.get(String(tx.category_id));

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-slate-700 whitespace-nowrap">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block truncate max-w-xs">
                          {tx.description || (isIncome ? "Income Credit" : "Expense Debit")}
                        </span>
                        {tx.merchant && (
                          <span className="text-xs text-slate-400 block truncate max-w-xs">
                            {tx.merchant}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {category ? (
                          <Badge variant={isIncome ? "success" : "neutral"} className="text-xs">
                            {category.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-xs font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{account ? account.name : `Account #${tx.account_id}`}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant={isIncome ? "success" : "danger"}
                          className="font-semibold uppercase tracking-wider text-[10px]"
                        >
                          {tx.transaction_type}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                        <span
                          className={isIncome ? "text-emerald-600" : "text-slate-900"}
                        >
                          {isIncome ? "+" : "-"} {formatCurrency(tx.amount, userCurrency)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {transactions.map((tx) => {
              const isIncome = tx.transaction_type === "INCOME";
              const account = accountMap.get(String(tx.account_id));
              const category = categoryMap.get(String(tx.category_id));

              return (
                <div key={tx.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {tx.description || (isIncome ? "Income Credit" : "Expense Debit")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(tx.transaction_date)}
                        {tx.merchant ? ` • ${tx.merchant}` : ""}
                      </span>
                    </div>
                    <span
                      className={`text-base font-bold whitespace-nowrap ${
                        isIncome ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {isIncome ? "+" : "-"} {formatCurrency(tx.amount, userCurrency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-600 flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{account ? account.name : `Account #${tx.account_id}`}</span>
                    </span>
                    {category ? (
                      <Badge variant={isIncome ? "success" : "neutral"} className="text-[10px]">
                        {category.name}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Uncategorized</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Transaction Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title="Record New Transaction"
        description="Add an income credit or expense debit to your accounts"
      >
        <form onSubmit={handleCreateTransaction} className="space-y-4" noValidate>
          {formServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{formServerError}</span>
            </div>
          )}

          {/* Transaction Type Radio Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    transaction_type: "EXPENSE",
                    category_id: "",
                  }))
                }
                className={`py-2 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  formData.transaction_type === "EXPENSE"
                    ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                <span>Expense Debit</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    transaction_type: "INCOME",
                    category_id: "",
                  }))
                }
                className={`py-2 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  formData.transaction_type === "INCOME"
                    ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span>Income Credit</span>
              </button>
            </div>
          </div>

          {/* Amount & Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label={`Amount (${userCurrency})`}
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleFormChange}
                error={formErrors.amount}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div>
              <Input
                label="Transaction Date"
                id="transaction_date"
                name="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={handleFormChange}
                error={formErrors.transaction_date}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Account Selection */}
          <div>
            <label
              htmlFor="account_id"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Account
            </label>
            <select
              id="account_id"
              name="account_id"
              value={formData.account_id}
              onChange={handleFormChange}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
            >
              {accounts.length === 0 ? (
                <option value="">No accounts available (create one first)</option>
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.current_balance, userCurrency)})
                  </option>
                ))
              )}
            </select>
            {formErrors.account_id && (
              <p className="mt-1.5 text-xs text-rose-600">{formErrors.account_id}</p>
            )}
          </div>

          {/* Category Selection */}
          <div>
            <label
              htmlFor="category_id"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Category (Optional)
            </label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleFormChange}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
            >
              <option value="">Uncategorized</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat.user_id ? "(Custom)" : "(Standard)"}
                </option>
              ))}
            </select>
          </div>

          {/* Description & Merchant row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Description"
                id="description"
                name="description"
                type="text"
                placeholder="e.g. Monthly salary, Grocery run"
                value={formData.description}
                onChange={handleFormChange}
                error={formErrors.description}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Input
                label="Merchant / Payee"
                id="merchant"
                name="merchant"
                type="text"
                placeholder="e.g. Amazon, Supermarket"
                value={formData.merchant}
                onChange={handleFormChange}
                error={formErrors.merchant}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              Record Transaction
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

