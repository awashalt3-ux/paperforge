import { cn } from "@/lib/utils";

export function BrandMark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[9px] bg-[#193b33] text-[#e9f2ee] shadow-sm ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M5 3.5h9.5L19 8v12.5H5V3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M14.5 3.5V8H19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.25 12h7.5M8.25 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#78b7a5]/80" />
    </div>
  );
}

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[14.5px] font-semibold tracking-[-0.035em] text-foreground">
            paperforge
          </div>
          <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
            PDF Studio
          </div>
        </div>
      )}
    </div>
  );
}
