import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/bookings/route";

describe("admin bookings api", () => {
  it("returns forbidden for customer role", async () => {
    process.env.ALLOW_DEV_HEADERS = "true";
    const request = new Request("http://localhost/api/admin/bookings", {
      headers: {
        "x-user-id": "cust_001",
        "x-role": "customer"
      }
    });

    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns ok for admin role", async () => {
    process.env.ALLOW_DEV_HEADERS = "true";
    const request = new Request("http://localhost/api/admin/bookings", {
      headers: {
        "x-user-id": "admin_001",
        "x-role": "admin"
      }
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});

