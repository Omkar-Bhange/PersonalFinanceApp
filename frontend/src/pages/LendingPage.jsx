import React, { useState, useEffect, useCallback } from "react";
import {
  HandCoins,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  Phone,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Search,
  Scale,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { lendingService } from "../services/lendingService";
import { accountService } from "../services/accountService";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, formatDate } from "../utils/currency";

const statusBadgeVariants = {
  OPEN: "info",
  PARTIALLY_SETTLED: "warning",
  OVERDUE: "danger",
  SETTLED: "success",
};

const statusLabels = {
  OPEN: "Open",
  PARTIALLY_SETTLED: "Partially Settled",
  OVERDUE: "Overdue",
  SETTLED: "Settled",
};

export function LendingPage() {
  const { user } = useAuth();
  const userCurrency = user?.currency || "INR";

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filters
  const [directionFilter, setDirectionFilter] = useState(""); // "" | "LENT" | "BORROWED"
  const [statusFilter, setStatusFilter] = useState(""); // "" | "OPEN" | "PARTIALLY_SETTLED" | "OVERDUE" | "SETTLED"

  // Creation Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    direction: "LENT",
    person_name: "",
    phone: "",
    principal_amount: "",
    account_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });
  const [createErrors, setCreateErrors] = useState({});
  const [createServerError, setCreateServerError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Detail & Repayment Modal state
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Repayment form state
  const [repaymentFormData, setRepaymentFormData] = useState({
    amount: "",
    account_id: "",
    repayment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [repaymentErrors, setRepaymentErrors] = useState({});
  const [repaymentServerError, setRepaymentServerError] = useState("");
  const [isSubmittingRepayment, setIsSubmittingRepayment] = useState(false);

  // Fetch accounts for form dropdowns
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await accountService.getAccounts();
      if (res?.success && Array.isArray(res.data)) {
        setAccounts(res.data);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err.message);
    }
  }, []);

  // Fetch summary and records
  const fetchLendingData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const filters = {};
      if (directionFilter) filters.direction = directionFilter;

      const [summaryRes, recordsRes] = await Promise.all([
        lendingService.getLendingSummary(),
        lendingService.getLendingRecords(filters),
      ]);

      if (summaryRes?.success) {
        setSummary(summaryRes.data);
      }
      if (recordsRes?.success && Array.isArray(recordsRes.data)) {
        setRecords(recordsRes.data);
      } else {
        setRecords([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load lending records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [directionFilter]);

  useEffect(() => {
    fetchAccounts();
    fetchLendingData();
  }, [fetchAccounts, fetchLendingData]);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setCreateFormData({
      direction: "LENT",
      person_name: "",
      phone: "",
      principal_amount: "",
      account_id: accounts.length > 0 ? String(accounts[0].id) : "",
      start_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      notes: "",
    });
    setCreateErrors({});
    setCreateServerError("");
    setIsCreateModalOpen(true);
  };

  const validateCreateForm = () => {
    const errors = {};

    if (!createFormData.person_name.trim()) {
      errors.person_name = "Person's name is required";
    } else if (createFormData.person_name.trim().length > 100) {
      errors.person_name = "Name cannot exceed 100 characters";
    }

    const numAmount = parseFloat(createFormData.principal_amount);
    if (!createFormData.principal_amount || isNaN(numAmount) || numAmount <= 0) {
      errors.principal_amount = "Principal amount must be a positive number";
    }

    if (!createFormData.account_id) {
      errors.account_id = "Please select a linked account";
    }

    if (!createFormData.start_date) {
      errors.start_date = "Start date is required";
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

    setIsCreating(true);
    setCreateServerError("");

    try {
      const payload = {
        direction: createFormData.direction,
        person_name: createFormData.person_name.trim(),
        phone: createFormData.phone.trim() || null,
        principal_amount: parseFloat(createFormData.principal_amount),
        account_id: Number(createFormData.account_id),
        start_date: createFormData.start_date,
        due_date: createFormData.due_date || null,
        notes: createFormData.notes.trim() || null,
      };

      const res = await lendingService.createLendingRecord(payload);

      if (res?.success) {
        setIsCreateModalOpen(false);
        setSuccessMessage(
          createFormData.direction === "LENT"
            ? `Recorded loan to ${createFormData.person_name.trim()} successfully!`
            : `Recorded borrowing from ${createFormData.person_name.trim()} successfully!`
        );
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchLendingData(), fetchAccounts()]);
      }
    } catch (err) {
      setCreateServerError(err.message || "Failed to create lending record.");
    } finally {
      setIsCreating(false);
    }
  };

  // Open Details & Repay Modal
  const handleOpenDetailModal = async (recordId) => {
    setSelectedRecordId(recordId);
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);
    setRepaymentServerError("");
    setRepaymentErrors({});

    try {
      const res = await lendingService.getLendingRecordById(recordId);
      if (res?.success && res.data) {
        setSelectedRecordDetail(res.data);
        setRepaymentFormData({
          amount: "",
          account_id: accounts.length > 0 ? String(accounts[0].id) : "",
          repayment_date: new Date().toISOString().slice(0, 10),
          notes: "",
        });
      }
    } catch (err) {
      setRepaymentServerError(err.message || "Failed to fetch record details.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const validateRepaymentForm = () => {
    const errors = {};
    const numAmount = parseFloat(repaymentFormData.amount);
    const outstanding = parseFloat(selectedRecordDetail?.outstanding_amount || 0);

    if (!repaymentFormData.amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = "Repayment amount must be a positive number";
    } else if (numAmount > outstanding) {
      errors.amount = `Amount cannot exceed outstanding balance of ${formatCurrency(outstanding, userCurrency)}`;
    }

    if (!repaymentFormData.account_id) {
      errors.account_id = "Please select an account";
    }

    if (!repaymentFormData.repayment_date) {
      errors.repayment_date = "Repayment date is required";
    }

    setRepaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRecordRepayment = async (e) => {
    e.preventDefault();
    if (!validateRepaymentForm()) return;

    setIsSubmittingRepayment(true);
    setRepaymentServerError("");

    try {
      const payload = {
        account_id: Number(repaymentFormData.account_id),
        amount: parseFloat(repaymentFormData.amount),
        repayment_date: repaymentFormData.repayment_date,
        notes: repaymentFormData.notes.trim() || null,
      };

      const res = await lendingService.createRepayment(selectedRecordId, payload);

      if (res?.success) {
        setSuccessMessage("Repayment recorded successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);

        // Refresh detail modal
        const refreshedDetail = await lendingService.getLendingRecordById(selectedRecordId);
        if (refreshedDetail?.success) {
          setSelectedRecordDetail(refreshedDetail.data);
          setRepaymentFormData((prev) => ({ ...prev, amount: "", notes: "" }));
        }

        // Refresh parent list & accounts
        await Promise.all([fetchLendingData(), fetchAccounts()]);
      }
    } catch (err) {
      setRepaymentServerError(err.message || "Failed to record repayment.");
    } finally {
      setIsSubmittingRepayment(false);
    }
  };

  // Client-side filtering by status
  const displayedRecords = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Lending & Borrowing
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Track receivables from money lent and payables from money borrowed
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLendingData}
            disabled={isLoading}
            className="flex items-center space-x-1.5"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Record</span>
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
            <p className="font-medium">Failed to load lending records</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLendingData}>
            Retry
          </Button>
        </div>
      )}

      {/* Portfolio Summary Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Receivables (Lent)
                </span>
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {formatCurrency(summary.total_receivables, userCurrency)}
              </span>
              <span className="text-xs text-emerald-600 mt-1 block font-medium">
                Money owed to you
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Payables (Borrowed)
                </span>
                <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {formatCurrency(summary.total_payables, userCurrency)}
              </span>
              <span className="text-xs text-rose-600 mt-1 block font-medium">
                Money you owe to others
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Net Debt Position
                </span>
                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <span
                className={`text-2xl font-bold mt-1 block ${
                  parseFloat(summary.net_position) >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {formatCurrency(summary.net_position, userCurrency)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                Receivables minus payables
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active & Overdue Records
                </span>
                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">
                  {summary.open_count + summary.partially_settled_count}
                </span>
                <span className="text-xs text-slate-500">active</span>
                {summary.overdue_count > 0 && (
                  <Badge variant="danger" className="ml-2">
                    {summary.overdue_count} Overdue
                  </Badge>
                )}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                {summary.settled_count} settled completely
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Controls Card */}
      <Card className="p-4 border-slate-200/80 bg-white shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Direction Filter
            </label>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">All (Lent & Borrowed)</option>
              <option value="LENT">Money Lent (Receivables)</option>
              <option value="BORROWED">Money Borrowed (Payables)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open (No Repayments)</option>
              <option value="PARTIALLY_SETTLED">Partially Settled</option>
              <option value="OVERDUE">Overdue</option>
              <option value="SETTLED">Settled</option>
            </select>
          </div>

          <div>
            {(directionFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDirectionFilter("");
                  setStatusFilter("");
                }}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Records Table / Grid */}
      {isLoading ? (
        <Card className="p-12 text-center border-slate-200/80">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-slate-500">Loading lending records...</span>
          </div>
        </Card>
      ) : displayedRecords.length === 0 ? (
        /* Empty State */
        <Card className="p-8 sm:p-12 text-center border-slate-200/80">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
              <HandCoins className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {directionFilter || statusFilter
                  ? "No records match your filters"
                  : "No lending or borrowing records yet"}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {directionFilter || statusFilter
                  ? "Try adjusting or clearing your filters."
                  : "Track personal loans lent to friends/family or money you borrowed."}
              </p>
            </div>
            {directionFilter || statusFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDirectionFilter("");
                  setStatusFilter("");
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button variant="primary" onClick={handleOpenCreateModal} className="mt-2">
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Lending/Borrowing Record</span>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        /* Records Table Card */
        <Card className="overflow-hidden border-slate-200/80 shadow-xs">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Person</th>
                  <th className="py-3.5 px-4 text-center">Direction</th>
                  <th className="py-3.5 px-4 text-right">Principal</th>
                  <th className="py-3.5 px-4 text-right">Repaid</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Account</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedRecords.map((rec) => {
                  const isLent = rec.direction === "LENT";
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-semibold text-slate-900 block">
                          {rec.person_name}
                        </span>
                        {rec.phone && (
                          <span className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{rec.phone}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant={isLent ? "success" : "danger"}
                          className="font-semibold text-[10px]"
                        >
                          {isLent ? "LENT" : "BORROWED"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(rec.principal_amount, userCurrency)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500 whitespace-nowrap">
                        {formatCurrency(rec.total_repaid, userCurrency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                        <span className={isLent ? "text-emerald-700" : "text-rose-700"}>
                          {formatCurrency(rec.outstanding_amount, userCurrency)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Badge variant={statusBadgeVariants[rec.status] || "neutral"}>
                          {statusLabels[rec.status] || rec.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {rec.due_date ? formatDate(rec.due_date) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.account_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetailModal(rec.id)}
                          className="text-xs py-1 px-2.5"
                        >
                          Details & Repay
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {displayedRecords.map((rec) => {
              const isLent = rec.direction === "LENT";
              return (
                <div key={rec.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{rec.person_name}</span>
                        <Badge
                          variant={isLent ? "success" : "danger"}
                          className="text-[10px] font-semibold"
                        >
                          {isLent ? "LENT" : "BORROWED"}
                        </Badge>
                      </div>
                      {rec.phone && (
                        <span className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{rec.phone}</span>
                        </span>
                      )}
                    </div>
                    <Badge variant={statusBadgeVariants[rec.status] || "neutral"}>
                      {statusLabels[rec.status] || rec.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-400 block">Principal</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(rec.principal_amount, userCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Outstanding</span>
                      <span
                        className={`font-bold ${
                          isLent ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {formatCurrency(rec.outstanding_amount, userCurrency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">
                      Due: {rec.due_date ? formatDate(rec.due_date) : "None"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetailModal(rec.id)}
                      className="text-xs py-1"
                    >
                      View & Repay
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Record Creation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !isCreating && setIsCreateModalOpen(false)}
        title="Create Lending / Borrowing Record"
        description="Record money lent out to someone or money borrowed into an account"
      >
        <form onSubmit={handleCreateRecord} className="space-y-4" noValidate>
          {createServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{createServerError}</span>
            </div>
          )}

          {/* Direction Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Direction
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreateFormData((prev) => ({ ...prev, direction: "LENT" }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  createFormData.direction === "LENT"
                    ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-sm text-slate-900">Money I Lent</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cash is deducted from your account. Becomes a receivable.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCreateFormData((prev) => ({ ...prev, direction: "BORROWED" }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  createFormData.direction === "BORROWED"
                    ? "bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  <span className="font-semibold text-sm text-slate-900">Money I Borrowed</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cash is added to your account. Becomes a payable debt.
                </p>
              </button>
            </div>
          </div>

          {/* Person Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Person's Name"
                id="person_name"
                name="person_name"
                placeholder="e.g. Alex Smith"
                value={createFormData.person_name}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, person_name: e.target.value }))
                }
                error={createErrors.person_name}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div>
              <Input
                label="Phone Number (Optional)"
                id="phone"
                name="phone"
                placeholder="+91 9876543210"
                value={createFormData.phone}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                disabled={isCreating}
              />
            </div>
          </div>

          {/* Principal Amount & Linked Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label={`Principal Amount (${userCurrency})`}
                id="principal_amount"
                name="principal_amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={createFormData.principal_amount}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, principal_amount: e.target.value }))
                }
                error={createErrors.principal_amount}
                disabled={isCreating}
              />
            </div>

            <div>
              <label
                htmlFor="account_id"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                {createFormData.direction === "LENT"
                  ? "Source Account (Deducted)"
                  : "Destination Account (Credited)"}
              </label>
              <select
                id="account_id"
                name="account_id"
                value={createFormData.account_id}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, account_id: e.target.value }))
                }
                disabled={isCreating}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.current_balance, userCurrency)})
                  </option>
                ))}
              </select>
              {createErrors.account_id && (
                <p className="mt-1.5 text-xs text-rose-600">{createErrors.account_id}</p>
              )}
            </div>
          </div>

          {/* Start Date & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Start Date"
                id="start_date"
                name="start_date"
                type="date"
                value={createFormData.start_date}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, start_date: e.target.value }))
                }
                error={createErrors.start_date}
                disabled={isCreating}
              />
            </div>
            <div>
              <Input
                label="Due Date (Optional)"
                id="due_date"
                name="due_date"
                type="date"
                value={createFormData.due_date}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, due_date: e.target.value }))
                }
                disabled={isCreating}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Input
              label="Notes / Description (Optional)"
              id="notes"
              name="notes"
              placeholder="e.g. Travel loan, short term help"
              value={createFormData.notes}
              onChange={(e) =>
                setCreateFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              disabled={isCreating}
            />
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              Create Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail & Repayment Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => !isSubmittingRepayment && setIsDetailModalOpen(false)}
        title="Lending Record Details & Repayments"
        description="View loan history and record full or partial repayments"
        maxWidth="max-w-2xl"
      >
        {isLoadingDetail ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <span className="text-sm font-medium text-slate-500 mt-2 block">Loading details...</span>
          </div>
        ) : selectedRecordDetail ? (
          <div className="space-y-6">
            {/* Record Overview Banner */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {selectedRecordDetail.person_name}
                  </h4>
                  {selectedRecordDetail.phone && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedRecordDetail.phone}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={selectedRecordDetail.direction === "LENT" ? "success" : "danger"}
                  >
                    {selectedRecordDetail.direction}
                  </Badge>
                  <Badge variant={statusBadgeVariants[selectedRecordDetail.status] || "neutral"}>
                    {statusLabels[selectedRecordDetail.status] || selectedRecordDetail.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Principal
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {formatCurrency(selectedRecordDetail.principal_amount, userCurrency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Total Repaid
                  </span>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCurrency(selectedRecordDetail.total_repaid, userCurrency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Outstanding
                  </span>
                  <span className="text-sm font-bold text-rose-600">
                    {formatCurrency(selectedRecordDetail.outstanding_amount, userCurrency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Repayment Form (if outstanding > 0) */}
            {parseFloat(selectedRecordDetail.outstanding_amount) > 0 ? (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <HandCoins className="w-4 h-4 text-emerald-600" />
                    <span>Record a Repayment</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    Max: {formatCurrency(selectedRecordDetail.outstanding_amount, userCurrency)}
                  </span>
                </div>

                {repaymentServerError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2 animate-fadeIn"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{repaymentServerError}</span>
                  </div>
                )}

                <form onSubmit={handleRecordRepayment} className="space-y-3" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        label={`Repayment Amount (${userCurrency})`}
                        id="repayment_amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={repaymentFormData.amount}
                        onChange={(e) =>
                          setRepaymentFormData((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        error={repaymentErrors.amount}
                        disabled={isSubmittingRepayment}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="repayment_account_id"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        {selectedRecordDetail.direction === "LENT"
                          ? "Receiving Account (Deposit)"
                          : "Payment Account (Withdrawal)"}
                      </label>
                      <select
                        id="repayment_account_id"
                        name="account_id"
                        value={repaymentFormData.account_id}
                        onChange={(e) =>
                          setRepaymentFormData((prev) => ({
                            ...prev,
                            account_id: e.target.value,
                          }))
                        }
                        disabled={isSubmittingRepayment}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.current_balance, userCurrency)})
                          </option>
                        ))}
                      </select>
                      {repaymentErrors.account_id && (
                        <p className="mt-1 text-xs text-rose-600">{repaymentErrors.account_id}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="Repayment Date"
                        id="repayment_date"
                        name="repayment_date"
                        type="date"
                        value={repaymentFormData.repayment_date}
                        onChange={(e) =>
                          setRepaymentFormData((prev) => ({
                            ...prev,
                            repayment_date: e.target.value,
                          }))
                        }
                        error={repaymentErrors.repayment_date}
                        disabled={isSubmittingRepayment}
                      />
                    </div>

                    <div>
                      <Input
                        label="Notes (Optional)"
                        id="repayment_notes"
                        name="notes"
                        placeholder="e.g. Bank transfer, cash"
                        value={repaymentFormData.notes}
                        onChange={(e) =>
                          setRepaymentFormData((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        disabled={isSubmittingRepayment}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isSubmittingRepayment}
                    >
                      Submit Repayment
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-emerald-800 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>This record has been completely settled. No outstanding balance remains.</span>
              </div>
            )}

            {/* Repayment History Ledger */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">
                Repayment History ({selectedRecordDetail.repayments?.length || 0})
              </h4>
              {!selectedRecordDetail.repayments || selectedRecordDetail.repayments.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg text-center">
                  No repayments recorded yet for this record.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {selectedRecordDetail.repayments.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {formatCurrency(rep.amount, userCurrency)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(rep.repayment_date)} • {rep.account_name}
                          {rep.notes ? ` • ${rep.notes}` : ""}
                        </span>
                      </div>
                      <Badge variant="success">Repaid</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

