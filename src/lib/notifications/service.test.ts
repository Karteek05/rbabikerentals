import { afterEach, describe, expect, it } from "vitest";
import { buildUserEmail, notifyUser } from "@/lib/notifications/service";
import { store } from "@/lib/data/store";

const smtpEnvKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"] as const;
const originalSmtpEnv = Object.fromEntries(
  smtpEnvKeys.map((key) => [key, process.env[key]])
);

describe("notification email templates", () => {
  afterEach(() => {
    store.notificationJobs = [];
    for (const key of smtpEnvKeys) {
      const original = originalSmtpEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it("builds a professional booking approval email with a payment link", () => {
    const email = buildUserEmail({
      templateKey: "booking_approved_pay_now",
      payload: {
        booking_id: "booking_123",
        vehicle_id: "veh_001",
        total_payable: 3200,
        payment_url: "https://rbabikerentals.vercel.app/my-bookings?pay=booking_123"
      }
    });

    expect(email?.subject).toBe("Your RBA booking is ready for payment");
    expect(email?.text).toContain("Complete payment");
    expect(email?.text).toContain("https://rbabikerentals.vercel.app/my-bookings?pay=booking_123");
    expect(email?.html).toContain("Complete payment");
    expect(email?.html).toContain("https://rbabikerentals.vercel.app/my-bookings?pay=booking_123");
  });

  it("records when SMTP is skipped because delivery env vars are incomplete", async () => {
    for (const key of smtpEnvKeys) {
      delete process.env[key];
    }

    await notifyUser({
      userId: "cust_001",
      email: "customer@example.com",
      templateKey: "booking_approved_pay_now",
      payload: {
        booking_id: "booking_123",
        vehicle_id: "veh_001",
        total_payable: 3200,
        payment_url: "https://rbabikerentals.vercel.app/my-bookings?pay=booking_123"
      }
    });

    expect(store.notificationJobs.map((job) => job.template_key)).toContain(
      "booking_approved_pay_now_smtp_skipped"
    );
  });
});
