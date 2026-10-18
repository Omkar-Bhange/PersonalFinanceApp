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
  Edit2,
  Trash2,
  Sparkles,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Check,
  CheckSquare,
  Square,
  Layers,
  Bot,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { transactionService } from "../services/transactionService";
import { accountService } from "../services/accountService";
import { categoryService } from "../services/categoryService";
import { aiService } from "../services/aiService";
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

  // Transaction Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editFormData, setEditFormData] = useState({
    account_id: "",
    category_id: "",
    transaction_type: "EXPENSE",
    amount: "",
    transaction_date: "",
    description: "",
    merchant: "",
    notes: "",
  });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [editServerError, setEditServerError] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Transaction Delete state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState(null);
  const [deleteServerError, setDeleteServerError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Delete State
  const [selectedTxIds, setSelectedTxIds] = useState(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteServerError, setBulkDeleteServerError] = useState("");

  // AI Statement Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(1); // 1: Upload/Paste, 2: Review & Approve
  const [importAccountId, setImportAccountId] = useState("");
  const [importInputMode, setImportInputMode] = useState("file"); // "file" | "text"
  const [importFile, setImportFile] = useState(null);
  const [importText, setImportText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractedTransactions, setExtractedTransactions] = useState([]);
  const [detectedAccountInfo, setDetectedAccountInfo] = useState(null);
  const [statementOpeningBalance, setStatementOpeningBalance] = useState(null);
  const [syncOpeningBalance, setSyncOpeningBalance] = useState(true);
  const [statementClosingBalance, setStatementClosingBalance] = useState(null);
  const [syncClosingBalance, setSyncClosingBalance] = useState(true);
  const [statementReconciliation, setStatementReconciliation] = useState(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [importServerError, setImportServerError] = useState("");

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

  const handleOpenEditModal = (tx) => {
    setEditingTx(tx);
    setEditFormData({
      account_id: String(tx.account_id),
      category_id: tx.category_id ? String(tx.category_id) : "",
      transaction_type: tx.transaction_type,
      amount: String(tx.amount),
      transaction_date: tx.transaction_date ? tx.transaction_date.slice(0, 10) : "",
      description: tx.description || "",
      merchant: tx.merchant || "",
      notes: tx.notes || "",
    });
    setEditFormErrors({});
    setEditServerError("");
    setIsEditModalOpen(true);
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editFormData.account_id) errors.account_id = "Account is required";
    const numAmount = parseFloat(editFormData.amount);
    if (!editFormData.amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = "Please enter a valid positive amount";
    }
    if (!editFormData.transaction_date) errors.transaction_date = "Date is required";

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    setIsEditSubmitting(true);
    setEditServerError("");

    try {
      const payload = {
        account_id: Number(editFormData.account_id),
        category_id: editFormData.category_id ? Number(editFormData.category_id) : null,
        transaction_type: editFormData.transaction_type,
        amount: parseFloat(editFormData.amount),
        transaction_date: editFormData.transaction_date,
        description: editFormData.description.trim() || null,
        merchant: editFormData.merchant.trim() || null,
        notes: editFormData.notes.trim() || null,
      };

      const response = await transactionService.updateTransaction(editingTx.id, payload);

      if (response?.success) {
        setIsEditModalOpen(false);
        setSuccessMessage("Transaction updated successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchTransactions(), fetchResources()]);
      }
    } catch (err) {
      setEditServerError(err.message || "Failed to update transaction.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (tx) => {
    setTxToDelete(tx);
    setDeleteServerError("");
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    setDeleteServerError("");

    try {
      const response = await transactionService.deleteTransaction(txToDelete.id);
      if (response?.success) {
        setIsDeleteModalOpen(false);
        setSuccessMessage("Transaction deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchTransactions(), fetchResources()]);
      }
    } catch (err) {
      setDeleteServerError(err.message || "Failed to delete transaction.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Delete Handlers
  const handleToggleSelectAllTxs = (checked) => {
    const shouldSelect = typeof checked === "boolean"
      ? checked
      : selectedTxIds.size < transactions.length;
    if (shouldSelect) {
      setSelectedTxIds(new Set(transactions.map((t) => t.id)));
    } else {
      setSelectedTxIds(new Set());
    }
  };

  const handleToggleSelectTx = (id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedTxIds.size === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteServerError("");
    try {
      const ids = Array.from(selectedTxIds);
      const res = await transactionService.bulkDeleteTransactions({ transaction_ids: ids });
      if (res?.success) {
        setIsBulkDeleteModalOpen(false);
        setSelectedTxIds(new Set());
        setSuccessMessage(`Successfully deleted ${res.count} transaction(s)!`);
        setTimeout(() => setSuccessMessage(""), 4000);
        await Promise.all([fetchTransactions(), fetchResources()]);
      }
    } catch (err) {
      setBulkDeleteServerError(err.message || "Failed to delete selected transactions.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // AI Statement Import Handlers
  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
    setImportStep(1);
    setImportAccountId(accounts.length > 0 ? String(accounts[0].id) : "__AUTO_DETECT__");
    setImportInputMode("file");
    setImportFile(null);
    setImportText("");
    setIsExtracting(false);
    setExtractError("");
    setExtractedTransactions([]);
    setDetectedAccountInfo(null);
    setStatementOpeningBalance(null);
    setSyncOpeningBalance(true);
    setStatementClosingBalance(null);
    setSyncClosingBalance(true);
    setStatementReconciliation(null);
    setImportServerError("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setExtractError("");
    }
  };

  const handleStartAIExtraction = async () => {
    if (importInputMode === "file" && !importFile) {
      setExtractError("Please select a bank statement file (Excel, PDF, CSV, image) to upload.");
      return;
    }
    if (importInputMode === "text" && !importText.trim()) {
      setExtractError("Please paste your bank statement or SMS messages in the box.");
      return;
    }

    setIsExtracting(true);
    setExtractError("");

    try {
      const payload = importInputMode === "file" ? { file: importFile } : { text: importText.trim() };
      const res = await aiService.parseStatement(payload);

      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        if (res.statement_opening_balance !== null && res.statement_opening_balance !== undefined) {
          setStatementOpeningBalance(Number(res.statement_opening_balance));
          setSyncOpeningBalance(true);
        } else {
          setStatementOpeningBalance(null);
          setSyncOpeningBalance(false);
        }

        if (res.statement_closing_balance !== null && res.statement_closing_balance !== undefined) {
          setStatementClosingBalance(Number(res.statement_closing_balance));
          setSyncClosingBalance(true);
        } else {
          setStatementClosingBalance(null);
          setSyncClosingBalance(false);
        }

        setStatementReconciliation(res.reconciliation || null);

        if (res?.detected_account) {
          setDetectedAccountInfo(res.detected_account);
          if (res.detected_account.matched_account_id) {
            setImportAccountId(String(res.detected_account.matched_account_id));
          } else if (res.detected_account.suggested_account_name && (!importAccountId || importAccountId === "__AUTO_DETECT__")) {
            setImportAccountId(`__NEW_ACC__:${res.detected_account.suggested_account_name}`);
          }
        }

        const prepared = res.data.map((tx, idx) => ({
          tempId: `ai-tx-${idx}-${Date.now()}`,
          selected: true,
          transaction_date: tx.transaction_date || new Date().toISOString().slice(0, 10),
          merchant: tx.merchant || "",
          description: tx.merchant || tx.raw_narration || "Imported transaction",
          amount: String(tx.amount || ""),
          transaction_type: tx.transaction_type || "EXPENSE",
          category_id: tx.suggested_category_id ? String(tx.suggested_category_id) : "",
          category_name: tx.suggested_category_name || "",
          is_new_category: !tx.suggested_category_id && !!tx.suggested_category_name,
          notes: tx.notes || tx.raw_narration || "",
        }));

        setExtractedTransactions(prepared);
        setImportStep(2);
      } else {
        setExtractError("No valid financial transactions could be detected in the provided content. Please check the file or text and try again.");
      }
    } catch (err) {
      setExtractError(err.message || "Failed to analyze statement. Please check file format or API key.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleSelectAll = (checked) => {
    setExtractedTransactions((prev) =>
      prev.map((t) => ({ ...t, selected: checked }))
    );
  };

  const handleToggleRowSelect = (tempId) => {
    setExtractedTransactions((prev) =>
      prev.map((t) => (t.tempId === tempId ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleUpdateExtractedField = (tempId, field, value) => {
    setExtractedTransactions((prev) =>
      prev.map((t) => (t.tempId === tempId ? { ...t, [field]: value } : t))
    );
  };

  const handleCategorySelectChange = (tempId, val) => {
    setExtractedTransactions((prev) =>
      prev.map((t) => {
        if (t.tempId !== tempId) return t;
        if (val.startsWith("__NEW__:")) {
          const catName = val.replace("__NEW__:", "");
          return { ...t, category_id: "", category_name: catName, is_new_category: true };
        }
        if (!val) {
          return { ...t, category_id: "", category_name: "", is_new_category: false };
        }
        const matchedCat = categories.find((c) => String(c.id) === String(val));
        return {
          ...t,
          category_id: String(val),
          category_name: matchedCat ? matchedCat.name : "",
          is_new_category: false,
        };
      })
    );
  };

  const handleRemoveExtractedRow = (tempId) => {
    setExtractedTransactions((prev) => prev.filter((t) => t.tempId !== tempId));
  };

  const handleConfirmBulkImport = async () => {
    const selected = extractedTransactions.filter((t) => t.selected);
    if (selected.length === 0) {
      setImportServerError("Please select at least one transaction to import.");
      return;
    }

    for (const item of selected) {
      const amt = parseFloat(item.amount);
      if (isNaN(amt) || amt <= 0) {
        setImportServerError(`Invalid amount "${item.amount}" for ${item.merchant || "a transaction"}.`);
        return;
      }
    }

    setIsBulkImporting(true);
    setImportServerError("");

    try {
      const isNewAccount = String(importAccountId).startsWith("__NEW_ACC__:");
      const isAutoDetectAccount = importAccountId === "__AUTO_DETECT__";

      let finalAccountId = null;
      let finalAccountName = null;

      if (isNewAccount) {
        finalAccountName = importAccountId.replace("__NEW_ACC__:", "");
      } else if (isAutoDetectAccount) {
        if (detectedAccountInfo?.suggested_account_name) {
          finalAccountName = detectedAccountInfo.suggested_account_name;
        } else if (accounts.length > 0) {
          finalAccountId = accounts[0].id;
        } else {
          finalAccountName = "Primary Bank Account";
        }
      } else if (importAccountId) {
        finalAccountId = Number(importAccountId);
      } else if (accounts.length > 0) {
        finalAccountId = accounts[0].id;
      } else {
        finalAccountName = "Primary Bank Account";
      }

      const payload = {
        ...(finalAccountId ? { account_id: finalAccountId } : { account_name: finalAccountName }),
        ...(syncClosingBalance && statementClosingBalance !== null && !isNaN(Number(statementClosingBalance))
          ? { sync_closing_balance: Number(statementClosingBalance) }
          : {}),
        ...(syncOpeningBalance && statementOpeningBalance !== null && !isNaN(Number(statementOpeningBalance))
          ? {
              sync_opening_balance: true,
              statement_opening_balance: Number(statementOpeningBalance),
            }
          : {}),
        transactions: selected.map((t) => ({
          category_id: t.category_id ? Number(t.category_id) : null,
          category_name: t.category_name ? t.category_name.trim() : null,
          transaction_type: t.transaction_type,
          amount: parseFloat(t.amount),
          transaction_date: t.transaction_date,
          description: t.description.trim() || t.merchant.trim() || null,
          merchant: t.merchant.trim() || null,
          notes: t.notes.trim() || null,
        })),
      };

      const res = await transactionService.createBulkTransactions(payload);

      if (res?.success) {
        setIsImportModalOpen(false);
        const targetAccName = finalAccountId
          ? (accountMap.get(String(finalAccountId))?.name || "account")
          : (finalAccountName || "new account");
        setSuccessMessage(`Successfully imported ${res.count} transactions into ${targetAccName}!`);
        setTimeout(() => setSuccessMessage(""), 5000);
        await Promise.all([fetchTransactions(), fetchResources()]);
      }
    } catch (err) {
      setImportServerError(err.message || "Failed to bulk import transactions.");
    } finally {
      setIsBulkImporting(false);
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
  const availableEditCategories = categories.filter(
    (c) => c.category_type === editFormData.transaction_type
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
            variant="outline"
            size="sm"
            onClick={handleOpenImportModal}
            className="flex items-center space-x-1.5 border-emerald-300 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-900 transition-colors shadow-xs"
            title="Import Bank Statement or SMS with AI"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Import with AI</span>
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
        <div className="space-y-3">
          {/* Bulk Delete Toolbar */}
          {selectedTxIds.size > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg border border-slate-800 animate-fadeIn">
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <span className="font-semibold text-xs text-emerald-400">
                  {selectedTxIds.size} of {transactions.length} transaction(s) selected
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedTxIds(new Set())}
                  className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Deselect All
                </button>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedTxIds(new Set(transactions.map((t) => t.id)))}
                  className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Select All ({transactions.length})
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setBulkDeleteServerError("");
                    setIsBulkDeleteModalOpen(true);
                  }}
                  className="flex items-center space-x-1.5 py-1 px-3 text-xs bg-rose-600 hover:bg-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedTxIds.size})</span>
                </Button>
              </div>
            </div>
          )}

          {/* Transactions Table Card */}
          <Card className="overflow-hidden border-slate-200/80 shadow-xs">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.size === transactions.length && transactions.length > 0}
                        onChange={(e) => handleToggleSelectAllTxs(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                        title="Select all transactions"
                      />
                    </th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Description / Merchant</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Account</th>
                    <th className="py-3.5 px-4 text-center">Type</th>
                    <th className="py-3.5 px-5 text-right">Amount</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {transactions.map((tx) => {
                    const isIncome = tx.transaction_type === "INCOME";
                    const account = accountMap.get(String(tx.account_id));
                    const category = categoryMap.get(String(tx.category_id));

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors ${
                          selectedTxIds.has(tx.id)
                            ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                            : "hover:bg-slate-50/60"
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedTxIds.has(tx.id)}
                            onChange={() => handleToggleSelectTx(tx.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
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
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(tx)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Transaction"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(tx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                <div
                  key={tx.id}
                  className={`p-4 space-y-2.5 transition-colors ${
                    selectedTxIds.has(tx.id) ? "bg-emerald-50/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.has(tx.id)}
                        onChange={() => handleToggleSelectTx(tx.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {tx.description || (isIncome ? "Income Credit" : "Expense Debit")}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(tx.transaction_date)}
                          {tx.merchant ? ` • ${tx.merchant}` : ""}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-base font-bold whitespace-nowrap ${
                        isIncome ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {isIncome ? "+" : "-"} {formatCurrency(tx.amount, userCurrency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-600 flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{account ? account.name : `Account #${tx.account_id}`}</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      {category ? (
                        <Badge variant={isIncome ? "success" : "neutral"} className="text-[10px]">
                          {category.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Uncategorized</span>
                      )}
                      <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                        <button
                          onClick={() => handleOpenEditModal(tx)}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                          title="Edit Transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(tx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
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

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isEditSubmitting && setIsEditModalOpen(false)}
        title="Edit Transaction"
        description="Update transaction details, amounts, or classifications"
      >
        <form onSubmit={handleUpdateTransaction} className="space-y-4" noValidate>
          {editServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{editServerError}</span>
            </div>
          )}

          {/* Transaction Type Radio Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center p-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
                  editFormData.transaction_type === "EXPENSE"
                    ? "border-rose-500 bg-rose-50/50 text-rose-700 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="edit_transaction_type"
                  value="EXPENSE"
                  checked={editFormData.transaction_type === "EXPENSE"}
                  onChange={() =>
                    setEditFormData((prev) => ({
                      ...prev,
                      transaction_type: "EXPENSE",
                      category_id: "",
                    }))
                  }
                  className="sr-only"
                />
                <ArrowDownRight className="w-4 h-4 mr-1.5 text-rose-500" />
                <span>Expense Debit</span>
              </label>

              <label
                className={`flex items-center justify-center p-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
                  editFormData.transaction_type === "INCOME"
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="edit_transaction_type"
                  value="INCOME"
                  checked={editFormData.transaction_type === "INCOME"}
                  onChange={() =>
                    setEditFormData((prev) => ({
                      ...prev,
                      transaction_type: "INCOME",
                      category_id: "",
                    }))
                  }
                  className="sr-only"
                />
                <ArrowUpRight className="w-4 h-4 mr-1.5 text-emerald-500" />
                <span>Income Credit</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label={`Amount (${userCurrency})`}
                id="edit_amount"
                type="number"
                step="0.01"
                value={editFormData.amount}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                error={editFormErrors.amount}
                disabled={isEditSubmitting}
                autoFocus
              />
            </div>

            <div>
              <Input
                label="Transaction Date"
                id="edit_transaction_date"
                type="date"
                value={editFormData.transaction_date}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, transaction_date: e.target.value }))
                }
                error={editFormErrors.transaction_date}
                disabled={isEditSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Account
            </label>
            <select
              value={editFormData.account_id}
              onChange={(e) =>
                setEditFormData((prev) => ({ ...prev, account_id: e.target.value }))
              }
              disabled={isEditSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatCurrency(acc.current_balance, userCurrency)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={editFormData.category_id}
              onChange={(e) =>
                setEditFormData((prev) => ({ ...prev, category_id: e.target.value }))
              }
              disabled={isEditSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 cursor-pointer"
            >
              <option value="">Uncategorized</option>
              {availableEditCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat.user_id ? "(Custom)" : "(Standard)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Description"
                id="edit_description"
                type="text"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={isEditSubmitting}
              />
            </div>

            <div>
              <Input
                label="Merchant / Payee"
                id="edit_merchant"
                type="text"
                value={editFormData.merchant}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, merchant: e.target.value }))
                }
                disabled={isEditSubmitting}
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isEditSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isEditSubmitting}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Transaction Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction?"
      >
        <div className="space-y-4">
          {deleteServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{deleteServerError}</span>
            </div>
          )}

          <p className="text-sm text-slate-600">
            Are you sure you want to delete this transaction of{" "}
            <span className="font-semibold text-slate-900">
              {txToDelete ? formatCurrency(txToDelete.amount, userCurrency) : ""}
            </span>
            {txToDelete?.description ? ` (${txToDelete.description})` : ""}? The account balance will be automatically recalculated.
          </p>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Delete Transaction
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
        title="Delete Selected Transactions"
        description={`Are you sure you want to delete ${selectedTxIds.size} selected transaction(s)?`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {bulkDeleteServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{bulkDeleteServerError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <p className="font-semibold text-amber-950 flex items-center space-x-1.5">
              <span>⚠️ Permanent Action</span>
            </p>
            <p className="text-slate-600">
              This will permanently delete <strong>{selectedTxIds.size}</strong> transaction(s) and automatically update your account balances.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmBulkDelete}
              isLoading={isBulkDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm Delete ({selectedTxIds.size})
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Statement & SMS Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => !isExtracting && !isBulkImporting && setIsImportModalOpen(false)}
        title={importStep === 1 ? "AI Bank Statement & SMS Importer" : "Review Extracted Transactions"}
        description={
          importStep === 1
            ? "Upload bank statement PDF, CSV, receipt screenshot, or paste bank SMS to auto-extract transactions with Gemini AI"
            : `AI detected ${extractedTransactions.length} transaction(s). Verify details and select which ones to import into ${accountMap.get(String(importAccountId))?.name || "your account"}.`
        }
        maxWidth={importStep === 1 ? "max-w-xl" : "max-w-5xl"}
      >
        {importStep === 1 ? (
          <div className="space-y-4">
            {extractError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5 animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{extractError}</span>
              </div>
            )}

            {/* Target Account Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Bank Account
              </label>
              <select
                value={importAccountId}
                onChange={(e) => setImportAccountId(e.target.value)}
                disabled={isExtracting}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <option value="__AUTO_DETECT__">
                  ✨ Auto-detect Account from Statement
                </option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.current_balance, userCurrency)})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Gemini AI will automatically detect or match your bank account from the statement header.
              </p>
            </div>

            {/* Input Mode Tabs */}
            <div>
              <div className="flex border-b border-slate-200 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setImportInputMode("file")}
                  className={`py-2 px-4 border-b-2 font-semibold transition-colors flex items-center space-x-2 ${
                    importInputMode === "file"
                      ? "border-emerald-600 text-emerald-800 bg-emerald-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Statement File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportInputMode("text")}
                  className={`py-2 px-4 border-b-2 font-semibold transition-colors flex items-center space-x-2 ${
                    importInputMode === "text"
                      ? "border-emerald-600 text-emerald-800 bg-emerald-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Paste Bank SMS / Text</span>
                </button>
              </div>

              {/* File Upload Mode */}
              {importInputMode === "file" && (
                <div className="pt-4">
                  <label
                    htmlFor="statement-file-upload"
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-emerald-50/30"
                  >
                    <input
                      id="statement-file-upload"
                      type="file"
                      accept=".xlsx,.xls,.pdf,.csv,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isExtracting}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    {importFile ? (
                      <div className="space-y-1">
                        <span className="font-semibold text-sm text-slate-900 block">
                          {importFile.name}
                        </span>
                        <span className="text-xs text-slate-500 block">
                          {(importFile.size / 1024).toFixed(1)} KB • Click to choose a different file
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="font-semibold text-sm text-slate-900 block">
                          Click to upload or drag & drop bank statement
                        </span>
                        <span className="text-xs text-slate-600 font-medium block">
                          Excel (.xlsx, .xls), PDF, CSV, or UPI Payment Screenshots
                        </span>
                        <span className="inline-block text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                          ✨ Excel files (.xlsx, .xls) provide 100% cell-accurate numbers & balances
                        </span>
                      </div>
                    )}
                  </label>
                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    Gemini AI automatically parses multi-column statement tables and ignores headers.
                  </p>
                </div>
              )}

              {/* Text / SMS Mode */}
              {importInputMode === "text" && (
                <div className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">
                      Bank SMS / Transaction Text
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setImportText(
                          `Rs 450.00 debited from SBI A/C ...9821 on 15-Oct-26 to SWIGGY BANGALORE UPI ref 492019. Available bal: Rs 1,470.00.\nRs 1,200.00 debited from SBI A/C ...9821 on 16-Oct-26 to SHELL PETROL MUMBAI.\nRs 55,000.00 credited to A/C ...9821 on 01-Oct-26 by SALARY OCT 2026.`
                        )
                      }
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold"
                    >
                      Paste Sample SBI SMS
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste bank transaction SMS messages or raw statement lines here..."
                    disabled={isExtracting}
                    className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[11px] text-slate-400">
                    Paste multiple SMS messages separated by newlines. The AI will extract dates, merchants, and amounts.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isExtracting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStartAIExtraction}
                isLoading={isExtracting}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Sparkles className="w-4 h-4" />
                <span>Extract with Gemini AI</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Review and Approve Extracted Transactions */
          <div className="space-y-4">
            {importServerError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5 animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{importServerError}</span>
              </div>
            )}

            {/* Statement Balance & Mathematical Reconciliation Card */}
            {(() => {
              const selectedTxList = extractedTransactions.filter((t) => t.selected);
              const selectedCredits = selectedTxList
                .filter((t) => t.transaction_type === "INCOME")
                .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
              const selectedDebits = selectedTxList
                .filter((t) => t.transaction_type === "EXPENSE")
                .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
              const selectedNetFlow = selectedCredits - selectedDebits;

              const currentOpBal =
                statementOpeningBalance !== null && !isNaN(Number(statementOpeningBalance))
                  ? Number(statementOpeningBalance)
                  : null;
              const currentClBal =
                statementClosingBalance !== null && !isNaN(Number(statementClosingBalance))
                  ? Number(statementClosingBalance)
                  : null;
              const calculatedClBal =
                currentOpBal !== null ? Math.round((currentOpBal + selectedNetFlow) * 100) / 100 : null;
              const liveDiff =
                calculatedClBal !== null && currentClBal !== null
                  ? Math.round(Math.abs(calculatedClBal - currentClBal) * 100) / 100
                  : null;
              const isLiveReconciled = liveDiff !== null && liveDiff < 0.05;

              if (statementOpeningBalance === null && statementClosingBalance === null) {
                return null;
              }

              return (
                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3.5">
                  {/* Header & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        ₹
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Statement Mathematical Reconciliation & Balance Sync
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Formula: Opening Balance + Credits − Debits = Closing Balance
                        </p>
                      </div>
                    </div>

                    {liveDiff !== null && (
                      <div className="flex items-center space-x-2">
                        {isLiveReconciled ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            100% Math Match (₹0.00 difference)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            Variance: {formatCurrency(liveDiff, userCurrency)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4 Reconciliation Metric Columns */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    {/* Opening Balance */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        1. Opening Balance
                      </span>
                      <div className="flex items-center space-x-1">
                        <span className="text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={statementOpeningBalance ?? ""}
                          onChange={(e) =>
                            setStatementOpeningBalance(
                              e.target.value === "" ? null : parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full font-bold text-slate-900 bg-transparent focus:outline-none focus:bg-white px-1 py-0.5 rounded border border-transparent focus:border-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Start of period</span>
                    </div>

                    {/* Credits / Income */}
                    <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block mb-1">
                        2. Total Credits (+)
                      </span>
                      <strong className="text-emerald-700 font-bold block text-sm">
                        +{formatCurrency(selectedCredits, userCurrency)}
                      </strong>
                      <span className="text-[10px] text-emerald-600/80 block mt-0.5">
                        {selectedTxList.filter((t) => t.transaction_type === "INCOME").length} income credits
                      </span>
                    </div>

                    {/* Debits / Expense */}
                    <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-100">
                      <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider block mb-1">
                        3. Total Debits (−)
                      </span>
                      <strong className="text-rose-700 font-bold block text-sm">
                        −{formatCurrency(selectedDebits, userCurrency)}
                      </strong>
                      <span className="text-[10px] text-rose-600/80 block mt-0.5">
                        {selectedTxList.filter((t) => t.transaction_type === "EXPENSE").length} expense debits
                      </span>
                    </div>

                    {/* Closing Balance */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        4. Closing Balance
                      </span>
                      <div className="flex items-center space-x-1">
                        <span className="text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={statementClosingBalance ?? ""}
                          onChange={(e) =>
                            setStatementClosingBalance(
                              e.target.value === "" ? null : parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full font-bold text-slate-900 bg-transparent focus:outline-none focus:bg-white px-1 py-0.5 rounded border border-transparent focus:border-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Calc: {calculatedClBal !== null ? formatCurrency(calculatedClBal, userCurrency) : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Account Synchronization Options */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncOpeningBalance}
                        onChange={(e) => setSyncOpeningBalance(e.target.checked)}
                        disabled={statementOpeningBalance === null}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 disabled:opacity-40"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">
                          Set Account Opening Balance to Statement (
                          {statementOpeningBalance !== null ? formatCurrency(statementOpeningBalance, userCurrency) : "N/A"})
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Ensures your starting balance matches the statement's starting point
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncClosingBalance}
                        onChange={(e) => setSyncClosingBalance(e.target.checked)}
                        disabled={statementClosingBalance === null}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 disabled:opacity-40"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">
                          Guarantee Live Balance Matches Statement (
                          {statementClosingBalance !== null ? formatCurrency(statementClosingBalance, userCurrency) : "N/A"})
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Guarantees your dashboard balance perfectly equals your bank statement
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              );
            })()}

            {/* Summary Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <span className="font-semibold text-slate-700 whitespace-nowrap">
                  Target Account:
                </span>
                <select
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 bg-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={String(acc.id)}>
                      {acc.name}
                    </option>
                  ))}
                  {detectedAccountInfo?.suggested_account_name && (
                    <option value={`__NEW_ACC__:${detectedAccountInfo.suggested_account_name}`}>
                      ✨ Auto-create &quot;{detectedAccountInfo.suggested_account_name}&quot;
                    </option>
                  )}
                  {accounts.length === 0 && !detectedAccountInfo && (
                    <option value="__AUTO_DETECT__">
                      ✨ Auto-create Primary Account
                    </option>
                  )}
                </select>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">
                  Selected: <strong className="text-emerald-700">{extractedTransactions.filter((t) => t.selected).length}</strong> of {extractedTransactions.length}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleToggleSelectAll(
                      extractedTransactions.filter((t) => t.selected).length !== extractedTransactions.length
                    )
                  }
                  className="text-xs py-1 px-2.5"
                >
                  {extractedTransactions.filter((t) => t.selected).length === extractedTransactions.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
            </div>

            {/* Editable Transactions Review Table */}
            <div className="overflow-x-auto max-h-[50vh] border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">Use</th>
                    <th className="py-2.5 px-3 w-32">Date</th>
                    <th className="py-2.5 px-3 w-28">Type</th>
                    <th className="py-2.5 px-3">Merchant / Payee</th>
                    <th className="py-2.5 px-3 w-44">Category</th>
                    <th className="py-2.5 px-3 text-right w-32">Amount</th>
                    <th className="py-2.5 px-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {extractedTransactions.map((tx) => {
                    const isExpense = tx.transaction_type === "EXPENSE";
                    const matchingCategories = categories.filter((c) => c.category_type === tx.transaction_type);

                    return (
                      <tr
                        key={tx.tempId}
                        className={`transition-colors ${
                          tx.selected ? "hover:bg-slate-50/80" : "opacity-40 bg-slate-50/40"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={tx.selected}
                            onChange={() => handleToggleRowSelect(tx.tempId)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                          />
                        </td>

                        {/* Date */}
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={tx.transaction_date}
                            onChange={(e) =>
                              handleUpdateExtractedField(tx.tempId, "transaction_date", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 bg-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Type Toggle */}
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              const newType = isExpense ? "INCOME" : "EXPENSE";
                              handleUpdateExtractedField(tx.tempId, "transaction_type", newType);
                              // Reset category if not matching new type
                              const match = categories.find((c) => c.category_type === newType);
                              handleUpdateExtractedField(tx.tempId, "category_id", match ? String(match.id) : "");
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase cursor-pointer transition-colors ${
                              isExpense
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {isExpense ? "Expense" : "Income"}
                          </button>
                        </td>

                        {/* Merchant */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={tx.merchant}
                            onChange={(e) =>
                              handleUpdateExtractedField(tx.tempId, "merchant", e.target.value)
                            }
                            placeholder="Merchant / Payee"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 bg-white font-medium focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Category */}
                        <td className="py-2 px-3">
                          {(() => {
                            const isNew = !tx.category_id && tx.category_name;
                            const selectVal = tx.category_id
                              ? String(tx.category_id)
                              : isNew
                              ? `__NEW__:${tx.category_name}`
                              : "";

                            return (
                              <div className="space-y-1">
                                <select
                                  value={selectVal}
                                  onChange={(e) => handleCategorySelectChange(tx.tempId, e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                  <option value="">Uncategorized</option>
                                  {isNew && (
                                    <option value={`__NEW__:${tx.category_name}`}>
                                      ✨ Auto-create &quot;{tx.category_name}&quot;
                                    </option>
                                  )}
                                  {matchingCategories.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                {isNew && (
                                  <span className="inline-flex items-center text-[10px] text-emerald-600 font-semibold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100">
                                    Auto-created on import
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Amount */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={tx.amount}
                            onChange={(e) =>
                              handleUpdateExtractedField(tx.tempId, "amount", e.target.value)
                            }
                            className="w-full text-right rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveExtractedRow(tx.tempId)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            title="Remove transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportStep(1)}
                disabled={isBulkImporting}
              >
                ← Back to Upload
              </Button>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isBulkImporting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmBulkImport}
                  isLoading={isBulkImporting}
                  disabled={extractedTransactions.filter((t) => t.selected).length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <span>
                    Import {extractedTransactions.filter((t) => t.selected).length} Transaction(s)
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

