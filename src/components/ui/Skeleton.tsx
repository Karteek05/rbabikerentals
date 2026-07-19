type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="stat-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-16" />
        </div>
      ))}
    </div>
  );
}

export function VehicleCardSkeleton() {
  return (
    <article className="card overflow-hidden">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full rounded-pill" />
      </div>
    </article>
  );
}

export function VehicleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function BookingCardSkeleton() {
  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-24 rounded-pill" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function BookingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <BookingCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function PartnerDashboardSkeleton() {
  return (
    <>
      <div className="partner-kpi-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="partner-analytics-grid">
        <div className="card partner-panel p-5">
          <Skeleton className="mb-4 h-5 w-32" />
          <Skeleton className="mx-auto h-48 w-48 rounded-full" />
        </div>
        <div className="card partner-panel p-5">
          <Skeleton className="mb-4 h-5 w-24" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </>
  );
}

export function DashboardAuthSkeleton() {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </aside>
      <div className="dashboard-content space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <StatCardsSkeleton />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
