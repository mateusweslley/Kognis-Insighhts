import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  showText?: boolean;
};

export function BrandMark({ className, showText = true }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-foreground shadow-card">
        <div className="text-base font-bold">K</div>
      </div>
      {showText ? (
        <div>
          <p className="text-sm font-bold tracking-[0.24em] text-text-primary">KOGNIS</p>
          <p className="text-[10px] font-semibold tracking-[0.32em] text-brand">
            INSIGHTS
          </p>
        </div>
      ) : null}
    </div>
  );
}
