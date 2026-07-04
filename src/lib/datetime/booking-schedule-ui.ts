export const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

export function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateTimeParts(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function toDateTimeIso(dateValue: string, timeValue: string) {
  return fromDateTimeParts(dateValue, timeValue).toISOString();
}

export function nearestTimeSlot(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  let closest = TIME_SLOTS[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const slot of TIME_SLOTS) {
    const [hours, mins] = slot.split(":").map(Number);
    const slotMinutes = hours * 60 + mins;
    const distance = Math.abs(slotMinutes - minutes);
    if (distance < closestDistance) {
      closest = slot;
      closestDistance = distance;
    }
  }
  return closest;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function buildCalendarCells(viewMonth: Date) {
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    return {
      date,
      inCurrentMonth: date.getMonth() === viewMonth.getMonth()
    };
  });
}

export function formatDateLabel(dateValue: string) {
  const date = parseDateValue(dateValue);
  if (!date) return "Select date";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function isoToScheduleParts(iso: string) {
  const date = new Date(iso);
  return {
    dateValue: toDateValue(date),
    timeValue: nearestTimeSlot(date)
  };
}

export function buildInitialScheduleParts(hoursUntilPickup = 1, rentalHours = 24 * 7) {
  const pickup = new Date(Date.now() + hoursUntilPickup * 60 * 60 * 1000);
  const drop = new Date(pickup.getTime() + rentalHours * 60 * 60 * 1000);
  return {
    pickupDate: toDateValue(pickup),
    pickupTime: nearestTimeSlot(pickup),
    dropDate: toDateValue(drop),
    dropTime: nearestTimeSlot(drop)
  };
}
