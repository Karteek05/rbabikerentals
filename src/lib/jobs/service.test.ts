import { afterEach, describe, expect, it, vi } from "vitest";
import { store } from "@/lib/data/store";
import * as documentStorage from "@/lib/vehicles/storage";
import { runVehicleDocumentCleanupJob } from "@/lib/jobs/service";

describe("vehicle document cleanup job", () => {
  afterEach(() => {
    store.vehicleDocuments = store.vehicleDocuments.filter(
      (document) => document.id !== "vdoc_cleanup_active_test"
    );
    store.vehicleDocumentCleanup = store.vehicleDocumentCleanup.filter(
      (item) => !item.file_url.includes("cleanup_test")
    );
    vi.restoreAllMocks();
  });

  it("retries stale objects, but preserves files still referenced by a document", async () => {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const activeFile = "local:veh_cleanup_test/active.pdf";
    const orphanFile = "local:veh_cleanup_test/orphan.pdf";
    store.vehicleDocuments.push({
      id: "vdoc_cleanup_active_test",
      vehicle_id: "veh_cleanup_test",
      doc_type: "rc",
      file_url: activeFile,
      created_at: cutoff,
      updated_at: cutoff
    });
    store.vehicleDocumentCleanup.push(
      {
        id: "cleanup_active_test",
        file_url: activeFile,
        attempts: 0,
        last_error: null,
        created_at: cutoff
      },
      {
        id: "cleanup_orphan_test",
        file_url: orphanFile,
        attempts: 0,
        last_error: null,
        created_at: cutoff
      }
    );
    const removeFile = vi
      .spyOn(documentStorage, "removeStoredVehicleDocument")
      .mockRejectedValueOnce(new Error("temporary storage error"))
      .mockResolvedValueOnce(undefined);

    const firstRun = await runVehicleDocumentCleanupJob();
    expect(firstRun).toMatchObject({ scanned: 2, removed: 0, retained: 1, failed: 1 });
    expect(removeFile).toHaveBeenCalledTimes(1);
    expect(store.vehicleDocumentCleanup.find((item) => item.file_url === orphanFile)?.attempts).toBe(1);
    expect(store.vehicleDocumentCleanup.some((item) => item.file_url === activeFile)).toBe(false);

    const secondRun = await runVehicleDocumentCleanupJob();
    expect(secondRun).toMatchObject({ scanned: 1, removed: 1, retained: 0, failed: 0 });
    expect(store.vehicleDocumentCleanup.some((item) => item.file_url === orphanFile)).toBe(false);
  });
});
