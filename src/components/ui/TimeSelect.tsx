"use client";

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import { TIME_SLOTS } from "@/lib/datetime/booking-schedule-ui";

type TimeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options?: Array<{ value: string; label: string }>;
  className?: string;
  "aria-label"?: string;
};

export default function TimeSelect({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel = "Choose time"
}: TimeSelectProps) {
  const selectOptions = useMemo(
    () =>
      options ??
      TIME_SLOTS.map((slot) => ({
        value: slot,
        label: slot
      })),
    [options]
  );

  return (
    <Select
      value={value}
      onChange={onChange}
      options={selectOptions}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
