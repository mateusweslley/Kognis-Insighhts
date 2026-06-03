import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
};

export function EmptyState({ title, description, actionLabel }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-lg border border-kognis-teal/30 bg-kognis-teal/10 text-kognis-teal">
          <Plus className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <Button className="mt-6">{actionLabel}</Button>
      </CardContent>
    </Card>
  );
}
