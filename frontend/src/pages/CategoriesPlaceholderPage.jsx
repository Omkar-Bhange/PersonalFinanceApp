import React from "react";
import { Tags } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/common/Card";
import { Badge } from "../components/common/Badge";

export function CategoriesPlaceholderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Categories
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Global standard categories and user-owned custom categories
          </p>
        </div>
        <Badge variant="info">Upcoming Feature</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2 text-slate-900 font-semibold">
            <Tags className="w-5 h-5 text-emerald-600" />
            <CardTitle>Categories Module</CardTitle>
          </div>
          <CardDescription>
            Backend API endpoints (`GET /api/v1/categories`, `POST /api/v1/categories`) are implemented with user isolation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-600 text-sm">
            <p>
              This screen will allow managing custom income and expense categories, assigning icons, colors, and reviewing expense distribution.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

