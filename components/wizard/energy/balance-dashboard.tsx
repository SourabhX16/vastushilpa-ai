"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { EnergyResult } from "@/lib/engine/energy/types";
import type { StructuralResult } from "@/lib/engine/structural/types";
import type { Layout, LayoutMode, VastuResult } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

const DEFAULT_WEIGHTS = { vastu: 35, energy: 35, structural: 30 };
const PICK_MARGIN = 2;

type Weights = typeof DEFAULT_WEIGHTS;

interface Row {
  layout: Layout;
  vastu: number;
  energy: number;
  structural: number | null;
  weighted: number;
  selected: boolean;
}

export function BalanceDashboard({
  layouts,
  vastu,
  energy,
  structural,
  activeMode,
  onSelect,
}: {
  layouts: Layout[];
  vastu: Map<string, VastuResult>;
  energy: Map<string, EnergyResult>;
  structural: Map<string, StructuralResult | null>;
  activeMode: LayoutMode;
  onSelect: (mode: LayoutMode) => void;
}) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const totalWeight = Math.max(
    1,
    weights.vastu + weights.energy + weights.structural,
  );

  const rows = useMemo<Row[]>(
    () =>
      layouts.map((layout) => {
        const vastuScore = vastu.get(layout.id)?.score100 ?? 0;
        const energyScore = energy.get(layout.id)?.score100 ?? 0;
        const structuralScore = structuralScoreFor(
          structural.get(layout.id) ?? null,
        );
        const weighted =
          (vastuScore * weights.vastu +
            energyScore * weights.energy +
            (structuralScore ?? 0) * weights.structural) /
          totalWeight;
        return {
          layout,
          vastu: vastuScore,
          energy: energyScore,
          structural: structuralScore,
          weighted: Math.round(weighted),
          selected: layout.id === activeMode,
        };
      }),
    [layouts, vastu, energy, structural, weights, totalWeight, activeMode],
  );

  const ranked = useMemo(
    () => [...rows].sort((a, b) => b.weighted - a.weighted),
    [rows],
  );
  const top = ranked[0];
  const second = ranked[1];
  const margin = top && second ? top.weighted - second.weighted : 0;
  const pick = top && (!second || margin >= PICK_MARGIN) ? top : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg text-maroon-500">
              Three-way balance — Vastu × Energy × Structure
            </CardTitle>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Weighted comparison of the three generated layouts. All three
              scores are simplified estimates; adjust the weights to reflect
              what matters most to the household.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-gold-500/50 text-sm text-gold-600"
          >
            weighted comparison
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border border-gold-500/30 bg-card/60 p-3 sm:grid-cols-3">
          <WeightControl
            label="Vastu"
            value={weights.vastu}
            onChange={(vastu) => setWeights((w) => ({ ...w, vastu }))}
          />
          <WeightControl
            label="Energy"
            value={weights.energy}
            onChange={(energy) => setWeights((w) => ({ ...w, energy }))}
          />
          <WeightControl
            label="Structural"
            value={weights.structural}
            onChange={(structural) => setWeights((w) => ({ ...w, structural }))}
          />
          <div className="flex items-center justify-between gap-2 sm:col-span-3">
            <p className="text-sm text-muted-foreground">
              Normalised over {totalWeight} total weight. Structural score =
              pass + half-credit for amber members (after autofix).
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-sm"
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
            >
              Reset 35 / 35 / 30
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-md border px-3 py-2",
            pick
              ? "border-maroon-500/35 bg-maroon-500/5"
              : "border-gold-500/40 bg-gold-500/5",
          )}
          aria-live="polite"
        >
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Computed pick at these weights
          </p>
          <p className="font-display text-lg leading-tight text-maroon-500">
            {pick ? pick.layout.name : "Too close to call"}
          </p>
          <p className="text-sm leading-snug text-muted-foreground">
            {pick
              ? `Leads ${second ? second.layout.name : "the field"} by ${margin} weighted point${margin === 1 ? "" : "s"} — the margin, not a fixed favourite, drives this pick.`
              : `The top layouts are within ${PICK_MARGIN} weighted points. Use the sliders or review the numbers rather than assuming one layout wins.`}
          </p>
        </div>

        <div className="space-y-2">
          {ranked.map((row) => (
            <button
              key={row.layout.id}
              type="button"
              onClick={() => onSelect(row.layout.id)}
              aria-pressed={row.selected}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left transition-colors",
                row.selected
                  ? "border-maroon-500/50 bg-maroon-500/5"
                  : "border-gold-500/30 bg-card/50 hover:bg-gold-500/5",
              )}
            >
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-ink">
                  {row.layout.name}
                  {row.layout.id === "balanced" && (
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      balanced mode
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm text-maroon-500">
                  {row.weighted} weighted
                </span>
              </div>
              <div className="space-y-1">
                <Gauge
                  label="Vastu"
                  value={row.vastu}
                  color="bg-maroon-500"
                  suffix="/100"
                />
                <Gauge
                  label="Energy"
                  value={row.energy}
                  color="bg-gold-500"
                  suffix="/100 · est."
                />
                <Gauge
                  label="Structure"
                  value={row.structural}
                  color="bg-[#2f7d78]"
                  suffix="/100"
                />
              </div>
            </button>
          ))}
        </div>

        <p className="text-sm leading-snug text-muted-foreground">
          The energy score is an estimate from the simplified energy model, not
          a simulation. The structural score summarises preliminary IS 456
          checks after autofix, with amber members earning half credit; it is
          not a substitute for design by a qualified structural engineer.
        </p>
      </CardContent>
    </Card>
  );
}

function WeightControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-muted-foreground">{value}%</span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={5}
        aria-label={`${label} weight`}
        onValueChange={(next) => onChange(next[0] ?? 0)}
      />
    </div>
  );
}

function Gauge({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number | null;
  color: string;
  suffix: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gold-500/15">
        <span
          className={cn("block h-full rounded-full", color)}
          style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
        />
      </span>
      <span className="w-24 shrink-0 text-right font-mono text-ink">
        {value === null ? "not run" : value}
        {value === null ? "" : suffix}
      </span>
    </div>
  );
}

function structuralScoreFor(result: StructuralResult | null): number | null {
  if (!result || result.summary.total === 0) return null;
  const halfCredit = result.summary.amber * 0.5;
  return Math.round(((result.summary.pass + halfCredit) / result.summary.total) * 100);
}
