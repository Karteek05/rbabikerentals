import { runIncidentEscalationJob } from "@/lib/jobs/service";

runIncidentEscalationJob()
  .then((result) => {
    console.log("Incident escalation job result:", result);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

