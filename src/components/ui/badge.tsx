import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        outline: "border-border text-foreground",
        soft: "border-forge-600/15 bg-forge-600/10 text-forge-700 dark:bg-forge-300/10 dark:text-forge-200",
        amber: "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        sky: "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        violet: "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        slate: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
