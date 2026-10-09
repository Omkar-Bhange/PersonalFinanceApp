import React from "react";
import { Wallet, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Badge } from "../components/common/Badge";

export function AccountsPlaceholderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Accounts Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Bank accounts, cash wallets, and dynamic balance calculations
          </p>
        </div>
        <Badge variant="info">Upcoming Feature</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2 text-slate-900 font-semibold">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <CardTitle>Accounts Module</CardTitle>
          </div>
          <CardDescription>
            Backend API endpoints (`GET /api/v1/accounts`, `POST /api/v1/accounts`, `PUT /api/v1/accounts/:id`) are implemented and tested.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-600 text-sm">
            <p>
              This screen will render live user accounts, opening balances, dynamic income/expense aggregates, and current balances when financial UI features are scheduled.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

