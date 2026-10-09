import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "../components/common/Button";

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">404 - Page Not Found</h1>
      <p className="text-slate-500 mt-2 max-w-md text-sm">
        The page you are looking for does not exist in the Personal Finance application.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button variant="primary" className="flex items-center space-x-2">
            <Home className="w-4 h-4" />
            <span>Return to Overview</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

