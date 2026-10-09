import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  HandCoins,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  PieChart,
  BarChart3,
  Building2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { accountService } from "../services/accountService";
import { transactionService } from "../services/transactionService";
import { lendingService } from "../services/lendingService";
import { categoryService } from "../services/categoryService";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, formatDate } from "../utils/currency";

function getCurrentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthStr) {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function getAdjacentMonth(monthStr, offset) {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

// Category palette for progress visualization
const CATEGORY_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-slate-500",
];

export function HomePage() {
  const { user } = useAuth();
  const userCurrency = user?.currency || "INR";

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthString());
  const isCurrentMonth = selectedMonth === getCurrentMonthString();

  // Data states
  const [accounts, setAccounts] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [lendingSummary, setLendingSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errors, setErrors] = useState({
    accounts: null,
    summary: null,
    lending: null,
    transactions: null,
  });

  // Resource maps for category and account names
  const accountMap = useMemo(() => {
    return accounts.reduce((acc, a) => {
      acc[a.id] = a.name;
      return acc;
    }, {});
  }, [accounts]);

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, c) => {
      acc[c.id] = c.name;
      return acc;
    }, {});
  }, [categories]);

  // Derived account totals
  const totalAccountBalance = useMemo(() => {
    if (!Array.isArray(accounts)) return 0;
    return accounts.reduce((sum, acc) => {
      const balance = parseFloat(acc.current_balance) || 0;
      return sum + balance;
    }, 0);
  }, [accounts]);

  const activeAccountsCount = useMemo(() => {
    if (!Array.isArray(accounts)) return 0;
    return accounts.filter((a) => a.is_active !== false).length;
  }, [accounts]);

  // Fetch all dashboard data safely using Promise.allSettled
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);

    const newErrors = {
      accounts: null,
      summary: null,
      lending: null,
      transactions: null,
    };

    const results = await Promise.allSettled([
      accountService.getAccounts(),
      transactionService.getMonthlySummary(selectedMonth),
      lendingService.getLendingSummary(),
      transactionService.getTransactions({ limit: 5 }),
      categoryService.getCategories(),
    ]);

    // 1. Accounts Result
    if (results[0].status === "fulfilled" && results[0].value?.success) {
      setAccounts(results[0].value.data || []);
    } else {
      newErrors.accounts = results[0].reason?.message || "Failed to load accounts";
    }

    // 2. Monthly Summary Result
    if (results[1].status === "fulfilled" && results[1].value?.success) {
      setMonthlySummary(results[1].value.data || null);
    } else {
      newErrors.summary = results[1].reason?.message || "Failed to load monthly summary";
    }

    // 3. Lending Summary Result
    if (results[2].status === "fulfilled" && results[2].value?.success) {
      setLendingSummary(results[2].value.data || null);
    } else {
      newErrors.lending = results[2].reason?.message || "Failed to load lending summary";
    }

    // 4. Recent Transactions Result
    if (results[3].status === "fulfilled" && results[3].value?.success) {
      setRecentTransactions(results[3].value.data || []);
    } else {
      newErrors.transactions = results[3].reason?.message || "Failed to load recent activity";
    }

    // 5. Categories Result (optional lookup)
    if (results[4].status === "fulfilled" && results[4].value?.success) {
      setCategories(results[4].value.data || []);
    }

    setErrors(newErrors);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => getAdjacentMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => getAdjacentMonth(prev, 1));
  };

  const handleResetCurrentMonth = () => {
    setSelectedMonth(getCurrentMonthString());
  };

  // Helper values from monthly summary
  const totalIncome = parseFloat(monthlySummary?.total_income) || 0;
  const totalExpenses = parseFloat(monthlySummary?.total_expenses) || 0;
  const netSavings = parseFloat(monthlySummary?.net_savings) || 0;
  const percentageChanges = monthlySummary?.percentage_change || {};
  const previousMonthData = monthlySummary?.previous_month || null;

  const totalReceivables = parseFloat(lendingSummary?.total_receivables) || 0;
  const totalPayables = parseFloat(lendingSummary?.total_payables) || 0;
  const overdueLendingCount = lendingSummary?.overdue_count || 0;
  const activeLendingCount = (lendingSummary?.open_count || 0) + (lendingSummary?.partially_settled_count || 0);

  // Savings rate calculation
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : null;

  // Expense to Income ratio
  const expenseRatio = totalIncome > 0 ? Math.min(100, Math.max(0, (totalExpenses / totalIncome) * 100)) : totalExpenses > 0 ? 100 : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header & Month Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Financial Dashboard
            </h1>
            {!isCurrentMonth && (
              <Badge variant="info" className="text-xs">
                Historical View
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Welcome back, <span className="font-medium text-slate-800">{user?.full_name || user?.email || "User"}</span>. Here is your live financial snapshot for {formatMonthLabel(selectedMonth)}.
          </p>
        </div>

        {/* Month Navigation & Refresh Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector Buttons */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              aria-label="Previous Month"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative px-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                aria-label="Select month"
              />
              <div className="flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-slate-800 pointer-events-none py-1 px-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatMonthLabel(selectedMonth)}</span>
              </div>
            </div>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              aria-label="Next Month"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetCurrentMonth}
              className="text-xs h-9"
            >
              Current Month
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            title="Refresh live data"
            aria-label="Refresh dashboard data"
            className="text-slate-600 hover:text-slate-900 h-9 px-2.5"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Global Section Error Notice if any service failed */}
      {(errors.accounts || errors.summary || errors.lending || errors.transactions) && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">Some dashboard metrics could not be loaded</p>
            <p className="text-amber-700">
              {[errors.accounts, errors.summary, errors.lending, errors.transactions]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData()}
            className="text-xs shrink-0 border-amber-300 hover:bg-amber-100"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 6 Core Financial Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. Total Account Balance */}
        <Card className="relative overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Account Balance
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {formatCurrency(totalAccountBalance, userCurrency)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Across {activeAccountsCount} active {activeAccountsCount === 1 ? "account" : "accounts"}</span>
              </span>
              <Link to="/accounts" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                View Accounts →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 2. Monthly Income */}
        <Card className="relative overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Monthly Income
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600 tracking-tight">
                  {formatCurrency(totalIncome, userCurrency)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>
                {percentageChanges.income !== null && percentageChanges.income !== undefined ? (
                  <span className={`inline-flex items-center font-medium ${percentageChanges.income >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {percentageChanges.income >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    )}
                    {Math.abs(percentageChanges.income)}% vs last month
                  </span>
                ) : previousMonthData ? (
                  <span>Prev: {formatCurrency(previousMonthData.total_income, userCurrency)}</span>
                ) : (
                  <span>No prior month data</span>
                )}
              </span>
              <span className="text-slate-400">{formatMonthLabel(selectedMonth)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Monthly Expenses */}
        <Card className="relative overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Monthly Expenses
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-rose-600 tracking-tight">
                  {formatCurrency(totalExpenses, userCurrency)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>
                {percentageChanges.expenses !== null && percentageChanges.expenses !== undefined ? (
                  <span className={`inline-flex items-center font-medium ${percentageChanges.expenses <= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {percentageChanges.expenses <= 0 ? (
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    )}
                    {Math.abs(percentageChanges.expenses)}% vs last month
                  </span>
                ) : previousMonthData ? (
                  <span>Prev: {formatCurrency(previousMonthData.total_expenses, userCurrency)}</span>
                ) : (
                  <span>No prior month data</span>
                )}
              </span>
              <span className="text-slate-400">{formatMonthLabel(selectedMonth)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Monthly Net Savings */}
        <Card className="relative overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Monthly Net Savings
              </span>
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <PiggyBank className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
              ) : (
                <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${netSavings >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                  {formatCurrency(netSavings, userCurrency)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>
                {savingsRate !== null ? (
                  <span className={`font-semibold ${parseFloat(savingsRate) >= 20 ? "text-emerald-600" : parseFloat(savingsRate) > 0 ? "text-blue-600" : "text-rose-600"}`}>
                    {savingsRate}% savings rate
                  </span>
                ) : (
                  <span>Income: {formatCurrency(totalIncome, userCurrency)}</span>
                )}
              </span>
              {percentageChanges.net_savings !== null && percentageChanges.net_savings !== undefined ? (
                <span className="text-slate-500">
                  {percentageChanges.net_savings >= 0 ? "+" : ""}
                  {percentageChanges.net_savings}% mom
                </span>
              ) : (
                <span className="text-slate-400">Net flow</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Total Receivables (Lent) */}
        <Card className="relative overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Receivables (Lent)
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <HandCoins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-amber-700 tracking-tight">
                  {formatCurrency(totalReceivables, userCurrency)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Money owed to you</span>
              <Link to="/lending" className="text-amber-700 hover:text-amber-800 font-medium hover:underline">
                View Loans →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 6. Total Payables (Borrowed) */}
        <Card className="relative overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Payables (Borrowed)
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-purple-700 tracking-tight">
                  {formatCurrency(totalPayables, userCurrency)}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>
                {overdueLendingCount > 0 ? (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {overdueLendingCount} overdue
                  </span>
                ) : (
                  <span>Money you owe</span>
                )}
              </span>
              <Link to="/lending" className="text-purple-700 hover:text-purple-800 font-medium hover:underline">
                View Debts →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Cash Flow Analysis & Expense Category Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Cash Flow Comparison Bar Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    <CardTitle>Cash Flow Overview</CardTitle>
                  </div>
                  <CardDescription>
                    Income vs Expense ratio for {formatMonthLabel(selectedMonth)}
                  </CardDescription>
                </div>
                <Badge variant={netSavings >= 0 ? "success" : "danger"} className="text-xs">
                  {netSavings >= 0 ? "Net Positive" : "Deficit"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 animate-pulse rounded-full" />
                  <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                </div>
              ) : (
                <>
                  {/* Proportional Cash Flow Visual Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span className="text-rose-600">Expenses: {formatCurrency(totalExpenses, userCurrency)} ({expenseRatio.toFixed(1)}%)</span>
                      <span className="text-emerald-600">Income: {formatCurrency(totalIncome, userCurrency)}</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-rose-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, expenseRatio)}%` }}
                        title={`Expenses: ${expenseRatio.toFixed(1)}%`}
                      />
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(0, 100 - expenseRatio)}%` }}
                        title={`Net Savings: ${(100 - expenseRatio).toFixed(1)}%`}
                      />
                    </div>
                  </div>

                  {/* 3 Summary Stats in Cash Flow */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-xs text-slate-500">Gross Income</div>
                      <div className="text-base font-bold text-slate-900 mt-1">
                        {formatCurrency(totalIncome, userCurrency)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {monthlySummary?.income_by_category?.length || 0} categories
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-xs text-slate-500">Total Spent</div>
                      <div className="text-base font-bold text-slate-900 mt-1">
                        {formatCurrency(totalExpenses, userCurrency)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {monthlySummary?.expenses_by_category?.length || 0} categories
                      </div>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${netSavings >= 0 ? "bg-emerald-50/60 border-emerald-100" : "bg-rose-50/60 border-rose-100"}`}>
                      <div className="text-xs text-slate-600">Net Surplus / (Deficit)</div>
                      <div className={`text-base font-bold mt-1 ${netSavings >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatCurrency(netSavings, userCurrency)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {savingsRate !== null ? `${savingsRate}% saved` : "—"}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Expenses by Category Breakdown Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <PieChart className="w-5 h-5 text-rose-600" />
                    <CardTitle>Expenses by Category</CardTitle>
                  </div>
                  <CardDescription>
                    Where your money went in {formatMonthLabel(selectedMonth)}
                  </CardDescription>
                </div>
                {monthlySummary?.expenses_by_category?.length > 0 && (
                  <Badge variant="neutral" className="text-xs">
                    {monthlySummary.expenses_by_category.length} {monthlySummary.expenses_by_category.length === 1 ? "Category" : "Categories"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 py-2">
                  <div className="h-6 bg-slate-200 animate-pulse rounded" />
                  <div className="h-6 bg-slate-200 animate-pulse rounded" />
                  <div className="h-6 bg-slate-200 animate-pulse rounded" />
                </div>
              ) : !monthlySummary?.expenses_by_category || monthlySummary.expenses_by_category.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <PieChart className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-600">No expenses recorded for this month</p>
                  <p className="text-xs text-slate-400 mt-1">Expenses logged in this month will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {monthlySummary.expenses_by_category.map((cat, idx) => {
                    const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                    const percentage = parseFloat(cat.percentage_of_total) || 0;
                    return (
                      <div key={cat.category_id || `uncat-${idx}`} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
                            <span className="font-medium text-slate-800">
                              {cat.category_name}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({cat.transaction_count} {cat.transaction_count === 1 ? "txn" : "txns"})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 font-semibold">
                            <span className="text-slate-900">{formatCurrency(cat.total_amount, userCurrency)}</span>
                            <span className="text-xs text-slate-400 font-normal w-12 text-right">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colorClass} transition-all duration-500 rounded-full`}
                            style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Lending Snapshot & Quick Actions */}
        <div className="space-y-6">
          {/* Lending & Borrowing Portfolio Snapshot Widget */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HandCoins className="w-5 h-5 text-amber-600" />
                  <CardTitle>Lending & Borrowing</CardTitle>
                </div>
                <Link to="/lending">
                  <Button variant="ghost" size="sm" className="text-xs h-8 px-2 text-slate-600">
                    Manage →
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Summary of outstanding loans and liabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3 py-2">
                  <div className="h-12 bg-slate-200 animate-pulse rounded-xl" />
                  <div className="h-12 bg-slate-200 animate-pulse rounded-xl" />
                </div>
              ) : (
                <>
                  {/* Overdue Warning Alert if any */}
                  {overdueLendingCount > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>{overdueLendingCount} record{overdueLendingCount === 1 ? "" : "s"} overdue!</strong> Please review repayment dates.
                      </span>
                    </div>
                  )}

                  {/* Summary Rows */}
                  <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-amber-900">Total Receivables</div>
                      <div className="text-xs text-amber-700">Money lent to others</div>
                    </div>
                    <div className="text-base font-bold text-amber-800">
                      {formatCurrency(totalReceivables, userCurrency)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-purple-900">Total Payables</div>
                      <div className="text-xs text-purple-700">Money borrowed from others</div>
                    </div>
                    <div className="text-base font-bold text-purple-800">
                      {formatCurrency(totalPayables, userCurrency)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Active Loan Records:</span>
                      <span className="font-semibold text-slate-900">{activeLendingCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Settled Records:</span>
                      <span className="font-semibold text-slate-900">{lendingSummary?.settled_count || 0}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                    <strong>Note:</strong> Account balances dynamically reflect cash movements from loans and repayments. Receivables and payables represent open counterparty obligations.
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Shortcuts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Quick Actions
              </CardTitle>
              <CardDescription>
                Fast access to essential daily workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Link to="/transactions" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-10 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all">
                  <Plus className="w-4 h-4 mr-2 text-emerald-600" />
                  <span>Record Transaction</span>
                </Button>
              </Link>
              <Link to="/accounts" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-10 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all">
                  <Wallet className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Add or Manage Accounts</span>
                </Button>
              </Link>
              <Link to="/lending" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-10 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all">
                  <HandCoins className="w-4 h-4 mr-2 text-amber-600" />
                  <span>Record Loan or Debt</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-slate-700" />
                <CardTitle>Recent Activity</CardTitle>
              </div>
              <CardDescription>
                Latest transactions recorded across all your accounts
              </CardDescription>
            </div>
            <Link to="/transactions">
              <Button variant="outline" size="sm" className="text-xs h-8 flex items-center space-x-1.5">
                <span>View All Transactions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-2">
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ArrowLeftRight className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No transactions recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Get started by creating your first income or expense transaction.</p>
              <div className="mt-4">
                <Link to="/transactions">
                  <Button variant="primary" size="sm" className="text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Record Transaction
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Account</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => {
                    const isIncome = tx.transaction_type === "INCOME";
                    const accountName = accountMap[tx.account_id] || `Account #${tx.account_id}`;
                    const categoryName = tx.category_id
                      ? categoryMap[tx.category_id] || `Category #${tx.category_id}`
                      : "Uncategorized";

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 text-slate-600 whitespace-nowrap">
                          {formatDate(tx.transaction_date)}
                        </td>
                        <td className="py-3.5 font-medium text-slate-900 max-w-xs truncate">
                          {tx.description || tx.merchant || categoryName}
                        </td>
                        <td className="py-3.5 whitespace-nowrap">
                          <Badge variant="neutral" className="text-xs font-normal">
                            {categoryName}
                          </Badge>
                        </td>
                        <td className="py-3.5 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            {accountName}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-semibold whitespace-nowrap">
                          <span className={isIncome ? "text-emerald-600" : "text-slate-900"}>
                            {isIncome ? "+" : "-"}
                            {formatCurrency(tx.amount, userCurrency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
