"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
        <ActionIcon actionHref={actionHref} onAction={onAction} />
        <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {actionHref ? (
          <Button asChild className="mt-6">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button className="mt-6" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ActionIcon({
  actionHref,
  onAction,
}: {
  actionHref?: string;
  onAction?: () => void;
}) {
  const className =
    "grid h-12 w-12 place-items-center rounded-lg border border-kognis-teal/30 bg-kognis-teal/10 text-kognis-teal transition-colors hover:bg-kognis-teal/15";

  if (actionHref) {
    return (
      <Link href={actionHref} className={className} aria-label="Adicionar">
        <Plus className="h-5 w-5" />
      </Link>
    );
  }

  if (onAction) {
    return (
      <button type="button" onClick={onAction} className={className} aria-label="Adicionar">
        <Plus className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className={className}>
      <Plus className="h-5 w-5" />
    </div>
  );
}
