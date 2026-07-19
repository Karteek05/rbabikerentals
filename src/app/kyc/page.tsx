import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import KycPageClient from "./KycPageClient";

export default function KycPage() {
  return (
    <Suspense
      fallback={
        <div className="section-shell py-10">
          <Skeleton className="mx-auto h-40 max-w-2xl rounded-xl" />
        </div>
      }
    >
      <KycPageClient />
    </Suspense>
  );
}
