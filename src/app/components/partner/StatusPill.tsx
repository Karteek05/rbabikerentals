import type { VehiclePositionStatus } from "@/lib/partner/service";

const LABELS: Record<VehiclePositionStatus, string> = {
  running: "Running",
  waiting: "Waiting",
  halt: "Halt",
  idle: "Idle"
};

export default function StatusPill({ status }: { status: VehiclePositionStatus }) {
  return <span className={`partner-status-pill partner-status-${status}`}>{LABELS[status]}</span>;
}
