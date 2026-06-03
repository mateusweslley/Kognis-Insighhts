import type { PanelPage as PanelPageType } from "@/types";
import { EmptyState } from "@/components/dashboard/empty-state";

type PanelPageProps = PanelPageType;

export function PanelPage({
  title,
  description,
  actionLabel,
  actionHref,
  emptyTitle,
  emptyDescription,
}: PanelPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={actionLabel}
        actionHref={actionHref}
      />
    </div>
  );
}
