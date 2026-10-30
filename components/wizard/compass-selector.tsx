"use client";

import type { PlotFacing } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { FACING_LABELS } from "./parse-plot";

const POSITIONS: { facing: PlotFacing; x: number; y: number; arrow: string }[] = [
  { facing: "N", x: 50, y: 9, arrow: "↑" },
  { facing: "NE", x: 79, y: 21, arrow: "↗" },
  { facing: "E", x: 91, y: 50, arrow: "→" },
  { facing: "SE", x: 79, y: 79, arrow: "↘" },
  { facing: "S", x: 50, y: 91, arrow: "↓" },
  { facing: "SW", x: 21, y: 79, arrow: "↙" },
  { facing: "W", x: 9, y: 50, arrow: "←" },
  { facing: "NW", x: 21, y: 21, arrow: "↖" },
];

interface CompassSelectorProps {
  value: PlotFacing;
  onChange: (facing: PlotFacing) => void;
}

/** 8-direction compass rose selector for the road-facing side. */
export function CompassSelector({ value, onChange }: CompassSelectorProps) {
  const selected = FACING_LABELS[value];
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
      <div
        role="radiogroup"
        aria-label="Road-facing direction (8 compass directions)"
        className="relative mx-auto h-40 w-40 shrink-0 rounded-full border border-gold-500/50 bg-sand-50/70 shadow-inner sm:mx-0"
      >
        {POSITIONS.map((pos) => {
          const active = value === pos.facing;
          return (
            <button
              key={pos.facing}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={FACING_LABELS[pos.facing]}
              onClick={() => onChange(pos.facing)}
              className={cn(
                "absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-maroon-600 bg-maroon-500 text-primary-foreground shadow-md shadow-maroon-500/30"
                  : "border-gold-500/40 bg-card text-gold-600 hover:border-gold-600 hover:bg-secondary",
              )}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <span aria-hidden>{pos.arrow}</span>
            </button>
          );
        })}
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl text-maroon-500">{value}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {selected}
          </span>
        </span>
      </div>
      <p className="text-center text-xs text-muted-foreground sm:max-w-[16ch] sm:text-left sm:text-sm">
        The side of the plot that touches the road.
      </p>
    </div>
  );
}
