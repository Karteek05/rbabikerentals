import {
  insertNotificationJob,
  listOpenDamageIncidents,
  listVehicleDocumentsExpiringBefore
} from "@/lib/data/repository";
import { newId } from "@/lib/utils/ids";

export async function runDocumentExpiryReminderJob() {
  const reminderCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const docs = await listVehicleDocumentsExpiringBefore(reminderCutoff);

  for (const doc of docs) {
    await insertNotificationJob({
      id: newId("notif"),
      channel: "whatsapp",
      template_key: "vehicle_document_expiry_warning",
      recipient: `partner_for_vehicle_${doc.vehicle_id}`,
      payload: {
        vehicle_id: doc.vehicle_id,
        doc_type: doc.doc_type,
        expires_at: doc.expires_at
      },
      status: "queued",
      created_at: new Date().toISOString()
    });
  }

  return {
    scanned: docs.length,
    queued_notifications: docs.length
  };
}

export async function runIncidentEscalationJob() {
  const incidents = await listOpenDamageIncidents();

  for (const incident of incidents) {
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
  }

  return {
    open_incidents: incidents.length,
    queued_notifications: incidents.length
  };
}

