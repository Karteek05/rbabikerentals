import { afterEach, describe, expect, it } from "vitest";
import { anonymizeUserAccount, getUserOrThrow } from "@/lib/data/repository";
import { store } from "@/lib/data/store";
import type { User } from "@/lib/types/domain";

describe("user repository", () => {
  const userId = "cust_delete_test";

  afterEach(() => {
    store.users = store.users.filter((user) => user.id !== userId);
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
