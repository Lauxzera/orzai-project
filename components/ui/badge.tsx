import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      outline: "border bg-card/70 text-foreground dark:bg-card/92 dark:border-border/90",
      gold: "bg-accent/22 text-accent-foreground dark:bg-primary/18 dark:text-primary",
      danger: "bg-destructive/10 text-destructive dark:bg-destructive/16",
      success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
