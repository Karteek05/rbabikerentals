type WeekdayPoint = { day: string; count: number };

export default function BookingsWeekChart({ points }: { points: WeekdayPoint[] }) {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  if (!total) {
    return (
      <div className="partner-week-chart partner-week-chart-empty" role="status">
        No bookings match this week and status filter.
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.count), 1);

  return (
    <div className="partner-week-chart" role="list" aria-label="Bookings created by weekday">
      {points.map((point) => (
        <div
          key={point.day}
          className="partner-week-bar-col"
          role="listitem"
          aria-label={`${point.day}: ${point.count} bookings`}
        >
          <div className="partner-week-bar-track" aria-hidden="true">
            <div
              className="partner-week-bar-fill"
              style={{ height: `${(point.count / max) * 100}%` }}
            />
          </div>
          <span className="partner-week-bar-label" aria-hidden="true">{point.day.slice(0, 3)}</span>
          <span className="partner-week-bar-value" aria-hidden="true">{point.count}</span>
        </div>
      ))}
    </div>
  );
}
