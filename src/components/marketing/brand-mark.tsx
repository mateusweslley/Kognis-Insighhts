import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  showText?: boolean;
};

export function BrandMark({ className, showText = true }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid h-10 w-10 place-items-center rounded-lg bg-kognis-deep ring-1 ring-white/10">
        <div className="absolute left-2 top-2 h-6 w-2 rounded-full bg-kognis-teal" />
        <div className="absolute left-4 top-2 h-2 w-2 rounded-full bg-kognis-teal" />
        <div className="h-5 w-5 rotate-45 rounded-sm border-b-4 border-l-4 border-white" />
      </div>
      {showText ? (
        <div>
          <p className="text-sm font-bold tracking-[0.24em] text-white">KOGNIS</p>
          <p className="text-[10px] font-semibold tracking-[0.32em] text-kognis-teal">
            INSIGHTS
          </p>
        </div>
      ) : null}
    </div>
  );
}
