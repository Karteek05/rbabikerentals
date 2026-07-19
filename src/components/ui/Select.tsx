"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/app/components/Icon";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false,
  className = "",
  "aria-label": ariaLabel
}: SelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((state) => !state)}
        className="field-control flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "" : "text-[color:var(--color-muted)]"}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevronDown"
          className={`h-4 w-4 shrink-0 text-[color:var(--color-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-lg border border-[color:var(--color-line)] bg-white py-1 shadow-[0_18px_44px_color-mix(in_oklch,var(--color-ink)_18%,transparent)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-[color:var(--color-paper-2)] font-semibold text-[color:var(--color-ink)]"
                      : "text-[color:var(--color-copy)] hover:bg-[color:var(--color-paper-2)]"
                  } ${option.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
