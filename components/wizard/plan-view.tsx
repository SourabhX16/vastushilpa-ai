"use client";

import { useMemo } from "react";
import type { Layout, PlanRoom, PlotInput, Rect, VastuGrid, WallSide } from "@/lib/engine/types";
import type {
  CheckStatus,
  StructuralResult,
} from "@/lib/engine/structural/types";
import type { EnergyResult, Season } from "@/lib/engine/energy/types";
import { computeVastuGrid } from "@/lib/engine/vastuGrid";
import { cn } from "@/lib/utils";

/**
 * PlanView — the 2D plan renderer for the Design step.
 *
 * Coordinate convention (engine-wide): x runs west→east along the plot's
 * EAST-WEST extent (length), y runs NORTH→SOUTH along the NORTH-SOUTH
 * extent (width); the plan is drawn north-up and the SVG y-axis grows
 * downward, exactly like the engine's rect coordinates — no mirroring.
 * Everything is measured in feet.
 */

const PLOT_FILL = "#faf6ec";
const ZONE_STROKE = "#d9c7a8";
const PADA_STROKE = "#e7d9c2";
const WALL_STROKE = "#4a141d";
const ROOM_STROKE = "#5e1b26";
const GOLD = "#b08d3e";
const GOLD_DEEP = "#8f7024";
const TERRACOTTA = "#a94e2a";
const INK = "#2c2822";

const ROOM_FILL: Record<PlanRoom["type"], string> = {
  living: "#f3ead9",
  kitchen: "#f2e2d0",
  dining: "#efe6d2",
  masterBedroom: "#ecdfca",
  bedroom: "#efe7d8",
  childrenBedroom: "#f1e9d9",
  pooja: "#f5ecca",
  toilet: "#e6e0d3",
  bathroom: "#e9e3d6",
  staircase: "#e2d3bd",
  store: "#e5ded1",
  parking: "#e3dccf",
  verandah: "#f6eeda",
};

interface PlanViewProps {
  input: PlotInput;
  layout: Layout | null;
  /** Overlay the 81-pada mandala grid (display only). */
  showPadas?: boolean;
  /** Structural overlay: columns/beams from the engine run (clickable). */
  structural?: StructuralResult | null;
  showStructure?: boolean;
  activeMember?: string | null;
  onSelectMember?: (id: string | null) => void;
  energy?: EnergyResult | null;
  showDaylightHeatmap?: boolean;
  showVentilationArrows?: boolean;
  showSunShading?: boolean;
  season?: Season;
  className?: string;
}

