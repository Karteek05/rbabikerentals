type WeekdayPoint = { day: string; count: number };

export default function BookingsWeekChart({ points }: { points: WeekdayPoint[] }) {
  const max = Math.max(...points.map((point) => point.count), 1);

  return (
    <div className="partner-week-chart">
      {points.map((point) => (
        <div key={point.day} className="partner-week-bar-col">
          <div className="partner-week-bar-track">
            <div
              className="partner-week-bar-fill"
              style={{ height: `${(point.count / max) * 100}%` }}
              title={`${point.count} bookings`}
            />
          </div>
          <span className="partner-week-bar-label">{point.day.slice(0, 3)}</span>
          <span className="partner-week-bar-value">{point.count}</span>
        </div>
      ))}
    </div>
  );
}
