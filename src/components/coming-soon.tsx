import { Construction } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function ComingSoon({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6">
        <EmptyState
          icon={Construction}
          title={`${title} arrives in ${phase}`}
          description="This section is part of an upcoming build phase."
        />
      </div>
    </div>
  );
}
