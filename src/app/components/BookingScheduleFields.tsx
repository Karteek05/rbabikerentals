"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/app/components/Icon";
import {
  TIME_SLOTS,
  addMonths,
  buildCalendarCells,
  formatDateLabel,
  fromDateTimeParts,
  isSameDay,
  parseDateValue,
  startOfDay,
  toDateValue
} from "@/lib/datetime/booking-schedule-ui";

function CalendarDatePicker({
  value,
  onChange,
  minDate
}: {
  value: string;
  onChange: (next: string) => void;
  minDate?: string;
}) {
  const selectedDate = parseDateValue(value) ?? new Date();
  const min = minDate ? parseDateValue(minDate) : null;
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    const picked = parseDateValue(value);
    if (!picked) return;
    setViewMonth(new Date(picked.getFullYear(), picked.getMonth(), 1));
  }, [value]);

  const cells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="field-control flex w-full items-center justify-between"
      >
        <span className="text-left">{formatDateLabel(value)}</span>
        <Icon name="calendar" className="h-4 w-4 text-[color:var(--color-muted)]" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[320px] max-w-[calc(100vw-4rem)] rounded-lg border border-[color:var(--color-line)] bg-white p-3 shadow-[0_18px_44px_color-mix(in_oklch,var(--color-ink)_18%,transparent)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((month) => addMonths(month, -1))}
              className="h-8 w-8 rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]"
              aria-label="Previous month"
            >
              {"<"}
            </button>
            <div className="text-sm font-bold">
              {viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              onClick={() => setViewMonth((month) => addMonths(month, 1))}
              className="h-8 w-8 rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]"
              aria-label="Next month"
            >
              {">"}
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-center text-[11px] font-semibold text-[color:var(--color-muted)]">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const dateValue = toDateValue(cell.date);
              const disabled = !!min && startOfDay(cell.date).getTime() < startOfDay(min).getTime();
              const selected = isSameDay(cell.date, selectedDate);
              return (
                <button
                  key={dateValue}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(dateValue);
                    setOpen(false);
                  }}
                  className={`h-9 rounded-md text-sm transition-colors ${
                    selected
                      ? "bg-[color:var(--color-ink)] text-white"
                      : cell.inCurrentMonth
                        ? "text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]"
                        : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-paper-2)]"
                  } ${disabled ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingScheduleFields({
  pickupDate,
  pickupTime,
  dropDate,
  dropTime,
  onPickupDateChange,
  onPickupTimeChange,
  onDropDateChange,
  onDropTimeChange,
  minPickupDate
}: {
  pickupDate: string;
  pickupTime: string;
  dropDate: string;
  dropTime: string;
  onPickupDateChange: (value: string) => void;
  onPickupTimeChange: (value: string) => void;
  onDropDateChange: (value: string) => void;
  onDropTimeChange: (value: string) => void;
  minPickupDate?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">
          Pickup date & time
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <CalendarDatePicker value={pickupDate} onChange={onPickupDateChange} minDate={minPickupDate} />
          <select
            className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            value={pickupTime}
            onChange={(event) => onPickupTimeChange(event.target.value)}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-uber-body-gray">
          Drop date & time
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <CalendarDatePicker
            value={dropDate}
            onChange={onDropDateChange}
            minDate={pickupDate}
          />
          <select
            className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            value={dropTime}
            onChange={(event) => onDropTimeChange(event.target.value)}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
        {fromDateTimeParts(dropDate, dropTime).getTime() <= fromDateTimeParts(pickupDate, pickupTime).getTime() && (
          <p className="mt-2 text-xs text-red-600">Drop must be after pickup.</p>
        )}
      </div>
    </div>
  );
}
