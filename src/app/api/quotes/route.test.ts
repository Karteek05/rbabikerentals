import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/quotes/route";

describe("quotes api", () => {
  it("rejects cross-user quote request for customer", async () => {
    process.env.ALLOW_DEV_HEADERS = "true";
    const request = new Request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "cust_001",
        "x-role": "customer"
      },
      body: JSON.stringify({
        user_id: "cust_002",
        vehicle_id: "veh_001",
        city: "bengaluru",
        duration_bucket: "day",
        duration_value: 1
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("returns quote for valid customer request", async () => {
    process.env.ALLOW_DEV_HEADERS = "true";
    const request = new Request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "cust_001",
        "x-role": "customer"
      },
      body: JSON.stringify({
        user_id: "cust_001",
        vehicle_id: "veh_001",
        city: "bengaluru",
        duration_bucket: "day",
        duration_value: 1
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});

