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
  Edit2,
  Trash2,
  PlusCircle,
  Users,
  ChevronDown,
  ChevronRight,
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

  // View mode: "records" (default) or "persons" (consolidated by person)
  const [viewMode, setViewMode] = useState("records");
  const [expandedPersons, setExpandedPersons] = useState({});

  // Top-Up Modal state (for adding additional funds to an existing loan)
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpRecord, setTopUpRecord] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNotes, setTopUpNotes] = useState("");
  const [topUpErrors, setTopUpErrors] = useState("");
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);

  // Edit Loan Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({
    person_name: "",
    phone: "",
    account_id: "",
    principal_amount: "",
    due_date: "",
    notes: "",
  });
  const [editErrors, setEditErrors] = useState({});
  const [editServerError, setEditServerError] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Loan Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleteServerError, setDeleteServerError] = useState("");
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

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

  // Existing Persons aggregation (for grouping and duplicate detection)
  const existingPersons = React.useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const key = r.person_name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          displayName: r.person_name,
          phone: r.phone || "",
          records: [],
          totalBorrowed: 0,
          totalLent: 0,
          totalRepaid: 0,
          outstandingBorrowed: 0,
          outstandingLent: 0,
        });
      }
      const entry = map.get(key);
      entry.records.push(r);
      const principal = parseFloat(r.principal_amount) || 0;
      const repaid = parseFloat(r.total_repaid) || 0;
      const outstanding = parseFloat(r.outstanding_amount) || 0;
      entry.totalRepaid += repaid;
      if (r.direction === "BORROWED") {
        entry.totalBorrowed += principal;
        entry.outstandingBorrowed += outstanding;
      } else {
        entry.totalLent += principal;
        entry.outstandingLent += outstanding;
      }
      if (r.phone && !entry.phone) {
        entry.phone = r.phone;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [records]);

  // Notice when typing person in create form
  const activePersonNotice = React.useMemo(() => {
    if (!createFormData.person_name.trim()) return null;
    return existingPersons.find(
      (p) => p.displayName.toLowerCase() === createFormData.person_name.trim().toLowerCase()
    );
  }, [createFormData.person_name, existingPersons]);

  const toggleExpandPerson = (name) => {
    setExpandedPersons((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Top-Up Handlers
  const handleOpenTopUpModal = (record) => {
    setTopUpRecord(record);
    setTopUpAmount("");
    setTopUpNotes("");
    setTopUpErrors("");
    setIsTopUpModalOpen(true);
  };

  const handleConfirmTopUp = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(topUpAmount);
    if (!topUpAmount || isNaN(numAmount) || numAmount <= 0) {
      setTopUpErrors("Please enter a valid positive amount");
      return;
    }

    setIsSubmittingTopUp(true);
    setTopUpErrors("");

    try {
      const res = await lendingService.topUpLendingRecord(topUpRecord.id, {
        amount: numAmount,
        notes: topUpNotes.trim() || null,
      });

      if (res?.success) {
        setIsTopUpModalOpen(false);
        setSuccessMessage(`Added +${formatCurrency(numAmount, userCurrency)} to ${topUpRecord.person_name}'s principal!`);
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchLendingData(), fetchAccounts()]);
        if (isDetailModalOpen && selectedRecordId === topUpRecord.id) {
          const refreshed = await lendingService.getLendingRecordById(selectedRecordId);
          if (refreshed?.success) setSelectedRecordDetail(refreshed.data);
        }
      }
    } catch (err) {
      setTopUpErrors(err.message || "Failed to top up principal.");
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  // Edit Loan Handlers
  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    setEditFormData({
      person_name: record.person_name,
      phone: record.phone || "",
      account_id: String(record.account_id),
      principal_amount: String(record.principal_amount),
      due_date: record.due_date ? record.due_date.slice(0, 10) : "",
      notes: record.notes || "",
    });
    setEditErrors({});
    setEditServerError("");
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editFormData.person_name.trim()) errors.person_name = "Person name is required";
    const numPrincipal = parseFloat(editFormData.principal_amount);
    if (!editFormData.principal_amount || isNaN(numPrincipal) || numPrincipal <= 0) {
      errors.principal_amount = "Principal must be a positive number";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setIsSubmittingEdit(true);
    setEditServerError("");

    try {
      const res = await lendingService.updateLendingRecord(editingRecord.id, {
        person_name: editFormData.person_name.trim(),
        phone: editFormData.phone.trim() || null,
        account_id: Number(editFormData.account_id),
        principal_amount: numPrincipal,
        due_date: editFormData.due_date || null,
        notes: editFormData.notes.trim() || null,
      });

      if (res?.success) {
        setIsEditModalOpen(false);
        setSuccessMessage("Record updated successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchLendingData(), fetchAccounts()]);
        if (isDetailModalOpen && selectedRecordId === editingRecord.id) {
          const refreshed = await lendingService.getLendingRecordById(selectedRecordId);
          if (refreshed?.success) setSelectedRecordDetail(refreshed.data);
        }
      }
    } catch (err) {
      setEditServerError(err.message || "Failed to update record.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Loan Handlers
  const handleOpenDeleteModal = (record) => {
    setRecordToDelete(record);
    setDeleteServerError("");
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    setIsDeletingRecord(true);
    setDeleteServerError("");

    try {
      const res = await lendingService.deleteLendingRecord(recordToDelete.id);
      if (res?.success) {
        setIsDeleteModalOpen(false);
        if (isDetailModalOpen && selectedRecordId === recordToDelete.id) {
          setIsDetailModalOpen(false);
        }
        setSuccessMessage(`Record for ${recordToDelete.person_name} deleted successfully!`);
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchLendingData(), fetchAccounts()]);
      }
    } catch (err) {
      setDeleteServerError(err.message || "Failed to delete record.");
    } finally {
      setIsDeletingRecord(false);
    }
  };

  // Delete Repayment Handler
  const handleDeleteRepayment = async (lendingId, repaymentId) => {
    if (!window.confirm("Are you sure you want to delete this repayment record? The outstanding balance will be restored.")) {
      return;
    }

    try {
      const res = await lendingService.deleteRepayment(lendingId, repaymentId);
      if (res?.success) {
        setSuccessMessage("Repayment deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 4000);
        const refreshed = await lendingService.getLendingRecordById(lendingId);
        if (refreshed?.success) setSelectedRecordDetail(refreshed.data);
        await Promise.all([fetchLendingData(), fetchAccounts()]);
      }
    } catch (err) {
      alert(err.message || "Failed to delete repayment.");
    }
  };

  // Client-side filtering by status
  const displayedRecords = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const displayedPersons = React.useMemo(() => {
    const map = new Map();
    for (const r of displayedRecords) {
      const key = r.person_name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          displayName: r.person_name,
          phone: r.phone || "",
          records: [],
          totalBorrowed: 0,
          totalLent: 0,
          totalRepaid: 0,
          outstandingBorrowed: 0,
          outstandingLent: 0,
        });
      }
      const entry = map.get(key);
      entry.records.push(r);
      const principal = parseFloat(r.principal_amount) || 0;
      const repaid = parseFloat(r.total_repaid) || 0;
      const outstanding = parseFloat(r.outstanding_amount) || 0;
      entry.totalRepaid += repaid;
      if (r.direction === "BORROWED") {
        entry.totalBorrowed += principal;
        entry.outstandingBorrowed += outstanding;
      } else {
        entry.totalLent += principal;
        entry.outstandingLent += outstanding;
      }
      if (r.phone && !entry.phone) {
        entry.phone = r.phone;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [displayedRecords]);

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

      {/* View Mode & Filter Controls Card */}
      <Card className="p-4 border-slate-200/80 bg-white shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              View Style:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode("records")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  viewMode === "records"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Records ({displayedRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("persons")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                  viewMode === "persons"
                    ? "bg-white text-emerald-800 shadow-xs font-semibold ring-1 ring-emerald-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>By Person ({displayedPersons.length})</span>
              </button>
            </div>
          </div>
          {viewMode === "persons" && (
            <span className="text-xs text-slate-500">
              Consolidated debt ledger per individual
            </span>
          )}
        </div>

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
      ) : viewMode === "persons" ? (
        /* Consolidated Person Ledger View */
        <div className="space-y-4">
          {displayedPersons.map((p) => {
            const isExpanded = !!expandedPersons[p.displayName];
            const netPosition = p.outstandingLent - p.outstandingBorrowed;
            const hasMultiple = p.records.length > 1;

            return (
              <Card key={p.displayName} className="overflow-hidden border-slate-200/80 shadow-xs">
                {/* Person Summary Header */}
                <div className="p-4 sm:p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-base flex-shrink-0">
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-base">{p.displayName}</span>
                        {hasMultiple && (
                          <Badge variant="warning" className="text-[10px] font-semibold">
                            {p.records.length} Loans
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                        {p.phone && (
                          <span className="flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{p.phone}</span>
                          </span>
                        )}
                        <span>
                          Total Repaid: <strong className="text-emerald-700">{formatCurrency(p.totalRepaid, userCurrency)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Net Balance
                      </span>
                      {netPosition > 0 ? (
                        <span className="text-sm font-bold text-emerald-700">
                          Owes you {formatCurrency(netPosition, userCurrency)}
                        </span>
                      ) : netPosition < 0 ? (
                        <span className="text-sm font-bold text-rose-700">
                          You owe {formatCurrency(Math.abs(netPosition), userCurrency)}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-slate-500">All Settled</span>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpandPerson(p.displayName)}
                      className="flex items-center space-x-1.5 text-xs py-1.5 px-3"
                    >
                      <span>{isExpanded ? "Hide Details" : "View Loans"}</span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Collapsible Loan Records for Person */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-3">
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse bg-white rounded-lg border border-slate-200">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3.5">Direction</th>
                            <th className="py-2.5 px-3 text-right">Principal</th>
                            <th className="py-2.5 px-3 text-right">Repaid</th>
                            <th className="py-2.5 px-3 text-right">Outstanding</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3">Due Date</th>
                            <th className="py-2.5 px-3">Account</th>
                            <th className="py-2.5 px-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {p.records.map((rec) => {
                            const isLent = rec.direction === "LENT";
                            return (
                              <tr key={rec.id} className="hover:bg-slate-50/60">
                                <td className="py-2.5 px-3.5">
                                  <Badge variant={isLent ? "success" : "danger"} className="text-[10px]">
                                    {isLent ? "LENT" : "BORROWED"}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                  {formatCurrency(rec.principal_amount, userCurrency)}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-500">
                                  {formatCurrency(rec.total_repaid, userCurrency)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold">
                                  <span className={isLent ? "text-emerald-700" : "text-rose-700"}>
                                    {formatCurrency(rec.outstanding_amount, userCurrency)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <Badge variant={statusBadgeVariants[rec.status] || "neutral"}>
                                    {statusLabels[rec.status] || rec.status}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {rec.due_date ? formatDate(rec.due_date) : "—"}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {rec.account_name}
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenDetailModal(rec.id)}
                                      className="text-[11px] py-0.5 px-2"
                                    >
                                      Details
                                    </Button>
                                    {rec.status !== "SETTLED" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenTopUpModal(rec)}
                                        className="text-[11px] p-1 text-emerald-700 hover:bg-emerald-50"
                                        title="Top up loan principal"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEditModal(rec)}
                                      className="text-[11px] p-1 text-slate-600 hover:bg-slate-100"
                                      title="Edit loan"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenDeleteModal(rec)}
                                      className="text-[11px] p-1 text-rose-600 hover:bg-rose-50"
                                      title="Delete loan"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View for this person's loans */}
                    <div className="md:hidden space-y-2">
                      {p.records.map((rec) => {
                        const isLent = rec.direction === "LENT";
                        return (
                          <div key={rec.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant={isLent ? "success" : "danger"} className="text-[10px]">
                                {isLent ? "LENT" : "BORROWED"}
                              </Badge>
                              <Badge variant={statusBadgeVariants[rec.status] || "neutral"}>
                                {statusLabels[rec.status] || rec.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Principal:</span>
                              <span className="font-medium text-slate-800">{formatCurrency(rec.principal_amount, userCurrency)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Outstanding:</span>
                              <span className={`font-bold ${isLent ? "text-emerald-700" : "text-rose-700"}`}>
                                {formatCurrency(rec.outstanding_amount, userCurrency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-end space-x-1 pt-1 border-t border-slate-100">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDetailModal(rec.id)}
                                className="text-[11px] py-0.5 px-2"
                              >
                                Details
                              </Button>
                              {rec.status !== "SETTLED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenTopUpModal(rec)}
                                  className="p-1 text-emerald-700"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditModal(rec)}
                                className="p-1 text-slate-600"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDeleteModal(rec)}
                                className="p-1 text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
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
                        <div className="flex items-center justify-end space-x-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetailModal(rec.id)}
                            className="text-xs py-1 px-2.5"
                          >
                            Details & Repay
                          </Button>
                          {rec.status !== "SETTLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTopUpModal(rec)}
                              className="text-xs py-1 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                              title="Top up loan principal"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(rec)}
                            className="text-xs py-1 px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit loan record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteModal(rec)}
                            className="text-xs py-1 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            title="Delete loan record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetailModal(rec.id)}
                        className="text-xs py-1 px-2"
                      >
                        View & Repay
                      </Button>
                      {rec.status !== "SETTLED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenTopUpModal(rec)}
                          className="text-xs py-1 px-2 text-emerald-700"
                          title="Top up loan"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(rec)}
                        className="text-xs py-1 px-2 text-slate-600"
                        title="Edit loan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDeleteModal(rec)}
                        className="text-xs py-1 px-2 text-rose-600"
                        title="Delete loan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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
                list="person-names-list"
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, person_name: e.target.value }))
                }
                error={createErrors.person_name}
                disabled={isCreating}
                autoFocus
              />
              <datalist id="person-names-list">
                {existingPersons.map((p) => (
                  <option key={p.displayName} value={p.displayName} />
                ))}
              </datalist>
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

          {/* Active Person Existing Balance Banner */}
          {activePersonNotice && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>{activePersonNotice.displayName}</strong> already has {activePersonNotice.records.length} loan record(s).
                  {activePersonNotice.outstandingLent > 0 && ` (They owe you ${formatCurrency(activePersonNotice.outstandingLent, userCurrency)})`}
                  {activePersonNotice.outstandingBorrowed > 0 && ` (You owe them ${formatCurrency(activePersonNotice.outstandingBorrowed, userCurrency)})`}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Existing Counterparty
              </span>
            </div>
          )}

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
                      <div className="flex items-center space-x-2">
                        <Badge variant="success">Repaid</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRepayment(selectedRecordId, rep.id)}
                          className="text-xs p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete this repayment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Top-Up Principal Modal */}
      <Modal
        isOpen={isTopUpModalOpen}
        onClose={() => !isSubmittingTopUp && setIsTopUpModalOpen(false)}
        title={`Top Up Principal - ${topUpRecord?.person_name || ""}`}
        description="Add more funds to this loan. The additional amount will be reflected in your account balance and increase the outstanding debt."
      >
        {topUpRecord && (
          <form onSubmit={handleConfirmTopUp} className="space-y-4">
            {topUpErrors && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{topUpErrors}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Principal:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(topUpRecord.principal_amount, userCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Outstanding:</span>
                <span className="font-bold text-rose-600">
                  {formatCurrency(topUpRecord.outstanding_amount, userCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Direction:</span>
                <span className="font-semibold text-slate-900">
                  {topUpRecord.direction === "LENT" ? "Money Lent (Receivable)" : "Money Borrowed (Payable)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Linked Account:</span>
                <span className="font-semibold text-slate-900">{topUpRecord.account_name}</span>
              </div>
            </div>

            <div>
              <Input
                label={`Additional Amount to Add (${userCurrency})`}
                id="topup_amount"
                name="topup_amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                required
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {topUpRecord.direction === "LENT"
                  ? `This amount will be deducted from ${topUpRecord.account_name}.`
                  : `This amount will be credited into ${topUpRecord.account_name}.`}
              </p>
            </div>

            <div>
              <Input
                label="Notes (Optional)"
                id="topup_notes"
                name="topup_notes"
                placeholder="e.g. Second installment / extra borrowed"
                value={topUpNotes}
                onChange={(e) => setTopUpNotes(e.target.value)}
              />
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTopUpModalOpen(false)}
                disabled={isSubmittingTopUp}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingTopUp}
              >
                Confirm Top-Up
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Loan Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmittingEdit && setIsEditModalOpen(false)}
        title="Edit Lending Record"
        description="Update counterparty details, principal amount, or notes."
      >
        {editingRecord && (
          <form onSubmit={handleConfirmEdit} className="space-y-4">
            {editServerError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{editServerError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Person's Name"
                id="edit_person_name"
                name="person_name"
                value={editFormData.person_name}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, person_name: e.target.value }))
                }
                error={editErrors.person_name}
                disabled={isSubmittingEdit}
                required
              />
              <Input
                label="Phone Number (Optional)"
                id="edit_phone"
                name="phone"
                value={editFormData.phone}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                disabled={isSubmittingEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  label={`Principal Amount (${userCurrency})`}
                  id="edit_principal"
                  name="principal_amount"
                  type="number"
                  step="0.01"
                  value={editFormData.principal_amount}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, principal_amount: e.target.value }))
                  }
                  error={editErrors.principal_amount}
                  disabled={isSubmittingEdit}
                  required
                />
                {parseFloat(editingRecord.total_repaid) > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Minimum allowed: {formatCurrency(editingRecord.total_repaid, userCurrency)} (already repaid)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Linked Account
                </label>
                <select
                  value={editFormData.account_id}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, account_id: e.target.value }))
                  }
                  disabled={isSubmittingEdit}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.current_balance, userCurrency)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Due Date (Optional)"
                id="edit_due_date"
                name="due_date"
                type="date"
                value={editFormData.due_date}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, due_date: e.target.value }))
                }
                disabled={isSubmittingEdit}
              />
              <Input
                label="Notes (Optional)"
                id="edit_notes"
                name="notes"
                value={editFormData.notes}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                disabled={isSubmittingEdit}
              />
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmittingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingEdit}
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Loan Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeletingRecord && setIsDeleteModalOpen(false)}
        title="Delete Lending Record"
        description="Are you sure you want to delete this lending/borrowing record?"
      >
        {recordToDelete && (
          <div className="space-y-4">
            {deleteServerError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{deleteServerError}</span>
              </div>
            )}

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-sm space-y-2">
              <p className="font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Warning: Account balance adjustments will be reverted</span>
              </p>
              <p className="text-xs text-rose-700">
                Deleting this <strong>{recordToDelete.direction}</strong> record for <strong>{recordToDelete.person_name}</strong> will also permanently delete all associated repayment history and restore the initial cash balance on account <strong>{recordToDelete.account_name}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Person:</span>
                <span className="font-semibold text-slate-800">{recordToDelete.person_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Principal Amount:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(recordToDelete.principal_amount, userCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding:</span>
                <span className="font-bold text-rose-600">{formatCurrency(recordToDelete.outstanding_amount, userCurrency)}</span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingRecord}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDeleteRecord}
                isLoading={isDeletingRecord}
              >
                Delete Record
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

