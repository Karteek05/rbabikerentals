import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { store } from "@/lib/data/store";
import { deleteCoupon, getCouponDiscountRate, listCoupons, saveCoupon } from "@/lib/data/repository";

const envKeys = ["APP_ENV", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let originalCoupons = store.coupons.map((coupon) => ({ ...coupon }));

beforeEach(() => {
  process.env.APP_ENV = "test";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  originalCoupons = store.coupons.map((coupon) => ({ ...coupon }));
});

afterEach(() => {
  store.coupons.splice(0, store.coupons.length, ...originalCoupons);
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("coupon deletion", () => {
  it("removes only the selected promotion and stops applying its discount", async () => {
    await saveCoupon({ code: "KEEP-ME", discount_percent: 15, active: true }, "admin-test");
    await saveCoupon({ code: "REMOVE-ME", discount_percent: 10, active: true }, "admin-test");

    expect(await deleteCoupon(" remove-me ")).toBe(true);
    expect((await listCoupons()).map((coupon) => coupon.code)).toContain("KEEP-ME");
    expect((await listCoupons()).map((coupon) => coupon.code)).not.toContain("REMOVE-ME");
    expect(await getCouponDiscountRate("REMOVE-ME")).toBe(0);
    expect(await deleteCoupon("REMOVE-ME")).toBe(false);
  });
});
