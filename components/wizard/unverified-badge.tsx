import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const UNVERIFIED_TOOLTIP =
  "Formula pending verification against primary texts";

interface UnverifiedBadgeProps {
  label?: string;
  tooltip?: string;
  className?: string;
}

/**
 * Diamond-motif "unverified" pill with a hover/focus tooltip, used everywhere
 * traditional data or formulas are still unverified in config.
 */
export function UnverifiedBadge({
  label = "Unverified formula",
  tooltip = UNVERIFIED_TOOLTIP,
  className,
}: UnverifiedBadgeProps) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <Badge
        variant="outline"
        className="cursor-help gap-1 border-gold-500/60 bg-gold-500/10 px-1.5 py-0 text-[10px] font-medium text-gold-600"
      >
        <Info className="h-3 w-3" aria-hidden />
        {label}
      </Badge>
      <span
        aria-hidden
        className="pointer-events-none absolute -top-1.5 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-md border border-gold-500/40 bg-popover px-2 py-1 text-center text-[11px] leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  );
}
