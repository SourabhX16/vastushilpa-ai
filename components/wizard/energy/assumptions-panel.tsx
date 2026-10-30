"use client";

import { Badge } from "@/components/ui/badge";
import type { EnergyAssumption } from "@/lib/engine/energy/types";
import { cn } from "@/lib/utils";

export function AssumptionsPanel({
  assumptions,
  title = "Assumptions & formulas",
  className,
}: {
  assumptions: EnergyAssumption[];
  title?: string;
  className?: string;
}) {
  const unverified = assumptions.filter((a) => !a.verified).length;
  return (
    <details
      className={cn(
        "group rounded-md border border-gold-500/35 bg-card/70 text-sm text-muted-foreground",
        className,
      )}
    >
      <summary className="cursor-pointer list-none px-3 py-2 font-medium text-maroon-500 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-2">
          {title} ({assumptions.length})
          <Badge
            variant="outline"
            className="border-terracotta-500/50 px-1.5 py-0 text-sm text-terracotta-600"
          >
            {unverified} marked verified:false
          </Badge>
          <span className="text-sm font-normal text-gold-600 group-open:hidden">
            open
          </span>
        </span>
      </summary>
      <ul className="space-y-2 border-t border-gold-500/25 px-3 py-2">
        {assumptions.map((assumption) => (
          <li key={assumption.id} className="space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold text-ink">{assumption.label}</span>
              <span className="text-sm text-muted-foreground">
                {assumption.value}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "ml-auto px-1.5 py-0 text-sm",
                  assumption.verified
                    ? "border-emerald-700/40 text-emerald-800"
                    : "border-terracotta-500/50 text-terracotta-600",
                )}
              >
                {assumption.verified ? "standard formula" : "verified:false"}
              </Badge>
            </div>
            <p className="font-mono text-sm leading-snug text-ink/80">
              {assumption.formula}
            </p>
            <p className="text-sm leading-snug">{assumption.source}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
