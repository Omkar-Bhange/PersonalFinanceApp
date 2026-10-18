import React, { useState, useEffect } from "react";
import {
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Info,
  Unlink,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { telegramService } from "../../services/telegramService";

export function TelegramConnectModal({ isOpen, onClose }) {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [linkData, setLinkData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await telegramService.getStatus();
      if (res?.success) {
        setStatus(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load Telegram status.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setLinkData(null);
      setSuccess("");
      setError("");
    }
  }, [isOpen]);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setError("");
    try {
      const res = await telegramService.generateLinkCode();
      if (res?.success) {
        setLinkData(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to generate link code. Ensure TELEGRAM_BOT_TOKEN is set in server environment.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (linkData?.code) {
      navigator.clipboard.writeText(linkData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    setError("");
    try {
      const res = await telegramService.unlink();
      if (res?.success) {
        setSuccess("Telegram account disconnected successfully.");
        await fetchStatus();
      }
    } catch (err) {
      setError(err.message || "Failed to disconnect Telegram.");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Telegram Assistant Bot"
      description="Record transactions and forward bank SMS directly from Telegram"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Global Notifications */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {error.includes("Token") && (
                <button
                  type="button"
                  onClick={() => setShowConfigHelp(true)}
                  className="block text-emerald-700 font-semibold underline mt-1"
                >
                  View Telegram Bot Setup Instructions
                </button>
              )}
            </div>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-fadeIn"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="p-8 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
            <span className="text-xs text-slate-500 font-medium">Checking connection...</span>
          </div>
        ) : status?.is_connected ? (
          /* Connected State View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-200 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900">Telegram Connected</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Linked to:{" "}
                    <strong>
                      {status.first_name ? `${status.first_name} ` : ""}
                      {status.telegram_username ? `(@${status.telegram_username})` : "Telegram User"}
                    </strong>
                  </p>
                </div>
              </div>

              {status.default_account_name && (
                <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-100 text-xs text-slate-700 flex items-center justify-between">
                  <span>Default Account:</span>
                  <strong className="text-emerald-900">{status.default_account_name}</strong>
                </div>
              )}
            </div>

            {/* Quick Usage Tips */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <span className="font-semibold text-slate-900 block flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>You're all set! Try sending these in Telegram:</span>
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-600 pl-4 list-disc">
                <li>
                  <strong>Forward Bank SMS:</strong> Automatic debit/credit auto-logging
                </li>
                <li>
                  <strong>Text Quick Expense:</strong> <code className="bg-white px-1 rounded border">Coffee 150</code> or{" "}
                  <code className="bg-white px-1 rounded border">Fuel 500 at Shell</code>
                </li>
                <li>
                  <strong>Check Balances:</strong> <code className="bg-white px-1 rounded border">/balance</code>
                </li>
                <li>
                  <strong>Recent Entries:</strong> <code className="bg-white px-1 rounded border">/recent</code>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                isLoading={isUnlinking}
                className="text-xs text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
              >
                <Unlink className="w-3.5 h-3.5 mr-1.5" />
                <span>Disconnect Bot</span>
              </Button>

              {status.bot_username && (
                <a
                  href={`https://t.me/${status.bot_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open Telegram Chat</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Not Connected State View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Send className="w-5 h-5 ml-0.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Connect Your Telegram</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Forward your UPI & bank transaction SMS or text quick daily expenses directly to your personal bot to auto-record them instantly.
                  </p>
                </div>
              </div>

              {!linkData ? (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    onClick={handleGenerateCode}
                    isLoading={isGenerating}
                    className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Generate Secure Link Code</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-xl bg-white border-2 border-emerald-500/80 text-center space-y-1 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Your 15-Minute Link Code
                    </span>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-2xl font-black text-slate-900 tracking-widest font-mono">
                        {linkData.code}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                        title="Copy code"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400">Valid for 15 minutes</span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">Two ways to connect:</p>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                      <li>
                        Click the button below to open Telegram and tap <strong>Start</strong>.
                      </li>
                      <li>
                        Or open <strong>@{linkData.bot_username}</strong> in Telegram and send:{" "}
                        <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono font-bold text-slate-800">
                          /link {linkData.code}
                        </code>
                      </li>
                    </ol>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <a
                      href={linkData.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold bg-sky-500 text-white hover:bg-sky-600 transition-colors shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                      <span>Open Bot & Connect Automatically</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <Button variant="outline" size="sm" onClick={fetchStatus} title="Refresh connection status">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle Bot Setup Help */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowConfigHelp(!showConfigHelp)}
                className="text-xs text-slate-500 hover:text-slate-800 underline inline-flex items-center space-x-1"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Need to create or configure the Telegram bot?</span>
              </button>
            </div>

            {showConfigHelp && (
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs space-y-2 animate-fadeIn border border-slate-800">
                <p className="font-bold text-white flex items-center space-x-1.5">
                  <span>🤖 Setting up your Telegram Bot in 2 minutes</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-300">
                  <li>
                    Open Telegram and search for <strong>@BotFather</strong>.
                  </li>
                  <li>
                    Send <code className="text-emerald-400">/newbot</code> and follow prompts to give it a name & username.
                  </li>
                  <li>
                    BotFather will reply with an <strong>API Token</strong> (e.g. <code className="text-emerald-400">7182910:AAHk...</code>).
                  </li>
                  <li>
                    Add <code className="text-emerald-400">TELEGRAM_BOT_TOKEN=&lt;YOUR_TOKEN&gt;</code> to your Render environment variables or <code className="text-emerald-400">backend/.env</code>.
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
