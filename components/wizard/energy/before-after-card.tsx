"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnergyResult } from "@/lib/engine/energy/types";
import { estimateMaterials } from "@/lib/engine/structural/material";
import type { StructuralResult } from "@/lib/engine/structural/types";
import { cn } from "@/lib/utils";

interface RowDef {
  label: string;
  baselineStr: string;
  currentStr: string;
  deltaStr: string;
  favourable: boolean | null;
  unit?: string;
  subtext?: string;
}

export function BeforeAfterCard({
  current,
  baseline,
  baselineStructural,
  currentStructural,
}: {
  current: EnergyResult;
  baseline: EnergyResult;
  baselineStructural: StructuralResult | null;
  currentStructural: StructuralResult | null;
}) {
  const currentMat = useMemo(
    () => (currentStructural ? estimateMaterials(currentStructural) : null),
    [currentStructural],
  );
  const baselineMat = useMemo(
    () => (baselineStructural ? estimateMaterials(baselineStructural) : null),
    [baselineStructural],
  );

  const rows = useMemo<RowDef[]>(() => {
    const list: RowDef[] = [];

    // Energy Score (higher is better)
    const energyDelta = current.score100 - baseline.score100;
    list.push({
      label: "Energy score",
      baselineStr: `${baseline.score100}/100`,
      currentStr: `${current.score100}/100`,
      deltaStr: `${energyDelta >= 0 ? "+" : ""}${energyDelta} pts`,
      favourable: energyDelta > 0 ? true : energyDelta < 0 ? false : null,
      subtext: "Composite screening score",
    });

    // Cooling kWh/yr (lower is better)
    const bCool = baseline.cooling.annualCoolingKWh;
    const cCool = current.cooling.annualCoolingKWh;
    const coolDeltaPct = bCool > 0 ? ((cCool - bCool) / bCool) * 100 : 0;
    list.push({
      label: "Est. annual cooling",
      baselineStr: `${Math.round(bCool).toLocaleString("en-IN")} kWh`,
      currentStr: `${Math.round(cCool).toLocaleString("en-IN")} kWh`,
      deltaStr: `${coolDeltaPct >= 0 ? "+" : ""}${coolDeltaPct.toFixed(1)}%`,
      favourable: coolDeltaPct < -0.5 ? true : coolDeltaPct > 0.5 ? false : null,
      subtext: "Electrical cooling load estimate",
    });

    // Cooling intensity kWh/ft² (lower is better)
    const bInt = baseline.cooling.kWhPerSqft;
    const cInt = current.cooling.kWhPerSqft;
    const intDelta = cInt - bInt;
    list.push({
      label: "Cooling intensity",
      baselineStr: `${bInt} kWh/ft²`,
      currentStr: `${cInt} kWh/ft²`,
      deltaStr: `${intDelta >= 0 ? "+" : ""}${intDelta.toFixed(1)}`,
      favourable: intDelta < -0.1 ? true : intDelta > 0.1 ? false : null,
      subtext: "Per unit floor area",
    });

    // Daylight index (higher is better)
    const dayDelta = current.daylightScore - baseline.daylightScore;
    list.push({
      label: "Est. daylight index",
      baselineStr: `${baseline.daylightScore}/100`,
      currentStr: `${current.daylightScore}/100`,
      deltaStr: `${dayDelta >= 0 ? "+" : ""}${dayDelta} pts`,
      favourable: dayDelta > 0 ? true : dayDelta < 0 ? false : null,
      subtext: "WFR & orientation balance",
    });

    // Ventilation index (higher is better)
    const ventDelta = current.ventilationScore - baseline.ventilationScore;
    list.push({
      label: "Est. ventilation index",
      baselineStr: `${baseline.ventilationScore}/100`,
      currentStr: `${current.ventilationScore}/100`,
      deltaStr: `${ventDelta >= 0 ? "+" : ""}${ventDelta} pts`,
      favourable: ventDelta > 0 ? true : ventDelta < 0 ? false : null,
      subtext: "Cross-breeze & prevailing wind",
    });

    // Concrete volume (screening estimate)
    if (baselineMat && currentMat) {
      const concDeltaPct =
        baselineMat.concreteM3 > 0
          ? ((currentMat.concreteM3 - baselineMat.concreteM3) / baselineMat.concreteM3) * 100
          : 0;
      list.push({
        label: "Concrete (preliminary)",
        baselineStr: `${baselineMat.concreteM3} m³`,
        currentStr: `${currentMat.concreteM3} m³`,
        deltaStr: `${concDeltaPct >= 0 ? "+" : ""}${concDeltaPct.toFixed(1)}%`,
        favourable: concDeltaPct < -1 ? true : concDeltaPct > 1 ? false : null,
        subtext: "Slabs + beams + columns + footings",
      });

      // Steel mass
      const steelDeltaPct =
        baselineMat.steelKg > 0
          ? ((currentMat.steelKg - baselineMat.steelKg) / baselineMat.steelKg) * 100
          : 0;
      list.push({
        label: "Steel rebar (preliminary)",
        baselineStr: `${Math.round(baselineMat.steelKg).toLocaleString("en-IN")} kg`,
        currentStr: `${Math.round(currentMat.steelKg).toLocaleString("en-IN")} kg`,
        deltaStr: `${steelDeltaPct >= 0 ? "+" : ""}${steelDeltaPct.toFixed(1)}%`,
        favourable: steelDeltaPct < -1 ? true : steelDeltaPct > 1 ? false : null,
        subtext: "Longitudinal + stirrups + allowances",
      });
    }

    return list;
  }, [current, baseline, baselineMat, currentMat]);

  return (
    <Card className="border-gold-500/30 bg-sand-50/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm text-maroon-500">
              Before & After — Model baseline vs {current.layoutName}
            </CardTitle>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Comparison against a conventional rectangular model baseline without overhangs.
            </p>
          </div>
          <Badge variant="outline" className="border-gold-500/50 text-[10px] text-gold-600">
            comparative screening
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-md border border-gold-500/30 bg-card/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gold-500/20 bg-sand-100/40 text-[11px] font-semibold text-muted-foreground">
                <th className="py-2 pl-3 pr-2">Metric</th>
                <th className="px-2 py-2">Baseline</th>
                <th className="px-2 py-2">Current plan</th>
                <th className="py-2 pl-2 pr-3 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold-500/10 text-[11px]">
              {rows.map((row) => (
                <tr key={row.label} className="hover:bg-gold-500/5">
                  <td className="py-2 pl-3 pr-2">
                    <span className="font-medium text-ink">{row.label}</span>
                    {row.subtext && (
                      <span className="block text-[10px] text-muted-foreground">
                        {row.subtext}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-muted-foreground">{row.baselineStr}</td>
                  <td className="px-2 py-2 font-mono font-medium text-ink">{row.currentStr}</td>
                  <td className="py-2 pl-2 pr-3 text-right">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 font-mono text-[10px]",
                        row.favourable === true && "bg-emerald-500/10 font-semibold text-emerald-700",
                        row.favourable === false && "bg-terracotta-500/10 font-semibold text-terracotta-600",
                        row.favourable === null && "bg-gold-500/10 text-muted-foreground",
                      )}
                    >
                      {row.deltaStr}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 text-[10px] leading-snug text-muted-foreground">
          <p>
            • <strong>Model baseline:</strong> A conventional rectangular grid with identical floor area,
            unshaded glazing, and no daylight or orientation optimisation. Not a real project design.
          </p>
          <p>
            • <strong>Overhang assumption:</strong> The current layout&apos;s cooling estimate assumes
            the computed minimum overhangs and fins are installed as designed.
          </p>
          {baselineMat && currentMat && (
            <p>
              • <strong>Material quantities:</strong> Preliminary structural take-offs from IS 456
              member sizing, not a tender bill of quantities (BOQ). Concrete includes footings; slab steel is a volume placeholder.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
