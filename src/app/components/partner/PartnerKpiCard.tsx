import Icon, { type IconName } from "../Icon";

type PartnerKpiCardProps = {
  icon: IconName;
  label: string;
  value: string | number;
  hint?: string;
};

export default function PartnerKpiCard({ icon, label, value, hint }: PartnerKpiCardProps) {
  return (
    <article className="partner-kpi-card">
      <div className="partner-kpi-icon">
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="partner-kpi-value">{value}</div>
      <div className="partner-kpi-label">{label}</div>
      {hint ? <div className="partner-kpi-hint">{hint}</div> : null}
      <div className="partner-kpi-sparkline" aria-hidden />
    </article>
  );
}
