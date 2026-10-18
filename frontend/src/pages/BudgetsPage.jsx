import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Target,
  Sparkles,
  Bot,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Send,
  Zap,
  TrendingUp,
  PieChart,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  HelpCircle,
  Lightbulb,
  Award,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { budgetService } from "../services/budgetService";
import { categoryService } from "../services/categoryService";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../hooks/useAuth";

export function BudgetsPage() {
  const { user } = useAuth();
  const userCurrency = user?.currency || "INR";

  // Current Month State (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Data States
  const [budgetData, setBudgetData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // AI Advisor States
  const [advisorInsights, setAdvisorInsights] = useState(null);
  const [isLoadingAdvisor, setIsLoadingAdvisor] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  // Interactive AI Advisor Q&A States
  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);

  // Set / Edit Budget Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null); // null if creating new
  const [isOverallMode, setIsOverallMode] = useState(false);
  const [formData, setFormData] = useState({
    category_id: "",
    amount_limit: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active Tab: "budgets" | "ai_advisor"
  const [activeTab, setActiveTab] = useState("budgets");

  // Fetch Budgets & Categories
  const fetchBudgets = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      setIsRefreshing(true);
      setError("");

      try {
        const [budgetsRes, categoriesRes] = await Promise.all([
          budgetService.getBudgets(selectedMonth),
          categoryService.getCategories(),
        ]);

        setBudgetData(budgetsRes);

        if (categoriesRes?.success && Array.isArray(categoriesRes.data)) {
          // Filter to only EXPENSE categories
          setCategories(categoriesRes.data.filter((c) => c.category_type === "EXPENSE"));
        }
      } catch (err) {
        setError(err.message || "Failed to load budget data.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedMonth]
  );

  // Fetch AI Advisor Insights
  const fetchAdvisorInsights = useCallback(async () => {
    setIsLoadingAdvisor(true);
    try {
      const insights = await budgetService.getAdvisorInsights();
      setAdvisorInsights(insights);
    } catch (err) {
      console.warn("Failed to fetch advisor insights:", err.message);
    } finally {
      setIsLoadingAdvisor(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Load AI insights when switching to advisor tab
  useEffect(() => {
    if (activeTab === "ai_advisor" && !advisorInsights && !isLoadingAdvisor) {
      fetchAdvisorInsights();
    }
  }, [activeTab, advisorInsights, isLoadingAdvisor, fetchAdvisorInsights]);

  // Month Navigation
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const next = new Date(year, month, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleCurrentMonth = () => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // Open Create Modal
  const handleOpenCreateModal = (categoryId = null, defaultAmount = "") => {
    setEditingBudget(null);
    setIsOverallMode(!categoryId);
    setFormData({
      category_id: categoryId ? String(categoryId) : "",
      amount_limit: defaultAmount ? String(defaultAmount) : "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (budget) => {
    setEditingBudget(budget);
    setIsOverallMode(budget.category_id === null);
    setFormData({
      category_id: budget.category_id ? String(budget.category_id) : "",
      amount_limit: String(budget.amount_limit),
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Submit Budget Form
  const handleSubmitBudget = async (e) => {
    e.preventDefault();
    setFormError("");

    const limitNum = parseFloat(formData.amount_limit);
    if (isNaN(limitNum) || limitNum <= 0) {
      setFormError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!isOverallMode && !formData.category_id) {
      setFormError("Please select a category.");
      return;
    }

    setIsSubmitting(true);
    try {
      await budgetService.upsertBudget({
        category_id: isOverallMode ? null : formData.category_id,
        month: selectedMonth,
        amount_limit: limitNum,
      });

      setSuccessMessage(editingBudget ? "Budget limit updated successfully!" : "New budget created successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
      setIsModalOpen(false);
      fetchBudgets(true);
    } catch (err) {
      setFormError(err.message || "Failed to save budget.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Budget
  const handleDeleteBudget = async () => {
    if (!budgetToDelete) return;
    setIsDeleting(true);
    try {
      await budgetService.deleteBudget(budgetToDelete.id);
      setSuccessMessage("Budget limit removed successfully.");
      setTimeout(() => setSuccessMessage(""), 4000);
      setBudgetToDelete(null);
      fetchBudgets(true);
    } catch (err) {
      setError(err.message || "Failed to delete budget.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto-Generate Budgets via ML/Historical baseline
  const handleAutoGenerate = async () => {
    if (
      !window.confirm(
        `Auto-generate budget limits for ${selectedMonth} based on your past 3 months of spending? Existing limits will be adjusted.`
      )
    ) {
      return;
    }

    setIsAutoGenerating(true);
    setError("");
    try {
      const res = await budgetService.autoGenerateBudgets(selectedMonth);
      setBudgetData(res);
      setSuccessMessage("Budgets auto-generated from your 3-month spending trends!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to auto-generate budgets.");
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // Ask AI Advisor
  const handleAskAdvisor = async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || question;
    if (!promptToSend.trim()) return;

    const userMsg = { role: "user", content: promptToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsAsking(true);

    try {
      const historyPayload = chatMessages.slice(-6);
      const res = await budgetService.askAdvisor(promptToSend, historyPayload);

      const botMsg = {
        role: "advisor",
        content: res.answer,
        takeaway: res.key_takeaway,
        suggestions: res.suggested_followups || [],
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "advisor",
          content: "I ran into an issue connecting to the AI model. Please try asking again in a moment.",
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  // Color helper for budget progress bar
  const getProgressColor = (percentage) => {
    if (percentage >= 100) return "bg-rose-500";
    if (percentage >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getStatusBadge = (percentage) => {
    if (percentage >= 100) {
      return <Badge variant="danger">Over Budget ({percentage}%)</Badge>;
    }
    if (percentage >= 80) {
      return <Badge variant="warning">Warning ({percentage}%)</Badge>;
    }
    return <Badge variant="success">On Track ({percentage}%)</Badge>;
  };

  // Format month name for display
  const displayMonthName = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  const summary = budgetData?.summary;
  const overallBudget = budgetData?.overall_budget;
  const categoryBudgets = budgetData?.category_budgets || [];
  const unbudgetedCategories = budgetData?.unbudgeted_categories || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Month Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-emerald-400" />
              Budgets & AI Planner
            </h1>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-medium">
              Phase 3 Live
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Track spending caps, run-rate projections, and receive data-driven AI financial advice.
          </p>
        </div>

        {/* Month Selector Bar */}
        <div className="flex items-center space-x-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevMonth}
            className="p-1 text-slate-400 hover:text-white"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="text-sm font-semibold text-slate-200 px-3 min-w-[130px] text-center">
            {displayMonthName}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="p-1 text-slate-400 hover:text-white"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCurrentMonth}
            className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800 ml-1"
          >
            Current
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("budgets")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "budgets"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Monthly Budgets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai_advisor")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "ai_advisor"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>AI Financial Advisor</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
              Gemini
            </span>
          </button>
        </div>

        {/* Action Buttons for Budgets tab */}
        {activeTab === "budgets" && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoGenerate}
              isLoading={isAutoGenerating}
              className="border-emerald-600/40 text-emerald-400 hover:bg-emerald-950/40 text-xs flex items-center space-x-1.5"
              title="Calculate suggested budget limits from past 3 months"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-Budget</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenCreateModal()}
              className="text-xs flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Set Budget</span>
            </Button>
          </div>
        )}
      </div>

      {/* Success & Error alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 rounded-xl text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-700/60 text-rose-300 rounded-xl text-sm flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ================= TAB 1: MONTHLY BUDGETS ================= */}
      {activeTab === "budgets" && (
        <div className="space-y-6">
          {/* Overall Monthly Card */}
          <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Target className="w-64 h-64 text-emerald-400" />
            </div>

            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Overall Monthly Overview
                    </span>
                    {summary && getStatusBadge(summary.percentage)}
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-1">
                    {formatCurrency(summary?.total_spent || 0, userCurrency)}
                    <span className="text-sm font-normal text-slate-400 ml-2">
                      spent of {formatCurrency(summary?.total_limit || 0, userCurrency)} limit
                    </span>
                  </h2>
                </div>

                <div className="flex items-center space-x-2">
                  {overallBudget ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(overallBudget)}
                      className="text-xs border-slate-700 hover:bg-slate-800 text-slate-300"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Edit Overall Limit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCreateModal(null)}
                      className="text-xs border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/50"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Set Overall Limit
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 mb-6">
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${getProgressColor(
                      summary?.percentage || 0
                    )}`}
                    style={{ width: `${Math.min(100, summary?.percentage || 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{summary?.percentage || 0}% consumed</span>
                  <span>
                    {summary?.total_remaining >= 0
                      ? `${formatCurrency(summary.total_remaining, userCurrency)} remaining`
                      : `${formatCurrency(Math.abs(summary.total_remaining), userCurrency)} over limit`}
                  </span>
                </div>
              </div>

              {/* KPI Run-Rate Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Days in Month</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    Day {budgetData?.calendar?.day_of_month || 0} of {budgetData?.calendar?.days_in_month || 30}
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    {budgetData?.calendar?.days_remaining || 0} days remaining
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Projected Run-Rate</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {formatCurrency(summary?.projected_spend || 0, userCurrency)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Estimated month-end total</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Transactions Logged</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {summary?.transaction_count || 0} txns
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">In {displayMonthName}</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Telegram Auto-Alerts</div>
                  <div className="text-base font-bold text-sky-400 mt-0.5 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <span>Active</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Alerts at 80% & 100%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Budgets Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                Category Budgets ({categoryBudgets.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenCreateModal()}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                + Add Category Budget
              </Button>
            </div>

            {categoryBudgets.length === 0 ? (
              <Card className="bg-slate-900/40 border-dashed border-slate-800 p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-white">No category budgets set for this month</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                  Set limits on categories like Groceries, Dining, and Fuel to keep your spending controlled, or let AI
                  generate them based on past trends.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenCreateModal()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Set First Budget
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoGenerate}
                    isLoading={isAutoGenerating}
                    className="border-slate-700 text-slate-300 text-xs"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    Auto-Generate from History
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryBudgets.map((b) => (
                  <Card
                    key={b.id}
                    className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-all shadow-md group"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                            style={{ backgroundColor: b.category_color || "#6366f1" }}
                          >
                            {b.category_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white leading-none">{b.category_name}</h4>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              {b.transaction_count} transactions
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            title="Edit Limit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setBudgetToDelete(b)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                            title="Delete Budget"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Spent vs Limit */}
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-lg font-bold text-white">
                          {formatCurrency(b.spent, userCurrency)}
                        </span>
                        <span className="text-xs text-slate-400">
                          limit {formatCurrency(b.amount_limit, userCurrency)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getProgressColor(
                            b.percentage
                          )}`}
                          style={{ width: `${Math.min(100, b.percentage)}%` }}
                        />
                      </div>

                      {/* Footer Stats */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                        <span>
                          {b.remaining >= 0
                            ? `₹${Math.round(b.remaining).toLocaleString("en-IN")} left`
                            : `₹${Math.round(Math.abs(b.remaining)).toLocaleString("en-IN")} over`}
                        </span>
                        <span className="font-medium text-slate-300">
                          Projected: ₹{Math.round(b.projected_spend).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Unbudgeted Categories Notice */}
          {unbudgetedCategories.length > 0 && (
            <Card className="bg-slate-900/40 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Active Categories Without Budget Caps ({unbudgetedCategories.length})
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  You spent money in these categories this month without setting a budget limit:
                </p>
                <div className="flex flex-wrap gap-2">
                  {unbudgetedCategories.map((cat) => (
                    <button
                      key={cat.category_id}
                      type="button"
                      onClick={() => handleOpenCreateModal(cat.category_id, Math.ceil((cat.spent * 1.1) / 100) * 100)}
                      className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white transition-all cursor-pointer group"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.category_color || "#94a3b8" }}
                      />
                      <span>{cat.category_name}:</span>
                      <span className="font-semibold text-emerald-400">
                        {formatCurrency(cat.spent, userCurrency)}
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-emerald-400 ml-1">
                        + Set Cap
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================= TAB 2: AI FINANCIAL ADVISOR ================= */}
      {activeTab === "ai_advisor" && (
        <div className="space-y-6">
          {/* AI Advisor Hero Banner */}
          <Card className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-900/40">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-white">AI Financial Advisor</h2>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Trained on your last 180 days
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      {advisorInsights?.summary_headline ||
                        "Analyzing your spending patterns, recurring cash outflows, and savings velocity..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {advisorInsights?.financial_health_score !== undefined && (
                    <div className="bg-slate-950/80 px-4 py-3 rounded-2xl border border-slate-800 text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Health Score</div>
                      <div className="text-2xl font-black text-emerald-400">
                        {advisorInsights.financial_health_score}
                        <span className="text-xs font-normal text-slate-400">/100</span>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-300">
                        {advisorInsights.health_status}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAdvisorInsights}
                    isLoading={isLoadingAdvisor}
                    className="border-slate-700 hover:bg-slate-800 text-xs text-slate-300"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Re-analyze
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Spending Insights & Recommendations */}
          {isLoadingAdvisor ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
              <p className="text-sm">Synthesizing historical transaction history with Gemini AI...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Insights & Savings Opportunities */}
              <div className="lg:col-span-2 space-y-6">
                {/* Savings Opportunities */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader className="pb-3 border-b border-slate-800/80">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      Key Savings Opportunities
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      Identified high-impact ways to optimize monthly cash flow
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {advisorInsights?.savings_opportunities?.length > 0 ? (
                      advisorInsights.savings_opportunities.map((op, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-white">{op.title}</span>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                              Save ~₹{op.potential_monthly_savings?.toLocaleString("en-IN")}/mo
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{op.recommendation}</p>
                          <div className="mt-2 text-[10px] text-slate-400 font-medium">
                            Difficulty: <span className="text-slate-300">{op.difficulty || "Moderate"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No immediate savings alerts identified.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Top Expense Drivers */}
                <Card className="bg-slate-900/80 border-slate-800">
                  <CardHeader className="pb-3 border-b border-slate-800/80">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Top Expense Drivers (90-Day Analysis)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {advisorInsights?.top_expense_drivers?.length > 0 ? (
                      advisorInsights.top_expense_drivers.map((drv, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/60"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold text-white">{drv.category}</span>
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                {drv.percentage}% of spending
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{drv.insight}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-200">
                            ~₹{Math.round(drv.monthly_avg).toLocaleString("en-IN")}/mo
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Transaction history will populate expense drivers.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Practical Action Tips */}
                {advisorInsights?.actionable_tips?.length > 0 && (
                  <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-800/80">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-400" />
                        AI Financial Advisor Action Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <ul className="space-y-2">
                        {advisorInsights.actionable_tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Col: Interactive Q&A Advisor Chat Box */}
              <div className="space-y-4">
                <Card className="bg-slate-900/90 border-slate-800 flex flex-col h-[650px] shadow-xl">
                  <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Ask Your Financial Advisor
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-400">
                        Ask affordability or budgeting questions
                      </CardDescription>
                    </div>
                  </CardHeader>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center mb-2">
                          <Bot className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-semibold text-white">Ask anything about your money</h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                          E.g. "Can I afford a new phone?", "How can I cut dining expenses?", or "Am I saving enough?"
                        </p>

                        <div className="mt-4 space-y-1.5 w-full text-left">
                          <button
                            type="button"
                            onClick={(e) => handleAskAdvisor(e, "Can I afford to buy a gadget worth ₹25,000?")}
                            className="w-full text-[11px] p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
                          >
                            💡 Can I afford a gadget worth ₹25,000?
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAskAdvisor(e, "How can I save ₹5,000 more next month?")}
                            className="w-full text-[11px] p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
                          >
                            🎯 How can I save ₹5,000 next month?
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAskAdvisor(e, "What are my highest expense leaks right now?")}
                            className="w-full text-[11px] p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition-colors"
                          >
                            🔍 What are my highest expense leaks?
                          </button>
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex flex-col ${
                            msg.role === "user" ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`p-3 rounded-2xl text-xs max-w-[90%] leading-relaxed ${
                              msg.role === "user"
                                ? "bg-emerald-600 text-white rounded-br-none"
                                : "bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none shadow-md"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            {msg.takeaway && (
                              <div className="mt-2 pt-2 border-t border-slate-700/60 text-[11px] font-semibold text-emerald-300 flex items-center space-x-1">
                                <Zap className="w-3 h-3 flex-shrink-0" />
                                <span>{msg.takeaway}</span>
                              </div>
                            )}
                          </div>

                          {/* Suggested follow-up buttons */}
                          {msg.suggestions?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                              {msg.suggestions.map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={(e) => handleAskAdvisor(e, sug)}
                                  className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 px-2 py-1 rounded-md transition-colors"
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {isAsking && (
                      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/60 p-2.5 rounded-xl w-fit">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Advisor is reviewing your financial records...</span>
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleAskAdvisor} className="p-3 border-t border-slate-800 bg-slate-950/60">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask your advisor a question..."
                        disabled={isAsking}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!question.trim() || isAsking}
                        className="bg-emerald-600 hover:bg-emerald-500 px-3"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: SET / EDIT BUDGET ================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingBudget
            ? `Edit Budget: ${editingBudget.category_name}`
            : isOverallMode
            ? `Set Overall Budget for ${displayMonthName}`
            : `Set Category Budget for ${displayMonthName}`
        }
      >
        <form onSubmit={handleSubmitBudget} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Mode switch if creating new */}
          {!editingBudget && (
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsOverallMode(false);
                  setFormData((prev) => ({ ...prev, category_id: categories[0]?.id || "" }));
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  !isOverallMode
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Category Budget
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOverallMode(true);
                  setFormData((prev) => ({ ...prev, category_id: "" }));
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isOverallMode
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Overall Monthly Cap
              </button>
            </div>
          )}

          {/* Category Dropdown (if not overall mode) */}
          {!isOverallMode && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Expense Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
                disabled={!!editingBudget}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Display */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Month</label>
            <input
              type="text"
              value={displayMonthName}
              disabled
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* Amount Limit Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Monthly Limit Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="1"
                min="100"
                value={formData.amount_limit}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount_limit: e.target.value }))}
                placeholder="e.g. 5000"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Quick Amount Presets */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-[10px] text-slate-400 font-medium">Quick Presets:</span>
            {[2000, 5000, 10000, 20000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, amount_limit: String(amt) }))}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-colors"
              >
                ₹{amt.toLocaleString("en-IN")}
              </button>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-xs"
            >
              {editingBudget ? "Update Budget" : "Save Budget"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      <Modal
        isOpen={!!budgetToDelete}
        onClose={() => setBudgetToDelete(null)}
        title="Remove Budget Limit"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Are you sure you want to remove the monthly limit for{" "}
            <strong className="text-white">{budgetToDelete?.category_name}</strong>?
          </p>
          <p className="text-[11px] text-slate-400">
            Your transactions in this category will remain completely safe, but spending caps will no longer be tracked.
          </p>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBudgetToDelete(null)}
              className="text-xs text-slate-400"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteBudget}
              isLoading={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-xs"
            >
              Remove Budget
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
