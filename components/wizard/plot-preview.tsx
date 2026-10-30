import type { PlotInput } from "@/lib/engine/types";

const VB_W = 340;
const VB_H = 240;
const MARGIN = 42;

/** Which plot edges touch a road for the given facing (diagonals get two). */
const ROAD_EDGES: Record<PlotInput["facing"], ("top" | "right" | "bottom" | "left")[]> = {
  N: ["top"],
  NE: ["top", "right"],
  E: ["right"],
  SE: ["right", "bottom"],
  S: ["bottom"],
  SW: ["bottom", "left"],
  W: ["left"],
  NW: ["left", "top"],
};

/**
 * Live to-scale plot drawing: rectangle proportional to the entered
 * dimensions, a fixed north-up compass, and road markers on the facing
 * side(s). Pure SVG so it re-renders as inputs change.
 *
 * AXIS CONVENTION (this is the one used across the engine):
 * the plot is drawn NORTH-UP, so the horizontal screen axis — `length` —
 * runs EAST-WEST, and the vertical screen axis — `width` — runs
 * NORTH-SOUTH (this is the dimension the north arrow points along, with
 * y increasing toward the south). Either side may be the longer one;
 * nothing here or in the engine assumes length >= width.
 */
export function PlotPreview({ input }: { input: PlotInput }) {
  const length = input.length;
  const width = input.width;

  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-gold-500/40 bg-sand-50/60 p-6 text-center text-sm text-muted-foreground">
        Enter plot dimensions to see the to-scale preview.
      </div>
    );
  }

  const scale = Math.min(
    (VB_W - 2 * MARGIN) / length,
    (VB_H - 2 * MARGIN) / width,
  );
  const rectW = length * scale;
  const rectH = width * scale;
  const x = (VB_W - rectW) / 2;
  const y = (VB_H - rectH) / 2;
  const band = 9;

  const edges = ROAD_EDGES[input.facing];
  const bandRect = (edge: "top" | "right" | "bottom" | "left") => {
    switch (edge) {
      case "top":
        return { x, y: y - band - 2, w: rectW, h: band, label: rectW > 60 };
      case "bottom":
        return { x, y: y + rectH + 2, w: rectW, h: band, label: rectW > 60 };
      case "left":
        return { x: x - band - 2, y, w: band, h: rectH, label: rectH > 60 };
      case "right":
        return { x: x + rectW + 2, y, w: band, h: rectH, label: rectH > 60 };
    }
  };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`To-scale preview of a ${length} × ${width} ${input.unit} plot with the road on the ${input.facing} side`}
      className="h-44 w-full rounded-lg border border-gold-500/30 bg-sand-50/60 md:h-52"
    >
      <defs>
        <pattern id="roadHatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#c4643b" opacity="0.85" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#5e1b26" strokeWidth="1.4" opacity="0.35" />
        </pattern>
      </defs>

      {edges.map((edge) => {
        const r = bandRect(edge);
        return (
          <rect
            key={edge}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="2"
            fill="url(#roadHatch)"
            stroke="#a94e2a"
            strokeWidth="1"
          />
        );
      })}
      {bandRect(edges[0]).label && (
        <text
          x={
            edges[0] === "left" ? bandRect(edges[0]).x + band / 2 + 2 : bandRect(edges[0]).x + bandRect(edges[0]).w / 2
          }
          y={
            edges[0] === "top" ? bandRect(edges[0]).y + band / 2 + 3 :
            edges[0] === "bottom" ? bandRect(edges[0]).y + band / 2 + 3 :
            bandRect(edges[0]).y + bandRect(edges[0]).h / 2 + 3
          }
          textAnchor={edges[0] === "left" || edges[0] === "right" ? undefined : "middle"}
          className="fill-[#4a141d] text-[8px] font-semibold uppercase tracking-widest"
        >
          Road
        </text>
      )}

      <rect
        x={x}
        y={y}
        width={rectW}
        height={rectH}
        fill="#faf6ec"
        stroke="#5e1b26"
        strokeWidth="1.6"
      />
      <rect
        x={x + 5}
        y={y + 5}
        width={Math.max(0, rectW - 10)}
        height={Math.max(0, rectH - 10)}
        fill="none"
        stroke="#b08d3e"
        strokeWidth="0.8"
        strokeDasharray="4 3"
        opacity="0.7"
      />

      <g transform={`translate(${x + rectW / 2}, ${y + rectH / 2})`}>
        <text textAnchor="middle" className="fill-[#5e1b26] text-[11px] font-semibold" y="4">
          {`${length} ${input.unit}`}
        </text>
      </g>

      <text
        x={VB_W / 2}
        y={VB_H - 8}
        textAnchor="middle"
        className="fill-[#8f7024] text-[10px] font-semibold"
      >
        {length} × {width} {input.unit} · facing {input.facing}
      </text>

      <g aria-hidden transform="translate(26, 30)">
        <circle r="13" fill="#faf6ec" stroke="#b08d3e" strokeWidth="1" />
        <path d="M 0 -9 L 3.2 2 L 0 0 L -3.2 2 Z" fill="#5e1b26" />
        <line x1="0" y1="2" x2="0" y2="8" stroke="#5e1b26" strokeWidth="1" />
        <text textAnchor="middle" y="-10.5" className="fill-[#5e1b26] text-[7px] font-bold">
          N
        </text>
      </g>
    </svg>
  );
}
