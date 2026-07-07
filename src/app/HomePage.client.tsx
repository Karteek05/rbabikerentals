"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Icon, { type IconName } from "./components/Icon";
import {
  GST_INCLUSIVE_COPY,
  PACKAGE_PLANS,
  PUBLIC_FLEET,
  getPackageRate,
  type PublicFleetVehicle
} from "@/lib/fleet/catalog";

const HOW_STEPS: Array<{ icon: IconName; title: string; desc: string }> = [
  {
    icon: "location",
    title: "Choose the package",
    desc: "Pick a 1 week, 15 day, or monthly rental plan with GST included."
  },
  {
    icon: "scooter",
    title: "Pick the scooter",
    desc: "Compare Activa 110, Dio 110, and Jupiter 125 availability."
  },
  {
    icon: "phone",
    title: "Share contact details",
    desc: "Leave your name, email, mobile, and pickup note for confirmation."
  },
  {
    icon: "shield",
    title: "Confirm and ride",
    desc: "The team reviews availability and follows up with payment details."
  }
];

const RENTAL_PLANS = [
  { name: "1 week", detail: "Short stays and quick city use", value: "From Rs. 1,600" },
  { name: "15 days", detail: "Half-month work or travel plans", value: "From Rs. 3,200" },
  { name: "Monthly", detail: "Longer local commutes", value: "From Rs. 6,000" }
];

const TRUST_FACTS: Array<{ icon: IconName; title: string; detail: string }> = [
  {
    icon: "money",
    title: "GST included",
    detail: "Package prices are shown with GST included, so the fare is easy to compare."
  },
  {
    icon: "shield",
    title: "Availability review",
    detail: "Bookings are reviewed against fleet availability before final confirmation."
  },
  {
    icon: "scooter",
    title: "Scooter-first fleet",
    detail: "The current fleet focuses on Activa 110, Dio 110, and Jupiter 125 scooters."
  },
  {
    icon: "support",
    title: "Ops-managed handoff",
    detail: "Admin and partner dashboards help the team handle bookings and fleet updates."
  }
];

const LOCATIONS = [
  "Sarjapur Road"
];

const FAQS = [
  {
    q: "Are the prices inclusive of GST?",
    a: "Yes. The listed 1 week, 15 day, and monthly package rates include GST."
  },
  {
    q: "How is the deposit handled?",
    a: "The security deposit is added during booking and tied to return-condition workflows."
  },
  {
    q: "Can I extend a live booking?",
    a: "Yes. Use the extension option from My Bookings on an active ride, subject to vehicle availability."
  },
  {
    q: "How is pricing shown?",
    a: "Package fares are shown upfront for each scooter model, including GST."
  }
];

const TIME_OPTIONS = Array.from({ length: 36 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const labelDate = new Date(2026, 0, 1, hours, minutes);
  return {
    value,
    label: labelDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
  };
});

function toDateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function fromDateTimeParts(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function nearestTimeSlot(date: Date) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  let closest = TIME_OPTIONS[0].value;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of TIME_OPTIONS) {
    const [hours, minutes] = slot.value.split(":").map(Number);
    const slotMinutes = hours * 60 + minutes;
    const distance = Math.abs(slotMinutes - totalMinutes);
    if (distance < bestDistance) {
      closest = slot.value;
      bestDistance = distance;
    }
  }
  return closest;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildCalendarCells(viewMonth: Date) {
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

function buildInitialSchedule() {
  const now = new Date();
  const pickup = new Date(now.getTime() + 60 * 60 * 1000);
  const drop = new Date(pickup.getTime() + 24 * 60 * 60 * 1000);
  return {
    pickupDate: toDateValue(pickup),
    pickupTime: nearestTimeSlot(pickup),
    dropDate: toDateValue(drop),
    dropTime: nearestTimeSlot(drop)
  };
}

function toDateTimeIso(dateValue: string, timeValue: string) {
  return fromDateTimeParts(dateValue, timeValue).toISOString();
}

function hoursForDuration(duration: "weekly" | "fortnight" | "monthly") {
  switch (duration) {
    case "fortnight":
      return 24 * 15;
    case "weekly":
      return 24 * 7;
    case "monthly":
      return 24 * 30;
    default:
      return 24;
  }
}

function formatDateLabel(dateValue: string) {
  const date = parseDateValue(dateValue);
  if (!date) return "Select date";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateTimeLabel(dateValue: string, timeValue: string) {
  const date = fromDateTimeParts(dateValue, timeValue);
  return (
    date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }) + ` ${timeValue}`
  );
}

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
        className="field-control flex items-center justify-between"
      >
        <span className="text-left">{formatDateLabel(value)}</span>
        <Icon name="calendar" className="h-4 w-4 text-[color:var(--color-muted)]" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-[320px] max-w-[calc(100vw-4rem)] rounded-lg border border-[color:var(--color-line)] bg-white p-3 shadow-[0_18px_44px_color-mix(in_oklch,var(--color-ink)_18%,transparent)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((month) => addMonths(month, -1))}
              className="nav-focus h-8 w-8 rounded-md border border-[color:var(--color-line)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]"
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
              className="nav-focus h-8 w-8 rounded-md border border-[color:var(--color-line)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]"
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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[color:var(--color-line)] last:border-0">
      <button
        className="nav-focus flex w-full items-center justify-between gap-4 py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-bold text-[color:var(--color-ink)] sm:text-base">{q}</span>
        <span className={`text-2xl font-light text-[color:var(--color-muted)] transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      {open && <p className="max-w-2xl pb-5 pr-8 text-sm leading-relaxed text-[color:var(--color-copy)]">{a}</p>}
    </div>
  );
}

function VehicleCard({ v }: { v: PublicFleetVehicle }) {
  return (
    <Link href={`/book/${v.id}`} className="group block">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="card transition-colors duration-200 group-hover:border-[color:var(--color-ink)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[color:var(--color-paper-2)]">
          <img
            src={v.image}
            alt={v.imageAlt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = v.fallbackImage;
            }}
          />
          <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[color:var(--color-ink)] shadow-sm">
            <Icon name={v.icon} className="h-5 w-5" />
          </span>
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[color:var(--color-ink)] shadow-sm">
            <Icon name="location" className="h-3 w-3" />
            Bengaluru
          </div>
        </div>

        <div className="p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold leading-tight text-[color:var(--color-ink)]">
              {v.brand} {v.model}
            </h3>
            <span className="rounded-full bg-[color:var(--color-paper-2)] px-3 py-1 text-xs font-semibold text-[color:var(--color-copy)]">
              ~{v.stockApprox} units
            </span>
          </div>
          <p className="mb-5 text-xs text-[color:var(--color-muted)]">{v.spec}</p>

          <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-lg border border-[color:var(--color-line)]">
            {PACKAGE_PLANS.map((p) => (
              <div key={p.label} className="border-r border-[color:var(--color-line)] py-3 text-center last:border-r-0">
                <div className="mb-1 text-[10px] font-semibold uppercase text-[color:var(--color-muted)]">{p.label}</div>
                <div className="text-sm font-bold text-[color:var(--color-ink)]">
                  Rs. {getPackageRate(v, p.rateKey).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[color:var(--color-muted)]">{GST_INCLUSIVE_COPY}</span>
            <span className="text-sm font-bold text-[color:var(--color-ink)] group-hover:underline">Book Now</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function HomePage() {
  const prefersReducedMotion = useReducedMotion();
  const [animateScooter, setAnimateScooter] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const scooterX = useTransform(heroScrollProgress, [0, 0.42, 1], ["-36px", "34px", "164px"]);
  const scooterY = useTransform(heroScrollProgress, [0, 0.42, 1], ["4px", "-8px", "30px"]);
  const scooterScale = useTransform(heroScrollProgress, [0, 0.42, 1], [1.03, 1, 0.92]);
  const scooterRotate = useTransform(heroScrollProgress, [0, 0.42, 1], ["-1.4deg", "0deg", "2.6deg"]);
  const pricingCardY = useTransform(heroScrollProgress, [0, 1], ["0px", "-46px"]);
  const pricingCardOpacity = useTransform(heroScrollProgress, [0, 0.82], [1, 0.92]);
  const roadX = useTransform(heroScrollProgress, [0, 1], ["0px", "-120px"]);
  const ringX = useTransform(heroScrollProgress, [0, 1], ["0px", "-54px"]);
  const ringScale = useTransform(heroScrollProgress, [0, 1], [1, 1.15]);
  const mobileScooterY = useTransform(heroScrollProgress, [0, 1], ["0px", "-24px"]);
  const mobileScooterOpacity = useTransform(heroScrollProgress, [0, 0.9], [1, 0.82]);
  const initialSchedule = useMemo(() => buildInitialSchedule(), []);
  const [duration, setDuration] = useState<"weekly" | "fortnight" | "monthly">("weekly");
  const [pickupDate, setPickupDate] = useState(initialSchedule.pickupDate);
  const [pickupTime, setPickupTime] = useState(initialSchedule.pickupTime);
  const [dropDate, setDropDate] = useState(initialSchedule.dropDate);
  const [dropTime, setDropTime] = useState(initialSchedule.dropTime);
  const [pickupLocation, setPickupLocation] = useState(LOCATIONS[0]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setAnimateScooter(query.matches);
      setIsMobileViewport(!query.matches);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const pickupAt = fromDateTimeParts(pickupDate, pickupTime);
    const nextDrop = new Date(pickupAt.getTime() + hoursForDuration(duration) * 60 * 60 * 1000);
    setDropDate(toDateValue(nextDrop));
    setDropTime(nearestTimeSlot(nextDrop));
  }, [duration, pickupDate, pickupTime]);

  useEffect(() => {
    const pickupAt = fromDateTimeParts(pickupDate, pickupTime);
    const dropAt = fromDateTimeParts(dropDate, dropTime);
    if (dropAt.getTime() <= pickupAt.getTime()) {
      const fallbackDrop = new Date(pickupAt.getTime() + 60 * 60 * 1000);
      setDropDate(toDateValue(fallbackDrop));
      setDropTime(nearestTimeSlot(fallbackDrop));
    }
  }, [pickupDate, pickupTime, dropDate, dropTime]);

  const pickupAtIso = toDateTimeIso(pickupDate, pickupTime);
  const dropAtIso = toDateTimeIso(dropDate, dropTime);
  const searchHref = `/browse?duration=${duration}&pickup_at=${encodeURIComponent(pickupAtIso)}&drop_at=${encodeURIComponent(dropAtIso)}&pickup_location=${encodeURIComponent(pickupLocation)}`;
  const heroVehicle = PUBLIC_FLEET[0];

  return (
    <div className="bg-[color:var(--color-paper)]">
      <section ref={heroRef} className="relative overflow-hidden border-b border-[color:var(--color-line)] bg-[color:var(--color-ink)] py-12 text-white sm:py-16 lg:py-20">
        <div className="section-shell relative max-w-[1260px]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,760px)_minmax(360px,410px)] lg:items-end lg:gap-8 xl:grid-cols-[minmax(0,790px)_420px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="min-w-0"
            >
              <p className="mb-5 text-sm font-semibold text-[color:var(--color-accent)]">Bengaluru bike rentals</p>
              <h1 className="mb-6 max-w-[820px] text-[clamp(2.65rem,8vw,5.35rem)] font-black leading-[0.94] text-white">
                <span className="block">City rides,</span>
                <span className="block whitespace-nowrap text-[0.78em]">booked cleanly.</span>
              </h1>
              <p className="mb-8 max-w-xl text-lg leading-relaxed text-white/70">
                Activa, Dio, and Jupiter scooters with simple weekly, 15-day, and monthly packages across Bengaluru.
              </p>

              <div className="mb-8 flex flex-wrap gap-2">
                {[
                  { icon: "money", text: "GST included" },
                  { icon: "scooter", text: "25 scooters approx" },
                  { icon: "clock", text: "Weekly to monthly" }
                ].map((t) => (
                  <span key={t.text} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                    <Icon name={t.icon as IconName} className="h-3.5 w-3.5" />
                    {t.text}
                  </span>
                ))}
              </div>

              <div className="relative mt-5 max-w-[940px] pb-4 sm:min-h-[360px] lg:-ml-4 xl:-ml-8">
                <motion.div
                  style={
                    prefersReducedMotion || !animateScooter
                      ? undefined
                      : {
                          x: roadX
                        }
                  }
                  className="absolute bottom-6 left-0 hidden h-px w-[115%] bg-white/14 sm:block"
                />
                <motion.div
                  style={
                    prefersReducedMotion || !animateScooter
                      ? undefined
                      : {
                          x: ringX,
                          scale: ringScale
                        }
                  }
                  className="absolute bottom-20 left-4 hidden h-56 w-56 rounded-full border border-white/10 sm:block"
                />
                <motion.div
                  style={
                    prefersReducedMotion || !animateScooter
                      ? undefined
                      : {
                          x: roadX
                        }
                  }
                  className="absolute bottom-16 left-12 hidden h-px w-28 bg-white/10 sm:block"
                />

                <div className="relative h-[270px] overflow-visible sm:h-[340px] sm:max-w-[620px]">
                  <motion.div
                    style={
                      prefersReducedMotion
                        ? undefined
                        : animateScooter
                          ? {
                              x: scooterX,
                              y: scooterY,
                              scale: scooterScale,
                              rotate: scooterRotate,
                              transformOrigin: "52% 72%"
                            }
                          : isMobileViewport
                            ? {
                                y: mobileScooterY,
                                opacity: mobileScooterOpacity
                              }
                            : undefined
                    }
                    className="absolute bottom-14 left-1/2 -ml-[58%] h-[330px] w-[116%] sm:-left-32 sm:bottom-12 sm:ml-0 sm:h-[430px] sm:w-[760px]"
                  >
                    <img
                      src={heroVehicle.image}
                      alt={heroVehicle.imageAlt}
                      className="h-full w-full object-contain drop-shadow-[0_34px_46px_rgba(0,0,0,0.52)]"
                      onError={(event) => {
                        event.currentTarget.src = heroVehicle.fallbackImage;
                      }}
                    />
                  </motion.div>
                </div>

                <motion.div
                  style={
                    prefersReducedMotion || !animateScooter
                      ? undefined
                      : {
                          y: pricingCardY,
                          opacity: pricingCardOpacity
                        }
                  }
                  className="relative z-20 -mt-3 ml-auto w-full max-w-[330px] rounded-lg border border-white/55 bg-[color-mix(in_oklch,var(--color-ink)_78%,white_8%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-md sm:absolute sm:bottom-2 sm:right-6 sm:mt-0 lg:right-10 xl:right-14"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white/55">Featured scooter</div>
                      <div className="text-sm font-black text-white">
                        {heroVehicle.brand} {heroVehicle.model}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/55 px-2.5 py-1 text-[11px] font-bold text-white/76">
                      ~15 units
                    </span>
                  </div>

                  <div className="divide-y divide-white/12 border-y border-white/12">
                    {[
                      { n: "Rs. 1,600", l: "1 week" },
                      { n: "Rs. 3,200", l: "15 days" },
                      { n: "Rs. 6,000", l: "Monthly" }
                    ].map((s) => (
                      <div key={s.l} className="flex items-center justify-between gap-5 py-3">
                        <span className="text-xs font-semibold uppercase text-white/58">{s.l}</span>
                        <span className="text-sm font-black text-white">{s.n}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-white/72">
                    Practical city rentals for office commutes, hostel stays, short assignments, and everyday local movement.
                  </p>
                  <Link href="/browse" className="btn-primary mt-5 flex w-full justify-center">
                    Browse Fleet
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
              className="rounded-lg border border-white/60 bg-[color:var(--color-paper)] p-5 text-[color:var(--color-ink)] shadow-[0_24px_70px_color-mix(in_oklch,var(--color-ink)_36%,transparent)] sm:p-6"
            >
              <h2 className="mb-1 text-xl font-black text-[color:var(--color-ink)]">Find a bike</h2>
              <p className="mb-5 text-sm text-[color:var(--color-copy)]">Select duration, dates, and pickup location.</p>

              <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg bg-[color:var(--color-paper-2)] p-1">
                {([
                  ["weekly", "1 week"],
                  ["fortnight", "15 days"],
                  ["monthly", "Monthly"]
                ] as const).map(([d, label]) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`rounded-md py-2 text-xs font-semibold capitalize transition-colors ${
                      duration === d
                        ? "bg-[color:var(--color-ink)] text-white"
                        : "text-[color:var(--color-copy)] hover:bg-white hover:text-[color:var(--color-ink)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mb-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[color:var(--color-muted)]">Pickup date and time</label>
                  <div className="grid w-full grid-cols-1 gap-2 rounded-lg border border-[color:var(--color-line)] bg-white p-2.5 sm:grid-cols-[1fr_138px]">
                    <CalendarDatePicker value={pickupDate} onChange={setPickupDate} minDate={toDateValue(new Date())} />
                    <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="field-control">
                      {TIME_OPTIONS.map((option) => (
                        <option key={`pickup-time-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[color:var(--color-muted)]">Drop date and time</label>
                  <div className="grid w-full grid-cols-1 gap-2 rounded-lg border border-[color:var(--color-line)] bg-white p-2.5 sm:grid-cols-[1fr_138px]">
                    <CalendarDatePicker value={dropDate} onChange={setDropDate} minDate={pickupDate} />
                    <select value={dropTime} onChange={(e) => setDropTime(e.target.value)} className="field-control">
                      {TIME_OPTIONS.map((option) => (
                        <option key={`drop-time-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-bold text-[color:var(--color-muted)]">Pickup location</label>
                <select value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className="field-control">
                  {LOCATIONS.map((location) => (
                    <option key={location}>{location}</option>
                  ))}
                </select>
              </div>

              <p className="mb-3 text-xs text-[color:var(--color-copy)]">
                {formatDateTimeLabel(pickupDate, pickupTime)} to {formatDateTimeLabel(dropDate, dropTime)}
              </p>

              <Link href={searchHref} className="btn-primary w-full py-3.5 text-base">
                Search Available Bikes
              </Link>

              <p className="mt-3 text-center text-[10px] font-semibold text-[color:var(--color-muted)]">
                GST included - availability reviewed - quick booking follow-up
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--color-paper)] py-16 sm:py-20 lg:py-24">
        <div className="section-shell">
          <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-sm font-semibold text-[color:var(--color-accent-strong)]">Fleet preview</p>
              <h2 className="section-title">Popular rides in Bengaluru</h2>
            </div>
            <Link href="/browse" className="btn-primary self-start whitespace-nowrap sm:self-auto">
              View All Bikes
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_FLEET.map((vehicle) => (
              <VehicleCard key={vehicle.id} v={vehicle} />
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-[color:var(--color-line)] bg-white py-16 sm:py-20 lg:py-24">
        <div className="section-shell">
          <div className="mb-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <h2 className="section-title">A rental flow that stays out of the way.</h2>
            <p className="section-copy max-w-2xl">
              The public experience is short and practical: choose a scooter, choose a package, share contact details, and let the team confirm availability.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step) => (
              <div key={step.title} className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-6">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-ink)]">
                  <Icon name={step.icon} className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-bold text-[color:var(--color-ink)]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[color:var(--color-copy)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--color-paper-2)] py-16 sm:py-20 lg:py-24">
        <div className="section-shell">
          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold text-[color:var(--color-accent-strong)]">Rental plans</p>
            <h2 className="section-title">Choose by duration, not by guesswork.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {RENTAL_PLANS.map((plan) => (
              <div key={plan.name} className="rounded-lg border border-[color:var(--color-line)] bg-white p-5">
                <div className="mb-3 text-sm font-bold text-[color:var(--color-ink)]">{plan.name}</div>
                <div className="mb-2 text-xl font-black text-[color:var(--color-ink)]">{plan.value}</div>
                <p className="text-sm leading-relaxed text-[color:var(--color-copy)]">{plan.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--color-ink)] py-16 text-white sm:py-20 lg:py-24">
        <div className="section-shell">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-semibold text-[color:var(--color-accent)]">Trust signals</p>
              <h2 className="mb-6 text-[clamp(2.2rem,5vw,4.75rem)] font-black leading-none text-white">
                Built for policy-first rentals.
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-white/62">
                The product is not just a glossy storefront. It accounts for package pricing, bookings, customer follow-up, fleet operations, and admin review.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {TRUST_FACTS.map((fact) => (
                <div key={fact.title} className="rounded-lg border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[color:var(--color-accent)]">
                    <Icon name={fact.icon} className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-white">{fact.title}</h3>
                  <p className="text-sm leading-relaxed text-white/62">{fact.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="section-shell">
          <div className="mb-10 grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <h2 className="section-title">Pickup hub in Bengaluru</h2>
            <p className="section-copy">
              Choose a convenient pickup zone during booking and confirm availability in the flow.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {LOCATIONS.map((location) => (
              <div key={location} className="chip justify-center gap-1.5 text-center text-xs">
                <Icon name="location" className="h-3.5 w-3.5" />
                {location}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--color-line)] bg-[color:var(--color-paper)] py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold text-[color:var(--color-accent-strong)]">FAQ</p>
            <h2 className="section-title">Common questions</h2>
            <p className="mt-3 text-sm text-[color:var(--color-copy)]">
              <Link href="/faq" className="nav-focus font-semibold underline underline-offset-2">
                View all FAQs
              </Link>
            </p>
          </div>

          <div className="rounded-lg border border-[color:var(--color-line)] bg-white px-4 py-2 sm:px-8">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--color-paper)] py-16 sm:py-20 lg:py-24">
        <div className="section-shell text-center">
          <h2 className="mx-auto mb-5 max-w-3xl text-[clamp(2.4rem,6vw,5.5rem)] font-black leading-none text-[color:var(--color-ink)]">
            Ready to book the ride?
          </h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[color:var(--color-copy)]">
            Pick a scooter package and send a booking request with transparent GST-inclusive pricing.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/browse" className="btn-primary px-10 py-3.5 text-base">
              Browse Bikes
            </Link>
            <Link href="/my-bookings" className="btn-secondary px-10 py-3.5 text-base">
              My Bookings
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
