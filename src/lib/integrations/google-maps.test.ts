import { describe, expect, it } from "vitest";
import { reverseGeocode } from "@/lib/integrations/google-maps";

describe("google maps integration", () => {
  it("validates coordinates before calling Google Maps", async () => {
    await expect(
      reverseGeocode({
        latitude: 120,
        longitude: 77.5946
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "invalid_latitude"
    });
  });
});
