import { describe, expect, it } from "vitest";
import { parseSetuDigilockerStatusForTest, resolveKycCallbackStatusForTest } from "./setu-status";

describe("Setu DigiLocker status parsing", () => {
  it("does not mark documents verified from authenticated consent alone", () => {
    const parsed = parseSetuDigilockerStatusForTest({ status: "authenticated" });
    expect(parsed.aadhaarVerified).toBe(false);
    expect(parsed.dlVerified).toBe(false);
    expect(resolveKycCallbackStatusForTest(parsed)).toBe("manual_review");
  });

  it("marks verified only when both document checks are explicit", () => {
    const parsed = parseSetuDigilockerStatusForTest({
      status: "authenticated",
      aadhaarVerified: true,
      dlVerified: true
    });
    expect(resolveKycCallbackStatusForTest(parsed)).toBe("verified");
  });

  it("detects shared driving licence documents from payload list", () => {
    const parsed = parseSetuDigilockerStatusForTest({
      status: "authenticated",
      documents: [{ docType: "DRVLC" }],
      aadhaar_verified: true
    });
    expect(parsed.dlVerified).toBe(true);
    expect(resolveKycCallbackStatusForTest(parsed)).toBe("verified");
  });

  it("marks verified when redirect scope includes both Aadhaar and DL", () => {
    const parsed = parseSetuDigilockerStatusForTest({
      status: "authenticated",
      scope: "ADHAR+DRVLC"
    });
    expect(parsed.aadhaarVerified).toBe(true);
    expect(parsed.dlVerified).toBe(true);
    expect(resolveKycCallbackStatusForTest(parsed)).toBe("verified");
  });
});
