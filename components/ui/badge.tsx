import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "accent" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-muted text-muted-foreground",
        variant === "accent" && "bg-accent text-accent-foreground",
        variant === "outline" && "border border-border text-foreground",
        className,
      )}
      {...props}
    />
  );
}
