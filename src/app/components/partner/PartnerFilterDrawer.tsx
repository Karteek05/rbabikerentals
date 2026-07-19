"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";
import DatePicker from "@/components/ui/DatePicker";

type PartnerFilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  onApply: (weekStart: string) => void;
  onReset: () => void;
};

export default function PartnerFilterDrawer({
  open,
  onClose,
  weekStart,
  onApply,
  onReset
}: PartnerFilterDrawerProps) {
  const [draftWeekStart, setDraftWeekStart] = useState(weekStart);

  useEffect(() => {
    if (open) setDraftWeekStart(weekStart);
  }, [open, weekStart]);

  if (!open) return null;

  return (
    <div className="partner-filter-backdrop" onClick={onClose} role="presentation">
      <aside
        className="partner-filter-drawer"
        onClick={(event) => event.stopPropagation()}
        aria-label="Week filter"
      >
        <div className="partner-filter-header">
          <button type="button" className="partner-icon-btn" onClick={onClose} aria-label="Close filter">
            <Icon name="close" className="w-4 h-4" />
          </button>
          <h2>Week</h2>
        </div>

        <div className="partner-filter-body">
          <label className="form-label" htmlFor="partner-week-start">
            Week start date
          </label>
          <DatePicker
            value={draftWeekStart}
            onChange={setDraftWeekStart}
            aria-label="Week start date"
          />
        </div>

        <div className="partner-filter-actions">
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            Reset
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onApply(draftWeekStart);
              onClose();
            }}
          >
            Apply
          </button>
        </div>
      </aside>
    </div>
  );
}