export function PlanView({
  input,
  layout,
  showPadas = false,
  structural = null,
  showStructure = false,
  activeMember = null,
  onSelectMember,
  energy = null,
  showDaylightHeatmap = false,
  showVentilationArrows = false,
  showSunShading = false,
  season = "summer",
  className,
}: PlanViewProps) {
  const grid = useMemo(() => {
    try {
      return computeVastuGrid(input);
    } catch {
      return null;
    }
  }, [input]);

  if (!grid) {
    return (
      <div className="flex h-56 items-center justify-center rounded border border-dashed border-gold-500/40 bg-sand-50/70 text-sm text-muted-foreground">
        The plan needs valid plot dimensions first.
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <PlanSvg
        input={input}
        layout={layout}
        grid={grid}
        showPadas={showPadas}
        structural={showStructure ? structural : null}
        activeMember={activeMember}
        onSelectMember={onSelectMember}
        energy={energy}
        showDaylightHeatmap={showDaylightHeatmap}
        showVentilationArrows={showVentilationArrows}
        showSunShading={showSunShading}
        season={season}
      />
    </div>
  );
}

interface PlanSvgProps {
  input: PlotInput;
  layout: Layout | null;
  grid: VastuGrid;
  showPadas: boolean;
  structural?: StructuralResult | null;
  activeMember?: string | null;
  onSelectMember?: (id: string | null) => void;
  energy: EnergyResult | null;
  showDaylightHeatmap: boolean;
  showVentilationArrows: boolean;
  showSunShading: boolean;
  season: Season;
}

function PlanSvg({
  input,
  layout,
  grid,
  showPadas,
  structural,
  activeMember,
  onSelectMember,
  energy,
  showDaylightHeatmap,
  showVentilationArrows,
  showSunShading,
  season,
}: PlanSvgProps) {
  const { lengthFt: L, widthFt: W, padas } = grid;
  const centre = grid.cells.find((c) => c.zone === "C");
  const entrance = layout?.entrance ?? null;

  // View-port padding (ft): room for the W/N dimension lines and the
  // entrance arrow / door label on the road side.
  const padL = 4.6;
  const padT = 5.4;
  const padR = 5;
  const padB = 5;
  const vb = `${-padL} ${-padT} ${L + padL + padR} ${W + padT + padB}`;

  return (
    <svg
      viewBox={vb}
      className="max-h-[560px] w-full"
      role="img"
      aria-label={`2D plan of a ${L} × ${W} ft ${labelOf(input.facing)}-facing layout with ${layout?.rooms.length ?? 0} rooms`}
    >
      <defs>
        <pattern id="brahmaHatch" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.4" stroke={GOLD} strokeWidth="0.28" opacity="0.45" />
        </pattern>
        <marker id="entryArrow" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill={GOLD_DEEP} />
        </marker>
        <marker id="dimTick" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
          <path d="M1,3.2 L2,0.8 L3,3.2" fill="none" stroke={GOLD_DEEP} strokeWidth="0.5" />
        </marker>
        <marker id="ventArrow" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#2f7d78" />
        </marker>
      </defs>

      {/* plot ground */}
      <rect x={0} y={0} width={L} height={W} fill={PLOT_FILL} stroke="none" />

      {(showPadas ? padas : grid.cells.map((c) => c.rect)).map((r, i) => (
        <rect
          key={`grid-${i}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill="none"
          stroke={showPadas ? PADA_STROKE : ZONE_STROKE}
          strokeWidth={showPadas ? 0.04 : 0.08}
        />
      ))}

      {/* Brahmasthan: centre cell kept open */}
      {centre && (
        <>
          <rect x={centre.rect.x} y={centre.rect.y} width={centre.rect.w} height={centre.rect.h} fill="url(#brahmaHatch)" stroke={GOLD} strokeWidth="0.12" />
          {centre.rect.w > 9 && centre.rect.h > 6.5 && (
            <text
              x={centre.rect.x + centre.rect.w / 2}
              y={centre.rect.y + centre.rect.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(1.1, centre.rect.w / 12)}
              fill={GOLD_DEEP}
              fontStyle="italic"
            >
              Brahmasthan — keep open
            </text>
          )}
        </>
      )}

      {/* rooms */}
      {layout?.rooms.map((room) => (
        <RoomShape key={room.id} room={room} L={L} W={W} />
      ))}

      {showDaylightHeatmap && energy?.rooms.flatMap((room) =>
        room.daylightHeatmap.map((cell, i) => (
          <rect
            key={`daylight-${room.roomId}-${i}`}
            x={cell.rect.x}
            y={cell.rect.y}
            width={cell.rect.w}
            height={cell.rect.h}
            fill="#d49a32"
            fillOpacity={0.08 + Math.max(0, Math.min(100, cell.value)) / 250}
            stroke="#a94e2a"
            strokeOpacity="0.2"
            strokeWidth="0.04"
          >
            <title>{room.roomLabel}: estimated daylight {cell.value}/100</title>
          </rect>
        )),
      )}

      {showSunShading && energy && layout?.rooms.flatMap((room) =>
        room.windows.map((mark, index) => {
          const window = energy.windows.find((candidate) => candidate.roomId === room.id && candidate.index === index);
          const segment = windowSegment(room, mark, L, W);
          if (!window || !segment) return null;
          const exposure = season === "winter" ? window.winterExposure : window.summerExposure;
          const offset = 0.18 + Math.min(1, window.requiredOverhangFt / 6) * 0.36;
          return (
            <line
              key={`shade-${room.id}-${index}`}
              x1={segment.x1 + segment.nx * offset}
              y1={segment.y1 + segment.ny * offset}
              x2={segment.x2 + segment.nx * offset}
              y2={segment.y2 + segment.ny * offset}
              stroke="#d66a32"
              strokeWidth="0.42"
              strokeOpacity={0.25 + Math.min(0.75, exposure / 3)}
              strokeLinecap="round"
            >
              <title>{room.label}: {season} exposure {exposure.toFixed(1)} sun-hours; estimated overhang {window.requiredOverhangFt.toFixed(1)} ft, modeled reduction {window.overhangReductionPct}%</title>
            </line>
          );
        }),
      )}

      {showVentilationArrows && energy?.arrows.map((arrow) => (
        <line
          key={`vent-${arrow.roomId}`}
          x1={arrow.from.x}
          y1={arrow.from.y}
          x2={arrow.to.x}
          y2={arrow.to.y}
          stroke={arrow.kind === "cross" ? "#2f7d78" : "#6d9e97"}
          strokeWidth="0.32"
          strokeDasharray={arrow.kind === "cross" ? undefined : "0.7 0.45"}
          markerEnd="url(#ventArrow)"
        >
          <title>{arrow.roomLabel}: estimated {arrow.kind} ventilation, {arrow.alignment} to prevailing wind</title>
        </line>
      ))}

      {/* outer walls */}
      <rect x={0} y={0} width={L} height={W} fill="none" stroke={WALL_STROKE} strokeWidth="0.45" />

      {/* entrance */}
      {entrance && <EntranceMarkSvg L={L} W={W} entrance={entrance} />}

      {/* structural overlay: beams (dashed) + columns (squares), status-held */}
      {structural && (
        <StructureOverlay
          structural={structural}
          L={L}
          W={W}
          activeMember={activeMember ?? null}
          onSelectMember={onSelectMember}
        />
      )}

      {/* dimensions + compass */}
      <DimensionLine axis="h" from={0} to={L} at={-1.7} label={`${input.length} ${input.unit}`} />
      <DimensionLine axis="v" from={0} to={W} at={-1.7} label={`${input.width} ${input.unit}`} />
      <NorthPointer L={L} padT={padT} />
    </svg>
  );
}

function RoomShape({ room, L, W }: { room: PlanRoom; L: number; W: number }) {
  const r = room.rect;
  const lines = fitLabel(room.label, r);
  const area = Math.round(r.w * r.h);
  const showArea = lines.parts.length * lines.fontSize * 1.2 + r.h / 2 < r.h && r.w > 6.5 && r.h > 4.2;

  return (
    <g>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={ROOM_FILL[room.type]} stroke={ROOM_STROKE} strokeWidth="0.1" opacity="0.92" />
      <WindowsSvg room={room} L={L} W={W} />
      <DoorsSvg room={room} />
      <g opacity="0.94">
        {lines.parts.map((line, i) => (
          <text
            key={`${room.id}-l${i}`}
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 - ((lines.parts.length - 1) * lines.fontSize * 1.2) / 2 + i * lines.fontSize * 1.2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={lines.fontSize}
            fill={INK}
          >
            {line}
          </text>
        ))}
        {showArea && (
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 + ((lines.parts.length + 0.6) * lines.fontSize * 1.2) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={lines.fontSize * 0.72}
            fill={INK}
            opacity="0.62"
          >
            {area} ft²
          </text>
        )}
      </g>
      {r.w < 3 && r.h < 3 && <title>{`${room.label} (${area} ft²)`}</title>}
    </g>
  );
}

/** Label lines + font size so text stays inside the room rectangle. */
function fitLabel(label: string, r: Rect): { parts: string[]; fontSize: number } {
  let fontSize = clamp(Math.min(r.w / 7, r.h / 3.4, 1.75), 0.55, 1.75);
  const charsPerLine = r.w / (fontSize * 0.56);
  let parts: string[] = [label];
  if (label.length > charsPerLine && label.includes(" ")) {
    const words = label.split(" ");
    const mid = Math.ceil(words.length / 2);
    parts = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")].filter(Boolean);
    const widest = Math.max(...parts.map((p) => p.length));
    if (widest > charsPerLine) {
      fontSize = clamp(fontSize * 0.8, 0.5, 1.75);
    }
  }
  return { parts, fontSize };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function DoorsSvg({ room }: { room: PlanRoom }) {
  return (
    <>
      {room.doors.map((door, i) => {
        const geo = doorGeometry(room.rect, door.wall, door.at, door.width);
        if (!geo) return null;
        return (
          <g key={`d-${i}`} stroke={TERRACOTTA} fill="none">
            <line x1={geo.ax} y1={geo.ay} x2={geo.bx} y2={geo.by} strokeWidth="0.09" />
            <path
              d={`M ${geo.bx} ${geo.by} A ${door.width} ${door.width} 0 0 ${geo.sweep} ${geo.cx} ${geo.cy}`}
              strokeWidth="0.04"
              strokeDasharray="0.28 0.18"
              opacity="0.8"
            />
          </g>
        );
      })}
    </>
  );
}

function WindowsSvg({ room, L, W }: { room: PlanRoom; L: number; W: number }) {
  return (
    <>
      {room.windows.map((win, i) => {
        const seg = windowSegment(room, win, L, W);
        if (!seg) return null;
        return (
          <g key={`w-${i}`} stroke={GOLD_DEEP} strokeWidth="0.07">
            <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} />
            <line
              x1={seg.x1 + seg.nx * 0.14}
              y1={seg.y1 + seg.ny * 0.14}
              x2={seg.x2 + seg.nx * 0.14}
              y2={seg.y2 + seg.ny * 0.14}
            />
          </g>
        );
      })}
    </>
  );
}

function windowSegment(
  room: PlanRoom,
  win: { wall: WallSide; at: number; width: number },
  L: number,
  W: number,
): { x1: number; y1: number; x2: number; y2: number; nx: number; ny: number } | null {
  const r = room.rect;
  const eps = 0.6;
  switch (win.wall) {
    case "N":
      if (Math.abs(r.y) > eps) return null;
      return { x1: r.x + win.at, y1: r.y, x2: r.x + win.at + win.width, y2: r.y, nx: 0, ny: -1 };
    case "S":
      if (Math.abs(r.y + r.h - W) > eps) return null;
      return { x1: r.x + win.at, y1: r.y + r.h, x2: r.x + win.at + win.width, y2: r.y + r.h, nx: 0, ny: 1 };
    case "E":
      if (Math.abs(r.x + r.w - L) > eps) return null;
      return { x1: r.x + r.w, y1: r.y + win.at, x2: r.x + r.w, y2: r.y + win.at + win.width, nx: 1, ny: 0 };
    case "W":
      if (Math.abs(r.x) > eps) return null;
      return { x1: r.x, y1: r.y + win.at, x2: r.x, y2: r.y + win.at + win.width, nx: -1, ny: 0 };
  }
}

interface DoorGeo {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  sweep: 0 | 1;
}

/**
 * Door geometry on a room edge. `at` is measured from the wall's
 * low-coordinate edge — the WEST end of N/S walls, the NORTH end of E/W
 * walls — matching the engine's door marks. The leaf swings inward.
 */
function doorGeometry(rect: Rect, wall: WallSide, at: number, width: number): DoorGeo | null {
  const x = rect.x;
  const y = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  switch (wall) {
    case "N":
      return { ax: x + at, ay: y, bx: x + at + width, by: y, cx: x + at, cy: y + width, sweep: 1 };
    case "S":
      return { ax: x + at, ay: y2, bx: x + at + width, by: y2, cx: x + at, cy: y2 - width, sweep: 1 };
    case "E":
      return { ax: x2, ay: y + at, bx: x2, by: y + at + width, cx: x2 - width, cy: y + at, sweep: 1 };
    case "W":
      return { ax: x, ay: y + at, bx: x, by: y + at + width, cx: x + width, cy: y + at, sweep: 0 };
  }
}

function EntranceMarkSvg({
  L,
  W,
  entrance,
}: {
  L: number;
  W: number;
  entrance: Layout["entrance"];
}) {
  const at = entrance.at;
  const w = entrance.width;
  const { wall } = entrance;
  const mid = at + w / 2;
  const segment = (() => {
    switch (wall) {
      case "N":
        return { x1: at, y1: 0, x2: at + w, y2: 0 };
      case "S":
        return { x1: at, y1: W, x2: at + w, y2: W };
      case "E":
        return { x1: L, y1: at, x2: L, y2: at + w };
      case "W":
        return { x1: 0, y1: at, x2: 0, y2: at + w };
    }
  })();
  const arrowTip = (() => {
    switch (wall) {
      case "N":
        return { x: mid, y: 0.15 };
      case "S":
        return { x: mid, y: W - 0.15 };
      case "E":
        return { x: L - 0.15, y: mid };
      case "W":
        return { x: 0.15, y: mid };
    }
  })();
  const labelPos = (() => {
    switch (wall) {
      case "N":
        return { x: mid + 0.6, y: -2.4 };
      case "S":
        return { x: mid + 0.6, y: W + 2.9 };
      case "E":
        return { x: L + 2.1, y: mid - 0.7 };
      case "W":
        return { x: -2.1, y: mid - 0.7 };
    }
  })();

  return (
    <g>
      <line
        x1={segment.x1}
        y1={segment.y1}
        x2={segment.x2}
        y2={segment.y2}
        stroke={GOLD}
        strokeWidth="0.55"
        strokeLinecap="round"
      />
      <line
        x1={entrance.arrowFrom.x}
        y1={entrance.arrowFrom.y}
        x2={arrowTip.x}
        y2={arrowTip.y}
        stroke={GOLD_DEEP}
        strokeWidth="0.16"
        markerEnd="url(#entryArrow)"
      />
      <text
        x={labelPos.x}
        y={labelPos.y}
        textAnchor="middle"
        fontSize="1.05"
        fill={GOLD_DEEP}
        fontWeight="600"
      >
        Main entrance
      </text>
    </g>
  );
}

function DimensionLine({
  axis,
  from,
  to,
  at,
  label,
}: {
  axis: "h" | "v";
  from: number;
  to: number;
  at: number;
  label: string;
}) {
  const mid = (from + to) / 2;
  if (axis === "h") {
    return (
      <g stroke={GOLD_DEEP} strokeWidth="0.08">
        <line x1={from} y1={at} x2={to} y2={at} markerStart="url(#dimTick)" markerEnd="url(#dimTick)" />
        <text x={mid} y={at - 0.55} textAnchor="middle" fontSize="1.05" fill={GOLD_DEEP} stroke="none" fontWeight="600">
          {label}
        </text>
      </g>
    );
  }
  return (
    <g stroke={GOLD_DEEP} strokeWidth="0.08">
      <line x1={at} y1={from} x2={at} y2={to} markerStart="url(#dimTick)" markerEnd="url(#dimTick)" />
      <text
        x={at - 0.55}
        y={mid}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="1.05"
        fill={GOLD_DEEP}
        stroke="none"
        fontWeight="600"
        transform={`rotate(-90 ${at - 0.55} ${mid})`}
      >
        {label}
      </text>
    </g>
  );
}

function NorthPointer({ L, padT }: { L: number; padT: number }) {
  const x = L - 0.9;
  const yTop = -(padT - 1.4);
  const yBottom = -1.1;
  return (
    <g>
      <line x1={x} y1={yBottom} x2={x} y2={yTop} stroke={GOLD_DEEP} strokeWidth="0.14" />
      <path d={`M ${x - 0.55} ${yTop + 1.15} L ${x} ${yTop} L ${x + 0.55} ${yTop + 1.15} L ${x} ${yTop + 0.85} Z`} fill={GOLD_DEEP} />
      <text x={x} y={yTop - 0.35} textAnchor="middle" fontSize="1.15" fontWeight="700" fill={GOLD_DEEP}>
        N
      </text>
    </g>
  );
}

function labelOf(facing: PlotInput["facing"]): string {
  const names: Record<PlotInput["facing"], string> = {
    N: "North",
    NE: "North-East",
    E: "East",
    SE: "South-East",
    S: "South",
    SW: "South-West",
    W: "West",
    NW: "North-West",
  };
  return names[facing];
}

/* ------------------------ structural overlay ------------------------ */

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass: "#2e7d51",
  amber: "#b08d3e",
  fail: "#a94e2a",
};

function StructureOverlay({
  structural,
  activeMember,
  onSelectMember,
}: {
  structural: StructuralResult;
  L: number;
  W: number;
  activeMember: string | null;
  onSelectMember?: (id: string | null) => void;
}) {
  const statusById = useMemo(() => {
    const map = new Map<string, CheckStatus>();
    for (const m of structural.members.panels) map.set(m.id, m.status);
    for (const m of structural.members.beams) map.set(m.id, m.status);
    for (const m of structural.members.columns) map.set(m.id, m.status);
    return map;
  }, [structural]);

  const pick = (id: string) => () => {
    if (!onSelectMember) return;
    onSelectMember(activeMember === id ? null : id);
  };

  return (
    <g>
      {/* beams */}
      {structural.plan.beams.map((b) => {
        const status = statusById.get(b.id) ?? "amber";
        const isActive = activeMember === b.id;
        const isY = b.axis === "y";
        const x1 = isY ? b.lineFt : b.startFt;
        const y1 = isY ? b.startFt : b.lineFt;
        const x2 = isY ? b.lineFt : b.endFt;
        const y2 = isY ? b.endFt : b.lineFt;
        return (
          <line
            key={b.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={STATUS_COLOR[status]}
            strokeWidth={isActive ? 0.42 : 0.18}
            strokeDasharray="0.65 0.4"
            strokeLinecap="round"
            opacity={isActive ? 1 : 0.85}
            className={onSelectMember ? "cursor-pointer" : undefined}
            onClick={pick(b.id)}
          >
            <title>{`${b.id} — ${(statusById.get(b.id) ?? "amber")}`}</title>
          </line>
        );
      })}

      {/* columns */}
      {structural.plan.columns.map((c) => {
        const status = statusById.get(c.id) ?? "amber";
        const isActive = activeMember === c.id;
        const size = 0.9;
        return (
          <rect
            key={c.id}
            x={c.xFt - size / 2}
            y={c.yFt - size / 2}
            width={size}
            height={size}
            fill={STATUS_COLOR[status]}
            stroke={INK}
            strokeWidth={isActive ? 0.16 : 0.08}
            opacity={isActive ? 1 : 0.9}
            className={onSelectMember ? "cursor-pointer" : undefined}
            onClick={pick(c.id)}
          >
            <title>{`${c.id} — ${(statusById.get(c.id) ?? "amber")} (${c.xFt.toFixed(1)}, ${c.yFt.toFixed(1)} ft)`}</title>
          </rect>
        );
      })}
      {/* legend */}
      <g>
        <text x={1.1} y={-0.4} fontSize={0.95} fill={INK} opacity={0.75}>
          columns/beams:
        </text>
        <rect x={9.2} y={-0.85} width={0.7} height={0.7} fill={STATUS_COLOR.pass} />
        <text x={10.1} y={-0.4} fontSize={0.9} fill={INK}>
          pass
        </text>
        <rect x={12.3} y={-0.85} width={0.7} height={0.7} fill={STATUS_COLOR.amber} />
        <text x={13.1} y={-0.4} fontSize={0.9} fill={INK}>
          amber
        </text>
        <rect x={15.9} y={-0.85} width={0.7} height={0.7} fill={STATUS_COLOR.fail} />
        <text x={16.8} y={-0.4} fontSize={0.9} fill={INK}>
          fail
        </text>
      </g>
    </g>
  );
}
