"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnergyResult, RoomEnergy } from "@/lib/engine/energy/types";
import type { StructuralResult } from "@/lib/engine/structural/types";
import type { VastuCheck, VastuResult } from "@/lib/engine/types";
import { VASTU_ROOM_CONFIG } from "@/lib/data/vastu.config";
import { cn } from "@/lib/utils";

interface Conflict {
  id: string;
  title: string;
  kind: string;
  vastu: string;
  energy?: string;
  structural?: string;
  verdict: string;
  tone: "warning" | "info";
}

export function TradeoffExplainer({
  vastu,
  energy,
  structural,
}: {
  vastu: VastuResult;
  energy: EnergyResult;
  structural: StructuralResult | null;
}) {
  const conflicts = buildConflicts(vastu, energy, structural);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg text-maroon-500">
          Where the three goals pull apart
          <Badge
            variant="outline"
            className="border-gold-500/50 text-sm text-gold-600"
          >
            generated from this layout&apos;s metrics
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {conflicts.length === 0 ? (
          <p className="rounded-md border border-gold-500/30 bg-card/60 px-3 py-2 text-sm leading-snug text-muted-foreground">
            No hard conflict surfaced at this resolution. Vastu placements,
            energy metrics and the preliminary structural checks do not pull in
            opposite directions for this layout — but the scores are still
            estimates, so treat this as “no conflict detected”, not a
            guarantee.
          </p>
        ) : (
          conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={cn(
                "rounded-md border bg-card/60 px-3 py-2",
                conflict.tone === "warning"
                  ? "border-terracotta-500/40"
                  : "border-gold-500/30",
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">
                  {conflict.title}
                </span>
                <Badge
                  variant="outline"
                  className="border-gold-500/50 px-1.5 py-0 text-sm text-gold-600"
                >
                  {conflict.kind}
                </Badge>
              </div>
              <dl className="space-y-1 text-sm leading-snug">
                <div className="flex gap-1.5">
                  <dt className="w-16 shrink-0 font-medium text-maroon-500">
                    Vastu
                  </dt>
                  <dd className="text-muted-foreground">{conflict.vastu}</dd>
                </div>
                {conflict.energy && (
                  <div className="flex gap-1.5">
                    <dt className="w-16 shrink-0 font-medium text-gold-600">
                      Energy
                    </dt>
                    <dd className="text-muted-foreground">{conflict.energy}</dd>
                  </div>
                )}
                {conflict.structural && (
                  <div className="flex gap-1.5">
                    <dt className="w-16 shrink-0 font-medium text-[#236760]">
                      Structure
                    </dt>
                    <dd className="text-muted-foreground">
                      {conflict.structural}
                    </dd>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <dt className="w-16 shrink-0 font-medium text-ink">
                    Reading
                  </dt>
                  <dd className="text-ink/80">{conflict.verdict}</dd>
                </div>
              </dl>
            </div>
          ))
        )}
        <p className="text-sm leading-snug text-muted-foreground">
          Trade-offs are rule-generated from the actual metrics above. They are
          prompts for a conversation with the household, not design rulings.
        </p>
      </CardContent>
    </Card>
  );
}

function buildConflicts(
  vastu: VastuResult,
  energy: EnergyResult,
  structural: StructuralResult | null,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const checks = new Map<string, VastuCheck>();
  for (const check of vastu.breakdown) {
    if (check.roomType && check.zone) {
      checks.set(`${check.roomType}:${check.zone}`, check);
    }
  }
  const checkFor = (room: RoomEnergy) =>
    checks.get(`${room.roomType}:${room.zone}`) ?? null;

  const kitchen = energy.rooms.find((room) => room.roomType === "kitchen");
  if (kitchen) {
    const kitchenCheck = checkFor(kitchen);
    const roomCooling = energy.rooms.map((room) => room.cooling.thermalKWhYear);
    const meanCooling =
      roomCooling.reduce((sum, value) => sum + value, 0) /
      Math.max(1, roomCooling.length);
    const heaty =
      kitchen.heavyWestExposure ||
      kitchen.cooling.thermalKWhYear > meanCooling * 1.15 ||
      kitchen.summerWindowExposure > 12;
    if (kitchen.zone === "SE" && heaty) {
      conflicts.push({
        id: "kitchen-se-heat",
        title: `Kitchen in SE — ${kitchen.roomLabel}`,
        kind: "Vastu ↔ energy",
        vastu: `${kitchenCheck?.reason ?? "The kitchen sits in the preferred SE zone."} ${kitchenCheck?.remedy ?? ""}`.trim(),
        energy: `Estimated ${Math.round(kitchen.cooling.thermalKWhYear).toLocaleString("en-IN")} kWh/yr thermal cooling load; summer window exposure ${kitchen.summerWindowExposure.toFixed(1)} sun-hours.`,
        verdict:
          "Keep the Vastu placement and reduce the heat with overhangs/fins, high-level vents or a lighter roof — do not move the kitchen just to lower the estimate.",
        tone: "warning",
      });
    } else if (
      kitchenCheck &&
      kitchenCheck.status !== "ideal" &&
      kitchen.cooling.thermalKWhYear <= meanCooling
    ) {
      conflicts.push({
        id: "kitchen-relocated",
        title: `Kitchen moved out of SE — ${kitchen.roomLabel}`,
        kind: "Vastu ↔ energy",
        vastu: `${kitchenCheck.reason}${kitchenCheck.remedy ? ` ${kitchenCheck.remedy}` : ""}`,
        energy: `Estimated cooling load is below this layout's room average (${Math.round(kitchen.cooling.thermalKWhYear).toLocaleString("en-IN")} vs ${Math.round(meanCooling).toLocaleString("en-IN")} kWh/yr thermal).`,
        verdict:
          "This is a real trade: better thermal position against a non-preferred Vastu zone. Confirm with the household before changing it.",
        tone: "info",
      });
    }
  }

  const forced = [...(structural?.forcedSpans ?? [])].sort(
    (a, b) => b.spanFt - a.spanFt,
  );
  if (forced.length > 0) {
    const longest = forced[0];
    conflicts.push({
      id: "brahmasthan-spans",
      title: "Open Brahmasthan vs forced spans",
      kind: "Vastu ↔ structure",
      vastu: vastu.brahmasthan.reason,
      structural: `${forced.length} forced span${forced.length === 1 ? "" : "s"} across the column-free centre; longest ${longest.spanM.toFixed(2)} m (${longest.spanFt.toFixed(1)} ft)${longest.exceeds45m ? " — beyond the 4.5 m preliminary threshold" : ""}.`,
      verdict:
        "The open centre is being kept, but it forces longer beams. Confirm the deeper beam sizes and deflection with a structural engineer before committing.",
      tone: longest.exceeds45m ? "warning" : "info",
    });
  }

  const singleSidedIdeal = energy.rooms
    .filter(
      (room) =>
        room.windowCount > 0 &&
        room.ventilation.singleSided &&
        checkFor(room)?.status === "ideal",
    )
    .sort((a, b) => a.ventilationScore - b.ventilationScore)[0];
  if (singleSidedIdeal) {
    const check = checkFor(singleSidedIdeal);
    conflicts.push({
      id: "ideal-single-sided",
      title: `Ideal Vastu, single-sided air — ${singleSidedIdeal.roomLabel}`,
      kind: "Vastu ↔ ventilation",
      vastu: `${check?.reason ?? "This room is in an ideal zone."} ${check?.remedy ?? ""}`.trim(),
      energy: `Openings on ${singleSidedIdeal.ventilation.openingWalls.join("/") || "one wall"} only; estimated ventilation ${singleSidedIdeal.ventilationScore}/100.`,
      verdict:
        "Keep the zone and add an opposite vent, jaali or ventilator rather than moving the room. Single-sided rooms need a deliberate second opening.",
      tone: "warning",
    });
  }

  const misaligned = energy.rooms
    .map((room) => ({ room, check: checkFor(room) }))
    .filter(
      (entry): entry is { room: RoomEnergy; check: VastuCheck } =>
        Boolean(entry.check) &&
        entry.check?.status !== "ideal" &&
        (entry.room.daylightScore >= 65 || entry.room.ventilationScore >= 70),
    )
    .sort(
      (a, b) =>
        b.room.daylightScore +
        b.room.ventilationScore -
        (a.room.daylightScore + a.room.ventilationScore),
    )[0];
  if (misaligned) {
    const preferred = VASTU_ROOM_CONFIG[misaligned.room.roomType].preferred.join(
      " / ",
    );
    conflicts.push({
      id: "energy-favoured-placement",
      title: `Energy-favoured placement — ${misaligned.room.roomLabel} in ${misaligned.room.zone}`,
      kind: "Vastu ↔ energy",
      vastu: `${misaligned.check.reason} Preferred zone${preferred.includes("/") ? "s" : ""}: ${preferred}.`,
      energy: `Estimated daylight ${misaligned.room.daylightScore}/100 and ventilation ${misaligned.room.ventilationScore}/100 reward this position.`,
      verdict:
        "If daylight/airflow is the household's priority, treat the Vastu remedy as the compensating measure instead of forcing the room back.",
      tone: "info",
    });
  }

  return dedupe(conflicts).slice(0, 4);
}

function dedupe(conflicts: Conflict[]): Conflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    if (seen.has(conflict.id)) return false;
    seen.add(conflict.id);
    return true;
  });
}
