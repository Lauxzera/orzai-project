import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-[1.03] dark:shadow-[0_10px_24px_rgba(186,163,119,0.18)]",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-[1.04]",
        outline: "border bg-card/76 text-foreground hover:bg-muted dark:bg-card/92 dark:hover:bg-muted dark:border-border/90",
        ghost: "text-foreground hover:bg-muted dark:hover:bg-secondary/80",
        muted: "bg-muted text-foreground hover:bg-secondary dark:bg-muted/88 dark:hover:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-[1.04]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ?Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
