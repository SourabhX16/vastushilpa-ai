"use client";

import { useMemo, useState } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlotInput } from "@/lib/engine/types";
import { computeVastuGrid } from "@/lib/engine/vastuGrid";
import { ZONE_DEITIES } from "@/lib/data/vastu.config";
import { cn } from "@/lib/utils";
import { UnverifiedBadge } from "./unverified-badge";

/**
 * VastuGridCard — the 3×3 Vastu Purusha mandala with deities shown in the
 * Rules step. The zone-deity mapping itself is unverified data (see
 * vastu.config.ts), which the badge states explicitly.
 */

const GOLD = "#8f7024";
const GOLD_LINE = "#b08d3e";
const INK = "#2c2822";

export function VastuGridCard({ input }: { input: PlotInput }) {
  const [showPadas, setShowPadas] = useState(false);

  const grid = useMemo(() => {
    try {
      return computeVastuGrid(input);
    } catch {
      return null;
    }
  }, [input]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-maroon-500">
            <Compass className="h-4 w-4 text-gold-600" aria-hidden />
            Vastu grid — zones and deities
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The plot split into the nine mandala zones, drawn north-up.
            The central Brahmasthan stays free of masonry in every layout.
          </p>
        </div>
        <UnverifiedBadge
          label="Zone deities unverified"
          tooltip="Zone-deity map transcribed from secondary sources — see vastu.config.ts before trusting it."
        />
      </CardHeader>
      <CardContent>
        {grid ? (
          <>
            <svg
              viewBox={`-2.2 -2.6 ${grid.lengthFt + 4.4} ${grid.widthFt + 5.2}`}
              className="mx-auto max-h-[430px] w-full max-w-md"
              role="img"
              aria-label={`3x3 vastu zone grid of the ${grid.lengthFt} x ${grid.widthFt} ft plot`}
            >
              {/* plot base */}
              <rect x={0} y={0} width={grid.lengthFt} height={grid.widthFt} fill="#faf6ec" stroke="none" />

              <defs>
                <pattern id="zoneHatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="1.2" stroke={GOLD_LINE} strokeWidth="0.24" opacity="0.5" />
                </pattern>
              </defs>

              {showPadas &&
                grid.padas.map((p, i) => (
                  <rect key={`p${i}`} x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke="#e7d9c2" strokeWidth="0.035" />
                ))}

              {grid.cells.map((cell) => (
                <ZoneCellSvg key={`${cell.zone}-${cell.zone}`} zone={cell.zone} rect={cell.rect} />
              ))}

              <rect x={0} y={0} width={grid.lengthFt} height={grid.widthFt} fill="none" stroke="#4a141d" strokeWidth="0.35" />
              <text x={grid.lengthFt - 1} y={-1.1} textAnchor="end" fontSize="1.2" fontWeight="700" fill={GOLD}>
                N ↑
              </text>
            </svg>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant={showPadas ? "default" : "outline"}
                className={cn(
                  "gap-1.5",
                  showPadas ? "bg-maroon-500 text-primary-foreground hover:bg-maroon-600" : "border-gold-500/50 text-maroon-600",
                )}
                onClick={() => setShowPadas((v) => !v)}
                aria-pressed={showPadas}
              >
                {showPadas ? "Hide" : "Show"} 9×9 pada mandala
              </Button>
              <p className="text-sm text-muted-foreground">
                {showPadas
                  ? "81 padas = the finer mandala a traditional vastu consultant works with."
                  : "3×3 zones = the working grid the layout engine follows."}
              </p>
            </div>
          </>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-2 rounded border border-dashed border-terracotta-500/50 bg-terracotta-500/5 text-center">
            <p className="font-display text-lg text-maroon-500">Grid needs complete inputs</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              The mandala needs a valid plot size — go back to the Inputs step and finish dimensions, unit, city and bedrooms.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ZoneCellSvg({
  zone,
  rect,
}: {
  zone: keyof typeof ZONE_DEITIES;
  rect: { x: number; y: number; w: number; h: number };
}) {
  const meta = ZONE_DEITIES[zone];
  const isCentre = zone === "C";
  const fontSize = clamp(Math.min(rect.w / 6.5, rect.h / 5.2, 1.35), 0.5, 1.35);
  const deitySize = clamp(fontSize * 0.78, 0.42, 1.05);

  return (
    <g>
      {isCentre && rect.w > 2.6 && rect.h > 2.6 ? (
        <>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="url(#zoneHatch)" stroke={GOLD_LINE} strokeWidth="0.3" />
          <text
            x={rect.x + rect.w / 2}
            y={rect.y + rect.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={deitySize}
            fontStyle="italic"
            fill={GOLD}
          >
            Brahmasthan — keep open
          </text>
        </>
      ) : (
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={isCentre ? "url(#zoneHatch)" : "#faf6ec"} stroke="#d9c7a8" strokeWidth="0.07" />
      )}
      {!isCentre && (
        <>
          <text
            x={rect.x + rect.w / 2}
            y={rect.y + rect.h / 2 - fontSize * 0.62}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight="600"
            fill={INK}
          >
            {zone} · {meta.name}
          </text>
          <text
            x={rect.x + rect.w / 2}
            y={rect.y + rect.h / 2 + fontSize * 0.66}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={deitySize}
            fill={GOLD}
          >
            {meta.deity}
          </text>
        </>
      )}
    </g>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
