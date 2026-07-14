type Breakdown = {
  idle: number;
  halt: number;
  running: number;
  waiting: number;
};

const SEGMENTS: { key: keyof Breakdown; color: string; label: string }[] = [
  { key: "idle", color: "var(--color-paper-3)", label: "Idle" },
  { key: "halt", color: "var(--color-danger)", label: "Halt" },
  { key: "running", color: "var(--color-green)", label: "Running" },
  { key: "waiting", color: "oklch(62% 0.12 240)", label: "Waiting" }
];

export default function StatusDonut({ breakdown }: { breakdown: Breakdown }) {
  const total = SEGMENTS.reduce((sum, segment) => sum + breakdown[segment.key], 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (!total) {
    return (
      <div className="partner-donut-empty">
        <p>No fleet data yet</p>
      </div>
    );
  }

  return (
    <div className="partner-donut-wrap">
      <svg viewBox="0 0 140 140" className="partner-donut-svg" aria-hidden>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="18" />
        {SEGMENTS.map((segment) => {
          const value = breakdown[segment.key];
          if (!value) return null;
          const length = (value / total) * circumference;
          const dashArray = `${length} ${circumference - length}`;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={segment.key}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="18"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 70 70)"
            />
          );
        })}
      </svg>
      <div className="partner-donut-center">
        <span className="partner-donut-total">{total}</span>
        <span className="partner-donut-label">Vehicles</span>
      </div>
      <ul className="partner-donut-legend">
        {SEGMENTS.map((segment) => (
          <li key={segment.key}>
            <span className="partner-legend-swatch" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <strong>{breakdown[segment.key]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
