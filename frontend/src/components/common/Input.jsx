import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    id,
    name,
    type = "text",
    className,
    disabled = false,
    ...props
  },
  ref
) {
  const inputId = id || name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        name={name}
        type={type}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg border px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:cursor-not-allowed",
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
            : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20",
          className
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-rose-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
});

