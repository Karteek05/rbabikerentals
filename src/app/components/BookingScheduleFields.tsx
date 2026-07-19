"use client";

import DatePicker from "@/components/ui/DatePicker";
import TimeSelect from "@/components/ui/TimeSelect";
import { fromDateTimeParts } from "@/lib/datetime/booking-schedule-ui";

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
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
          Pickup date & time
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <DatePicker
            value={pickupDate}
            onChange={onPickupDateChange}
            minDate={minPickupDate}
            aria-label="Pickup date"
          />
          <TimeSelect value={pickupTime} onChange={onPickupTimeChange} aria-label="Pickup time" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
          Drop date & time
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <DatePicker
            value={dropDate}
            onChange={onDropDateChange}
            minDate={pickupDate}
            aria-label="Drop date"
          />
          <TimeSelect value={dropTime} onChange={onDropTimeChange} aria-label="Drop time" />
        </div>
        {fromDateTimeParts(dropDate, dropTime).getTime() <= fromDateTimeParts(pickupDate, pickupTime).getTime() && (
          <p className="mt-2 text-xs text-red-600">Drop must be after pickup.</p>
        )}
      </div>
    </div>
  );
}
