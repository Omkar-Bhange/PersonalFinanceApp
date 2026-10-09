import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Activity, User, LogOut, LogIn } from "lucide-react";
import { healthService } from "../../services/healthService";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { useAuth } from "../../hooks/useAuth";

export function Header({ onMenuClick }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState("checking"); // 'online' | 'offline' | 'checking'

  useEffect(() => {
    let isMounted = true;
    async function checkApi() {
      try {
        const res = await healthService.checkHealth();
        if (isMounted) {
          if (res?.success || res?.status === "healthy") {
            setBackendStatus("online");
          } else {
            setBackendStatus("offline");
          }
        }
      } catch {
        if (isMounted) {
          setBackendStatus("offline");
        }
      }
    }

    checkApi();
    const interval = setInterval(checkApi, 30000); // Poll every 30s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <h1 className="text-base font-semibold text-slate-800">
            Personal Finance Workspace
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Backend status indicator */}
        <div className="hidden sm:flex items-center space-x-2">
          {backendStatus === "online" ? (
            <Badge variant="success" className="flex items-center space-x-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>API Online</span>
            </Badge>
          ) : backendStatus === "checking" ? (
            <Badge variant="neutral" className="flex items-center space-x-1.5 py-1">
              <Activity className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Connecting API</span>
            </Badge>
          ) : (
            <Badge variant="danger" className="flex items-center space-x-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>API Offline</span>
            </Badge>
          )}
        </div>

        {/* User profile & auth actions */}
        <div className="flex items-center space-x-3 pl-2 sm:border-l sm:border-slate-200">
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-semibold text-xs shadow-xs">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-xs font-semibold text-slate-800 block truncate max-w-[120px]">
                    {user?.name || "User"}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate max-w-[120px] -mt-0.5">
                    {user?.email || "Authenticated"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link to="/login">
                <Button variant="outline" size="sm" className="flex items-center space-x-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
