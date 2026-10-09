import React from "react";
import { ArrowLeftRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Badge } from "../components/common/Badge";

export function TransactionsPlaceholderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Transactions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Income, expenses, categorization, and monthly reconciliation
          </p>
        </div>
        <Badge variant="info">Upcoming Feature</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2 text-slate-900 font-semibold">
            <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
            <CardTitle>Transactions Module</CardTitle>
          </div>
          <CardDescription>
            Backend API endpoints (`GET /api/v1/transactions`, `POST /api/v1/transactions`, `PUT /api/v1/transactions/:id`, `DELETE /api/v1/transactions/:id`, `GET /api/v1/transactions/summary`) are active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-600 text-sm">
            <p>
              This screen will provide transaction history tables, filtering by date/type, category tagging, and creation/update modals during the finance UI phase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

