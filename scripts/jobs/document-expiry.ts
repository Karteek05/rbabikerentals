import { runDocumentExpiryReminderJob } from "@/lib/jobs/service";

runDocumentExpiryReminderJob()
  .then((result) => {
    console.log("Document expiry job result:", result);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

