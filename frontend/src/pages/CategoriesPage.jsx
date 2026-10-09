import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Tags,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Globe,
  User,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Info,
  Filter,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { categoryService } from "../services/categoryService";
import { formatDate } from "../utils/currency";

// Preset colors for custom categories
const COLOR_PRESETS = [
  { name: "Emerald", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Slate", value: "#64748b" },
];

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL | INCOME | EXPENSE
  const [ownershipFilter, setOwnershipFilter] = useState("ALL"); // ALL | GLOBAL | CUSTOM

  // Modal & Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category_type: "EXPENSE",
    icon: "",
    color: "#10b981",
  });
  const [formErrors, setFormErrors] = useState({});
  const [formServerError, setFormServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories from backend
  const fetchCategories = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);
    setError("");

    try {
      const response = await categoryService.getCategories();
      if (response?.success && Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load categories. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Derived statistics
  const stats = useMemo(() => {
    const total = categories.length;
    const income = categories.filter((c) => c.category_type === "INCOME").length;
    const expense = categories.filter((c) => c.category_type === "EXPENSE").length;
    const custom = categories.filter((c) => c.user_id !== null).length;
    const global = categories.filter((c) => c.user_id === null).length;
    return { total, income, expense, custom, global };
  }, [categories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Type filter
      if (typeFilter !== "ALL" && cat.category_type !== typeFilter) {
        return false;
      }
      // Ownership filter
      if (ownershipFilter === "GLOBAL" && cat.user_id !== null) {
        return false;
      }
      if (ownershipFilter === "CUSTOM" && cat.user_id === null) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = cat.name?.toLowerCase().includes(query);
        const matchesType = cat.category_type?.toLowerCase().includes(query);
        return matchesName || matchesType;
      }
      return true;
    });
  }, [categories, typeFilter, ownershipFilter, searchQuery]);

  // Modal Handlers
  const handleOpenModal = () => {
    setFormData({
      name: "",
      category_type: "EXPENSE",
      icon: "",
      color: "#10b981",
    });
    setFormErrors({});
    setFormServerError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setFormErrors({});
    setFormServerError("");
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (formServerError) {
      setFormServerError("");
    }
  };

  const validateForm = () => {
    const errors = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      errors.name = "Category name is required";
    } else if (trimmedName.length > 100) {
      errors.name = "Name must be at most 100 characters";
    }

    if (!["INCOME", "EXPENSE"].includes(formData.category_type)) {
      errors.category_type = "Invalid category type";
    }

    // Check for client-side duplicate name and type
    const duplicate = categories.some(
      (c) =>
        c.name.toLowerCase() === trimmedName.toLowerCase() &&
        c.category_type === formData.category_type
    );
    if (duplicate) {
      errors.name = `A ${formData.category_type.toLowerCase()} category with this name already exists`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormServerError("");

    try {
      const payload = {
        name: formData.name.trim(),
        category_type: formData.category_type,
        icon: formData.icon.trim() || undefined,
        color: formData.color || undefined,
      };

      const response = await categoryService.createCategory(payload);

      if (response?.success) {
        setSuccessMessage(`Category "${response.data.name}" created successfully.`);
        setTimeout(() => setSuccessMessage(""), 5000);
        setIsModalOpen(false);
        fetchCategories(true);
      } else {
        setFormServerError(response?.message || "Failed to create category");
      }
    } catch (err) {
      setFormServerError(err.message || "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Tags className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Categories
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Organize income and expense transactions using built-in system standards and custom user categories.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchCategories(true)}
            disabled={isRefreshing}
            title="Refresh categories"
            aria-label="Refresh categories"
            className="text-slate-600 hover:text-slate-900 h-9 px-2.5"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenModal}
            className="flex items-center space-x-1.5 h-9"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCategories()}
            className="text-xs shrink-0 border-rose-300 hover:bg-rose-100"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Total Categories</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {isLoading ? "..." : stats.total}
            </div>
            <div className="text-xs text-slate-400 mt-1">Available for tagging</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Expense Categories</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {isLoading ? "..." : stats.expense}
            </div>
            <div className="text-xs text-slate-400 mt-1">For spending tracking</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Income Categories</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2">
              {isLoading ? "..." : stats.income}
            </div>
            <div className="text-xs text-slate-400 mt-1">For earnings tracking</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Custom Categories</span>
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              {isLoading ? "..." : stats.custom}
            </div>
            <div className="text-xs text-slate-400 mt-1">Created by you</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search categories by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50"
              />
            </div>

            {/* Type & Ownership Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
                <button
                  onClick={() => setTypeFilter("ALL")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    typeFilter === "ALL"
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setTypeFilter("EXPENSE")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    typeFilter === "EXPENSE"
                      ? "bg-rose-50 text-rose-700 shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setTypeFilter("INCOME")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    typeFilter === "INCOME"
                      ? "bg-emerald-50 text-emerald-700 shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Income
                </button>
              </div>

              {/* Ownership Filter */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
                <button
                  onClick={() => setOwnershipFilter("ALL")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    ownershipFilter === "ALL"
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Sources
                </button>
                <button
                  onClick={() => setOwnershipFilter("GLOBAL")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    ownershipFilter === "GLOBAL"
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => setOwnershipFilter("CUSTOM")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    ownershipFilter === "CUSTOM"
                      ? "bg-blue-50 text-blue-700 shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories List View */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Tags className="w-5 h-5 text-slate-700" />
              <CardTitle>Category Directory</CardTitle>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredCategories.length} of {categories.length} categories
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400">
              <Tags className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No categories found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery || typeFilter !== "ALL" || ownershipFilter !== "ALL"
                  ? "Try adjusting your search query or filters."
                  : "Create your first custom category using the button above."}
              </p>
              {(searchQuery || typeFilter !== "ALL" || ownershipFilter !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("ALL");
                    setOwnershipFilter("ALL");
                  }}
                  className="mt-3 text-xs"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
                    <th className="py-3 px-4 font-semibold">Category Name</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold">Scope / Ownership</th>
                    <th className="py-3 px-4 font-semibold">Color Tag</th>
                    <th className="py-3 px-4 font-semibold">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((cat) => {
                    const isIncome = cat.category_type === "INCOME";
                    const isGlobal = cat.user_id === null;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <div className="flex items-center space-x-2.5">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color || (isIncome ? "#10b981" : "#f43f5e") }}
                            />
                            <span className="font-semibold text-slate-900">{cat.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isIncome ? (
                            <Badge variant="success" className="text-xs inline-flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Income
                            </Badge>
                          ) : (
                            <Badge variant="danger" className="text-xs inline-flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              Expense
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isGlobal ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              <Globe className="w-3 h-3 text-slate-500" />
                              <span>Global Standard</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <User className="w-3 h-3 text-blue-500" />
                              <span>Custom (Private)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                          {cat.color ? (
                            <div className="flex items-center space-x-1.5">
                              <span
                                className="w-3 h-3 rounded border border-slate-300"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span>{cat.color}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Default</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-xs">
                          {cat.created_at ? formatDate(cat.created_at) : "System standard"}
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

      {/* Information Banner regarding Category Management & Integrity */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs leading-relaxed flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-slate-900">Category Architecture & History Preservation:</strong> Global categories are standard across all user accounts and are protected against modification. Custom categories created by you are private to your account and immediately available when recording transactions. To protect the integrity of historical financial reports and calculations, category assignment is permanent.
        </div>
      </div>

      {/* Category Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Create New Category"
        description="Add a custom income or expense category tailored to your spending tracking."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formServerError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formServerError}</span>
            </div>
          )}

          {/* Category Type */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Category Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleFormChange("category_type", "EXPENSE")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                  formData.category_type === "EXPENSE"
                    ? "border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <span>Expense Category</span>
              </button>
              <button
                type="button"
                onClick={() => handleFormChange("category_type", "INCOME")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                  formData.category_type === "INCOME"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Income Category</span>
              </button>
            </div>
          </div>

          {/* Category Name */}
          <Input
            label="Category Name"
            placeholder="e.g. Freelance Design, Subscriptions, Gym, Groceries"
            value={formData.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            error={formErrors.name}
            required
            autoFocus
          />

          {/* Color Tag Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Color Accent (Optional)
            </label>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleFormChange("color", p.value)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    formData.color === p.value
                      ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: p.value }}
                  title={p.name}
                  aria-label={p.name}
                />
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

