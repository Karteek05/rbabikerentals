import type { PricingQuote } from "@/lib/types/domain";

type CostBreakdownQuote = Pick<
  PricingQuote,
  | "vehicle_rental_cost"
  | "plan_discount"
  | "addon_amount"
  | "coupon_discount"
  | "cgst_amount"
  | "sgst_amount"
  | "total_cost"
  | "total_payable"
  | "deposit_amount"
  | "km_included"
  | "excess_km_rate"
> &
  Partial<Pick<PricingQuote, "base_amount" | "tax_amount">>;

type CostBreakdownProps = {
  quote: CostBreakdownQuote;
  amountPaid?: number;
  subtitle?: string;
  showDeposit?: boolean;
  showKmNote?: boolean;
  className?: string;
  variant?: "light" | "dark";
};

function rupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function resolveQuoteFields(quote: CostBreakdownQuote) {
  const vehicleRentalCost =
    quote.vehicle_rental_cost ??
    quote.base_amount ??
    0;
  const planDiscount = quote.plan_discount ?? 0;
  const totalCost = quote.total_cost ?? quote.total_payable - (quote.deposit_amount ?? 0);
  const cgstAmount =
    quote.cgst_amount ??
    Math.round((quote.tax_amount ?? 0) / 2);
  const sgstAmount =
    quote.sgst_amount ??
    (quote.tax_amount ?? 0) - cgstAmount;

  return {
    vehicleRentalCost,
    planDiscount,
    totalCost,
    cgstAmount,
    sgstAmount
  };
}

function BreakdownRow({
  label,
  value,
  emphasize = false,
  muted = false,
  variant
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
  variant: "light" | "dark";
}) {
  const labelClass =
    variant === "dark"
      ? muted
        ? "text-white/70"
        : "text-white/85"
      : muted
        ? "text-uber-body-gray"
        : "text-uber-body-gray";
  const valueClass =
    variant === "dark"
      ? emphasize
        ? "font-bold text-white"
        : "text-white"
      : emphasize
        ? "font-bold text-black"
        : "text-black";

  return (
    <div
      className={`flex items-center justify-between gap-4 py-2 text-sm ${
        emphasize ? "font-bold" : ""
      }`}
    >
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export default function CostBreakdown({
  quote,
  amountPaid = 0,
  subtitle = "Include all taxes (Subject to vehicle fare rules)",
  showDeposit = true,
  showKmNote = true,
  className = "",
  variant = "light"
}: CostBreakdownProps) {
  const {
    vehicleRentalCost,
    planDiscount,
    totalCost,
    cgstAmount,
    sgstAmount
  } = resolveQuoteFields(quote);
  const balanceAmount = Math.max(0, quote.total_payable - amountPaid);
  const shellClass =
    variant === "dark"
      ? "rounded-2xl border border-white/10 bg-[#111111] p-5 text-white"
      : "rounded-2xl border border-black/10 bg-white p-5";
  const dividerClass =
    variant === "dark" ? "border-white/10" : "border-black/10";
  const subtitleClass =
    variant === "dark" ? "text-white/60" : "text-uber-muted-gray";

  return (
    <div className={`${shellClass} ${className}`.trim()}>
      <div className="mb-4">
        <h3
          className={`text-base font-bold ${
            variant === "dark" ? "text-white" : "text-black"
          }`}
        >
          Cost Breakdown
        </h3>
        <p className={`mt-1 text-xs ${subtitleClass}`}>{subtitle}</p>
      </div>

      <BreakdownRow
        label="Vehicle Rental Cost"
        value={rupees(vehicleRentalCost)}
        variant={variant}
      />
      {planDiscount > 0 ? (
        <BreakdownRow
          label="Discount"
          value={rupees(planDiscount)}
          variant={variant}
        />
      ) : null}
      {quote.coupon_discount > 0 ? (
        <BreakdownRow
          label="Coupon Savings"
          value={rupees(quote.coupon_discount)}
          variant={variant}
        />
      ) : null}
      {quote.addon_amount > 0 ? (
        <BreakdownRow
          label="Pillion Helmet"
          value={rupees(quote.addon_amount)}
          variant={variant}
        />
      ) : null}
      <BreakdownRow
        label="CGST (9% included)"
        value={rupees(cgstAmount)}
        variant={variant}
      />
      <BreakdownRow
        label="SGST (9% included)"
        value={rupees(sgstAmount)}
        variant={variant}
      />

      <div className={`my-3 border-t ${dividerClass}`} />
      <BreakdownRow
        label="Total Cost"
        value={rupees(totalCost)}
        emphasize
        variant={variant}
      />

      {showDeposit && quote.deposit_amount > 0 ? (
        <>
          <BreakdownRow
            label="Security Deposit"
            value={rupees(quote.deposit_amount)}
            variant={variant}
          />
          <BreakdownRow
            label="Total Payable"
            value={rupees(quote.total_payable)}
            emphasize
            variant={variant}
          />
        </>
      ) : null}

      <div className={`my-3 border-t ${dividerClass}`} />
      <BreakdownRow
        label="Amount Paid"
        value={rupees(amountPaid)}
        emphasize
        variant={variant}
      />
      <BreakdownRow
        label="Balance Amount"
        value={rupees(balanceAmount)}
        emphasize
        variant={variant}
      />

      {showKmNote && quote.km_included ? (
        <p className={`mt-3 text-xs ${subtitleClass}`}>
          Includes {quote.km_included} km · ₹{quote.excess_km_rate}/km extra
        </p>
      ) : null}
    </div>
  );
}
