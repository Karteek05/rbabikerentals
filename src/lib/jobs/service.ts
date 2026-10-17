import {
  hasNotificationJobForPayload,
  insertNotificationJob,
  isVehicleDocumentFileReferenced,
  listOpenDamageIncidents,
  listVehicleDocumentCleanup,
  listVehicleDocumentsExpiringBefore,
  markVehicleDocumentCleanupFailure,
  removeVehicleDocumentCleanup
} from "@/lib/data/repository";
import { newId } from "@/lib/utils/ids";
import { removeStoredVehicleDocument } from "@/lib/vehicles/storage";

export async function runDocumentExpiryReminderJob() {
  const reminderCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const docs = (await listVehicleDocumentsExpiringBefore(reminderCutoff)).filter((doc) => {
    if (!doc.expires_at) return false;
    return new Date(doc.expires_at).getTime() >= Date.now();
  });
  let queuedNotifications = 0;

  for (const doc of docs) {
    const alreadyQueued = await hasNotificationJobForPayload({
      templateKey: "vehicle_document_expiry_warning",
      payloadField: "vehicle_document_id",
      payloadValue: doc.id
    });
    if (alreadyQueued) continue;

    await insertNotificationJob({
      id: newId("notif"),
      channel: "whatsapp",
      template_key: "vehicle_document_expiry_warning",
      recipient: `partner_for_vehicle_${doc.vehicle_id}`,
      payload: {
        vehicle_document_id: doc.id,
        vehicle_id: doc.vehicle_id,
        doc_type: doc.doc_type,
        expires_at: doc.expires_at
      },
      status: "queued",
      created_at: new Date().toISOString()
    });
    queuedNotifications += 1;
  }

  const cleanup = await runVehicleDocumentCleanupJob();
  return {
    scanned: docs.length,
    queued_notifications: queuedNotifications,
    stale_document_files_removed: cleanup.removed,
    stale_document_file_cleanup_failures: cleanup.failed
  };
}
export async function runVehicleDocumentCleanupJob() {
  const eligibleAfter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const pending = await listVehicleDocumentCleanup(eligibleAfter);
  let removed = 0;
  let retained = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      if (await isVehicleDocumentFileReferenced(item.file_url)) {
        await removeVehicleDocumentCleanup(item.file_url);
        retained += 1;
        continue;
      }
      await removeStoredVehicleDocument(item.file_url);
      await removeVehicleDocumentCleanup(item.file_url);
      removed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage cleanup failed.";
      await markVehicleDocumentCleanupFailure(item, message);
      failed += 1;
    }
  }

  return { scanned: pending.length, removed, retained, failed };
}


export async function runIncidentEscalationJob() {
  const incidents = await listOpenDamageIncidents();
  let queuedNotifications = 0;

  for (const incident of incidents) {
    const alreadyQueued = await hasNotificationJobForPayload({
      templateKey: "damage_incident_escalation",
      payloadField: "incident_id",
      payloadValue: incident.id
    });
    if (alreadyQueued) continue;

    await insertNotificationJob({
      id: newId("notif"),
      channel: "sms",
      template_key: "damage_incident_escalation",
      recipient: "admin_ops_team",
      payload: {
        incident_id: incident.id,
        vehicle_id: incident.vehicle_id,
        booking_id: incident.booking_id
      },
      status: "queued",
      created_at: new Date().toISOString()
    });
    queuedNotifications += 1;
  }

  return {
    open_incidents: incidents.length,
    queued_notifications: queuedNotifications
  };
}
