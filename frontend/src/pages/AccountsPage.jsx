import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Building2,
  Banknote,
  Layers,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { accountService } from "../services/accountService";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, formatDate } from "../utils/currency";

const accountTypeIcons = {
  BANK: Building2,
  CASH: Banknote,
  WALLET: Wallet,
  OTHER: Layers,
};

const accountTypeLabels = {
  BANK: "Bank Account",
  CASH: "Cash in Hand",
  WALLET: "Digital Wallet",
  OTHER: "Other Account",
};

export function AccountsPage() {
  const { user } = useAuth();
  const userCurrency = user?.currency || "INR";

  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Account creation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    account_type: "BANK",
    opening_balance: "0",
  });
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await accountService.getAccounts();
      if (response?.success && Array.isArray(response.data)) {
        setAccounts(response.data);
      } else {
        setAccounts([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load accounts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleOpenModal = () => {
    setFormData({
      name: "",
      account_type: "BANK",
      opening_balance: "0",
    });
    setFormErrors({});
    setFormServerError("");
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = "Account name is required";
    } else if (formData.name.trim().length > 100) {
      errors.name = "Name cannot exceed 100 characters";
    }

    if (!["CASH", "BANK", "WALLET", "OTHER"].includes(formData.account_type)) {
      errors.account_type = "Please select a valid account type";
    }

    const numBalance = parseFloat(formData.opening_balance);
    if (isNaN(numBalance)) {
      errors.opening_balance = "Opening balance must be a valid number";
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

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormServerError("");

    try {
      const response = await accountService.createAccount({
        name: formData.name.trim(),
        account_type: formData.account_type,
        opening_balance: parseFloat(formData.opening_balance) || 0,
      });

      if (response?.success) {
        setIsModalOpen(false);
        setSuccessMessage(`Account "${formData.name.trim()}" created successfully!`);
        setTimeout(() => setSuccessMessage(""), 4000);
        await fetchAccounts();
      }
    } catch (err) {
      setFormServerError(err.message || "Failed to create account. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggregated totals across all accounts
  const totalCombinedBalance = accounts.reduce(
    (acc, item) => acc + (parseFloat(item.current_balance) || 0),
    0
  );
  const totalCombinedIncome = accounts.reduce(
    (acc, item) => acc + (parseFloat(item.total_income) || 0),
    0
  );
  const totalCombinedExpenses = accounts.reduce(
    (acc, item) => acc + (parseFloat(item.total_expenses) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Accounts & Balances
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your bank accounts, cash wallets, and track reconciled balances
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAccounts}
            disabled={isLoading}
            className="flex items-center space-x-1.5"
            title="Refresh accounts"
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
            <span>Add Account</span>
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
            <p className="font-medium">Failed to load accounts</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAccounts}>
            Retry
          </Button>
        </div>
      )}

      {/* Account Balance Summary Cards */}
      {!isLoading && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-md">
            <CardContent className="p-5">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
                Total Net Balance
              </span>
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1 block">
                {formatCurrency(totalCombinedBalance, userCurrency)}
              </span>
              <span className="text-xs text-emerald-400 mt-2 block">
                Reconciled across {accounts.length} active {accounts.length === 1 ? "account" : "accounts"}
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Income Logged
                </span>
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
                {formatCurrency(totalCombinedIncome, userCurrency)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                Cumulative transaction credits
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Expenses Logged
                </span>
                <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
                {formatCurrency(totalCombinedExpenses, userCurrency)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                Cumulative transaction debits
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Accounts Grid / Table */}
      {isLoading ? (
        <Card className="p-12 text-center border-slate-200/80">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-slate-500">Loading your accounts...</span>
          </div>
        </Card>
      ) : accounts.length === 0 ? (
        /* Empty State */
        <Card className="p-8 sm:p-12 text-center border-slate-200/80">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
              <PiggyBank className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">No accounts registered yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                Create your primary checking account, savings, or cash wallet to start tracking income and expenses.
              </p>
            </div>
            <Button variant="primary" onClick={handleOpenModal} className="mt-2">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Create Your First Account</span>
            </Button>
          </div>
        </Card>
      ) : (
        /* Accounts Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account) => {
            const Icon = accountTypeIcons[account.account_type] || Layers;
            return (
              <Card key={account.id} className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="p-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs">
                        <Icon className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base truncate max-w-[180px]">
                          {account.name}
                        </CardTitle>
                        <Badge variant="neutral" className="mt-0.5 text-[11px]">
                          {accountTypeLabels[account.account_type] || account.account_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-3 space-y-4">
                  {/* Current Reconciled Balance */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Current Reconciled Balance
                    </span>
                    <span className="text-2xl font-bold text-slate-900 mt-0.5 block">
                      {formatCurrency(account.current_balance, userCurrency)}
                    </span>
                  </div>

                  {/* Account Detail Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Opening
                      </span>
                      <span className="text-xs font-medium text-slate-700 mt-0.5 block truncate">
                        {formatCurrency(account.opening_balance, userCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 uppercase font-semibold block">
                        + Income
                      </span>
                      <span className="text-xs font-medium text-emerald-700 mt-0.5 block truncate">
                        {formatCurrency(account.total_income, userCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-600 uppercase font-semibold block">
                        - Expense
                      </span>
                      <span className="text-xs font-medium text-rose-700 mt-0.5 block truncate">
                        {formatCurrency(account.total_expenses, userCurrency)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 text-right pt-1">
                    Created {formatDate(account.created_at)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Account Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title="Add New Account"
        description="Configure a new account or wallet to track balances and transactions"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4" noValidate>
          {formServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{formServerError}</span>
            </div>
          )}

          <div>
            <Input
              label="Account Name"
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Primary Checking, Cash Wallet"
              value={formData.name}
              onChange={handleFormChange}
              error={formErrors.name}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="account_type"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Account Type
            </label>
            <select
              id="account_type"
              name="account_type"
              value={formData.account_type}
              onChange={handleFormChange}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
            >
              <option value="BANK">Bank Account</option>
              <option value="CASH">Cash in Hand</option>
              <option value="WALLET">Digital Wallet</option>
              <option value="OTHER">Other / Investment</option>
            </select>
            {formErrors.account_type && (
              <p className="mt-1.5 text-xs text-rose-600">{formErrors.account_type}</p>
            )}
          </div>

          <div>
            <Input
              label={`Opening Balance (${userCurrency})`}
              id="opening_balance"
              name="opening_balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.opening_balance}
              onChange={handleFormChange}
              error={formErrors.opening_balance}
              helperText="Initial amount in this account before any recorded transactions"
              disabled={isSubmitting}
            />
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
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

