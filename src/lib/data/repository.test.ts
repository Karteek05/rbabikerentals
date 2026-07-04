import { afterEach, describe, expect, it } from "vitest";
import {
  anonymizeUserAccount,
  getUserOrThrow,
  reconcileAppUsersForCanonicalId
} from "@/lib/data/repository";
import { store } from "@/lib/data/store";
import type { KycRecord, User } from "@/lib/types/domain";

describe("user repository", () => {
  const userId = "cust_delete_test";

  afterEach(() => {
    store.users = store.users.filter(
      (user) =>
        user.id !== userId &&
        !user.id.startsWith("cust_reconcile_") &&
        !user.id.startsWith("cust_reconcile_role_")
    );
    store.kycRecords = store.kycRecords.filter(
      (item) =>
        !item.user_id.startsWith("cust_reconcile_") &&
        !item.user_id.startsWith("cust_reconcile_role_")
    );
  });

  it("merges duplicate KYC rows without primary-key collisions", async () => {
    const canonicalId = "cust_reconcile_canonical";
    const duplicateId = "cust_reconcile_duplicate";
    const email = "reconcile@example.com";

    store.users.push(
      {
        id: canonicalId,
        name: "Canonical",
        role: "customer",
        city: "bengaluru",
        kyc_status: "not_started",
        email
      },
      {
        id: duplicateId,
        name: "Duplicate",
        role: "customer",
        city: "bengaluru",
        kyc_status: "not_started",
        email
      }
    );
    const now = new Date().toISOString();
    store.kycRecords.push(
      {
        user_id: canonicalId,
        status: "not_started",
        provider: "setu_digilocker",
        aadhaar_verified: false,
        dl_verified: false,
        needs_manual_review: false,
        updated_at: now
      },
      {
        user_id: duplicateId,
        status: "not_started",
        provider: "setu_digilocker",
        aadhaar_verified: false,
        dl_verified: false,
        needs_manual_review: false,
        updated_at: now
      }
    );

    const result = await reconcileAppUsersForCanonicalId(canonicalId, email);

    expect(result.mergedUserIds).toEqual([duplicateId]);
    expect(store.users.some((user) => user.id === duplicateId)).toBe(false);
    expect(store.kycRecords.filter((item) => item.user_id === canonicalId)).toHaveLength(1);
    expect(store.kycRecords.some((item) => item.user_id === duplicateId)).toBe(false);
  });

  it("preserves the higher-privilege role when reconciling duplicates", async () => {
    const canonicalId = "cust_reconcile_role_canonical";
    const duplicateId = "cust_reconcile_role_duplicate";
    const email = "role-reconcile@example.com";

    store.users.push(
      {
        id: canonicalId,
        name: "Canonical",
        role: "customer",
        city: "bengaluru",
        kyc_status: "not_started",
        email
      },
      {
        id: duplicateId,
        name: "Duplicate Admin",
        role: "admin",
        city: "bengaluru",
        kyc_status: "verified",
        email,
        phone: "9999999999"
      }
    );

    const result = await reconcileAppUsersForCanonicalId(canonicalId, email);

    expect(result.mergedUserIds).toEqual([duplicateId]);
    const canonical = await getUserOrThrow(canonicalId);
    expect(canonical.role).toBe("admin");
    expect(canonical.kyc_status).toBe("verified");
    expect(canonical.phone).toBe("9999999999");
  });

  it("anonymizes profile PII while preserving the user record", async () => {
    const user: User = {
      id: userId,
      name: "Delete Me",
      role: "customer",
      city: "bengaluru",
      kyc_status: "verified",
      email: "delete@example.com",
      phone: "+919999999999",
      pan_number: "ABCDE1234F",
      date_of_birth: "1994-05-16",
      cibil_consent_at: new Date().toISOString()
    };
    store.users.push(user);

    const anonymized = await anonymizeUserAccount(userId);
    const persisted = await getUserOrThrow(userId);

    expect(anonymized.id).toBe(userId);
    expect(anonymized.role).toBe("customer");
    expect(anonymized.name).toBe("Deleted account");
    expect(anonymized.email).toBeNull();
    expect(anonymized.phone).toBeNull();
    expect(anonymized.pan_number).toBeNull();
    expect(anonymized.date_of_birth).toBeNull();
    expect(anonymized.cibil_consent_at).toBeNull();
    expect(anonymized.deleted_at).toEqual(expect.any(String));
    expect(persisted).toEqual(anonymized);
  });
});
