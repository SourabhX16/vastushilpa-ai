"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnergyResult } from "@/lib/engine/energy/types";
import { cn } from "@/lib/utils";
import { AssumptionsPanel } from "./assumptions-panel";
import { EstimatedBadge } from "./estimated-badge";

const BAR_COLOR: Record<string, string> = {
  daylight: "bg-gold-500",
  ventilation: "bg-[#2f7d78]",
  heat: "bg-terracotta-500",
  shading: "bg-maroon-500",
};

export function EnergyScoreCard({ result }: { result: EnergyResult }) {
  return (
    <Card className="border-gold-500/30 bg-sand-50/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm text-maroon-500">
          Energy score — {result.layoutName}
          <EstimatedBadge />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <span
            className="font-display text-5xl leading-none text-maroon-500"
            aria-live="polite"
          >
            {result.score100}
          </span>
          <span className="pb-1 text-xs text-muted-foreground">of 100</span>
          <div className="ml-auto pb-1 text-right">
            <p className="text-sm font-semibold text-ink">
              Estimated cooling{" "}
              {Math.round(result.cooling.annualCoolingKWh).toLocaleString("en-IN")} kWh/yr
            </p>
            <p className="text-[11px] text-muted-foreground">
              {result.cooling.kWhPerSqft} kWh/ft²/yr ·{" "}
              {result.coolingReductionPctVsBaseline >= 0 ? "−" : "+"}
              {Math.abs(result.coolingReductionPctVsBaseline).toFixed(1)}% vs model baseline
            </p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={result.score100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Estimated energy score out of 100"
          className="h-2 w-full overflow-hidden rounded-full bg-gold-500/15"
        >
          <div
            className="h-full rounded-full bg-maroon-500 transition-[width] duration-300"
            style={{ width: `${clamp(result.score100, 0, 100)}%` }}
          />
        </div>

        <div className="space-y-2.5">
          {result.breakdown.map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                <span className="font-medium text-ink">{item.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {item.value}/100 · weight {Math.round(item.weight * 100)}% · {item.points} pts
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={item.value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.label} estimated component score`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-gold-500/15"
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-300", BAR_COLOR[item.key])}
                  style={{ width: `${clamp(item.value, 0, 100)}%` }}
                />
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">
                {item.reason}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <Stat label="Estimated daylight index" value={`${result.daylightScore}/100`} />
          <Stat label="Estimated ventilation index" value={`${result.ventilationScore}/100`} />
          <Stat
            label="Estimated shading potential"
            value={`${result.shadingScore}/100`}
          />
          <Stat
            label="Estimated cooling demand"
            value={`${Math.round(result.cooling.annualThermalKWh).toLocaleString("en-IN")} kWh thermal/yr`}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-gold-500/60 px-1.5 py-0 text-[10px] text-gold-700"
            >
              {result.climate.label} climate · {result.city.name}
            </Badge>
            <Badge
              variant="outline"
              className="border-terracotta-500/50 px-1.5 py-0 text-[10px] text-terracotta-600"
            >
              not a simulation
            </Badge>
          </div>
        </div>

        <AssumptionsPanel assumptions={result.assumptions} />

        <p className="text-[11px] leading-snug text-muted-foreground">
          This is a simplified estimate from the sun path, window areas and
          placeholder climate coefficients. It is not an energy simulation and
          must not be presented as certified performance.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gold-500/25 bg-card/60 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[12px] text-ink">{value}</p>
    </div>
  );
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
