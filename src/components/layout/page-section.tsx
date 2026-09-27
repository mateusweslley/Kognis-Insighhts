import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageSectionProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

export function PageSection({ children, title, description, className }: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {title || description ? (
        <div>
          {title ? <h2 className="text-xl font-semibold text-text-primary">{title}</h2> : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
