import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A shared "nothing here yet" card — an icon in a soft tinted circle,
 * a short title, and an optional description/action. Replaces what used
 * to be seven near-identical spots (feed, chat, notifications, profile,
 * community, discover ×2) each hand-rolling a bare Card + centered gray
 * sentence with no icon — those read as unfinished rather than
 * intentional. `description` is a ReactNode (not just a string) so a
 * call site can still embed its own inline links, same as feed's existing
 * "Follow a few people from Discover" copy.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <Card className={cn("p-8 text-center", className)}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          {action.label}
        </Link>
      )}
    </Card>
  );
}
