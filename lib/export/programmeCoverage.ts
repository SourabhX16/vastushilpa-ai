import type { Layout, PlotInput, VastuRoomType } from "@/lib/engine/types";

export interface UnplacedSpace {
  label: string;
  reason: string;
}

export interface ProgrammeCoverage {
  placed: number;
  requested: number;
  unplaced: UnplacedSpace[];
}

/** Derives the requested ground-floor programme from inputs and placed room types. */
export function getProgrammeCoverage(plot: PlotInput, layout: Layout): ProgrammeCoverage {
  const requested: { type: VastuRoomType; label: string; aliases?: string[] }[] = [];
  if (plot.poojaRoom) requested.push({ type: "pooja", label: "Pooja room" });
  requested.push({ type: "masterBedroom", label: "Master bedroom" });
  if (plot.parking) requested.push({ type: "parking", label: "Parking bay" });
  requested.push(
    { type: "verandah", label: "Entrance verandah / foyer" },
    { type: "bathroom", label: "Bathroom" },
    { type: "toilet", label: "Toilet (common)" },
    ...(plot.elderlyGroundFloor ? [{ type: "toilet" as const, label: "Toilet (elderly / entrance side)" }] : []),
    { type: "kitchen", label: "Kitchen" },
    { type: "staircase", label: "Staircase (to first floor)" },
    { type: "living", label: "Living room" },
  );
  const bedrooms = Math.max(1, Math.round(plot.bedrooms));
  for (let bedroom = 2; bedroom <= bedrooms; bedroom++) {
    requested.push(bedroom === 3
      ? { type: "childrenBedroom", label: "Bedroom 3", aliases: ["Children's bedroom"] }
      : { type: "bedroom", label: `Bedroom ${bedroom}` });
  }
  requested.push({ type: "dining", label: "Dining" });
  if (bedrooms >= 4) requested.push({ type: "store", label: "Store room" });

  const unused = [...(layout.rooms ?? [])];
  const missing: typeof requested = [];
  for (const item of requested) {
    const index = unused.findIndex((room) => room.type === item.type);
    if (index < 0) missing.push(item);
    else unused.splice(index, 1);
  }

  const unplaced = missing.map((item) => {
    const note = layout.notes.find((entry) =>
      [item.label, ...(item.aliases ?? [])].some((label) => entry.startsWith(label)),
    );
    let reason = "reason not recorded";
    if (note) {
      if (note.includes(" moved to ")) {
        reason = `moved to ${note.split(" moved to ").slice(1).join(" moved to ").replace(/[.]$/, "")}`;
      } else if (note.includes(": ")) {
        reason = note.slice(note.indexOf(": ") + 2).replace(/[.]$/, "");
      }
    }
    return { label: item.label, reason };
  });

  return { placed: requested.length - unplaced.length, requested: requested.length, unplaced };
}

export function formatProgrammeCoverage(coverage: ProgrammeCoverage): string {
  if (coverage.unplaced.length === 0) return "All requested spaces placed";
  const missing = coverage.unplaced.map(({ label, reason }) => `${label} (${reason})`).join(", ");
  return `Placed: ${coverage.placed} of ${coverage.requested} requested spaces. Not placed: ${missing}`;
}
