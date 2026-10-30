"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { cn } from "@/lib/utils";
import type { Layout } from "@/lib/engine/types";
import type { StructuralResult } from "@/lib/engine/structural/types";

/**
 * Model3D — extruded plan (translucent walls/room floors) plus the
 * structural model (slab panels, beams, columns, footings), status-coloured
 * from the engine run. Feet → metres (× 0.3048); no textures, small canvas
 * footprint for laptops. Clicking a slab panel / beam / column passes the
 * member id up (panel + column load-path highlight).
 */

const FT_TO_M = 0.3048;
const WALL_HEIGHT_M = 3.0; // structural.config.ts storey assumption
const SLAB_THK_M = 0.12;
const FOOTING_THK_M = 0.45;

const WALL_COLOR = "#d9c7a8";
const SLAB_COLOR = "#efe6d2";
const GROUND_COLOR = "#c9bda5";
const FOOTING_COLOR = "#8a7a63";

const ROOM_FILL: Record<string, string> = {
  living: "#f3ead9",
  kitchen: "#f2e2d0",
  dining: "#efe6d2",
  masterBedroom: "#ecdfca",
  bedroom: "#efe7d8",
  childrenBedroom: "#f1e9d9",
  pooja: "#f5ecca",
  toilet: "#e6e0d3",
  staircase: "#e2d3bd",
  store: "#e5ded1",
  parking: "#e3dccf",
  bathroom: "#e9e3d6",
  verandah: "#f6eeda",
};

const STATUS_COLOR = {
  pass: "#2e7d51",
  amber: "#b08d3e",
  fail: "#a94e2a",
} as const;
type Status = keyof typeof STATUS_COLOR;

function statusOf(structural: StructuralResult, id: string): Status {
  for (const m of structural.members.beams) if (m.id === id) return m.status as Status;
  for (const m of structural.members.columns) if (m.id === id) return m.status as Status;
  for (const m of structural.members.panels) if (m.id === id) return m.status as Status;
  return "amber";
}

interface Model3DProps {
  layout: Layout;
  structural: StructuralResult;
  activeMember?: string | null;
  onSelectMember?: (memberId: string) => void;
  className?: string;
}

export function Model3D({
  layout,
  structural,
  activeMember,
  onSelectMember,
  className,
}: Model3DProps) {
  const [showWalls, setShowWalls] = useState(true);

  const L = structural.plan.xLines[structural.plan.xLines.length - 1] ?? 30;
  const W = structural.plan.yLines[structural.plan.yLines.length - 1] ?? 20;
  const La = Math.max(L, W) * FT_TO_M;

  const pick = (id: string) => () => onSelectMember?.(id);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={showWalls}
            onChange={(e) => setShowWalls(e.target.checked)}
            className="h-3.5 w-3.5 accent-maroon-500"
          />
          Show walls
        </label>
        <span className="text-sm text-gold-600">
          Drag to orbit · click members to open their checks · structural
          colours light the load path for the selected column.
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-sm">
          <Dot color={STATUS_COLOR.pass} /> pass
          <Dot color={STATUS_COLOR.amber} /> amber
          <Dot color={STATUS_COLOR.fail} /> fail
        </span>
      </div>

      <div className="h-[420px] overflow-hidden rounded-lg border border-gold-500/40 bg-white/40">
        <Canvas camera={{ position: [La * 1.25, La * 1.1, La * 1.45], fov: 42, near: 0.1, far: 800 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[6, 12, 8]} intensity={0.7} />
          <Scene
            layout={layout}
            structural={structural}
            showWalls={showWalls}
            L={L}
            W={W}
            activeMember={activeMember ?? null}
            pickingEnabled={Boolean(onSelectMember)}
            onPick={pick}
          />
          <OrbitControls target={[0, 1.3, 0]} maxPolarAngle={Math.PI / 2.05} />
        </Canvas>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="ml-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;
}

/* scene ---------------------------------------------------------------- */

interface SceneProps {
  layout: Layout;
  structural: StructuralResult;
  showWalls: boolean;
  L: number;
  W: number;
  activeMember: string | null;
  pickingEnabled: boolean;
  onPick: (id: string) => () => void;
}

function Scene({ layout, structural, showWalls, L, W, activeMember, pickingEnabled, onPick }: SceneProps) {
  const loadPath = activeMember
    ? structural.loadPath.find((lp) => lp.columnId === activeMember) ?? null
    : null;
  return (
    <group>
      <GroundPlane L={L} W={W} />
      <RoomFloors layout={layout} L={L} W={W} />
      {showWalls && <RoomWalls layout={layout} L={L} W={W} />}
      <SlabPanels structural={structural} L={L} W={W} loadPath={loadPath} pickingEnabled={pickingEnabled} onPick={onPick} />
      <BeamsMesh structural={structural} L={L} W={W} loadPath={loadPath} pickingEnabled={pickingEnabled} onPick={onPick} />
      <ColumnsMesh structural={structural} L={L} W={W} activeMember={activeMember} pickingEnabled={pickingEnabled} onPick={onPick} />
    </group>
  );
}

function tx(ft: number, L: number): number {
  return (ft - L / 2) * FT_TO_M;
}
function tz(ft: number, W: number): number {
  return (ft - W / 2) * FT_TO_M;
}

function GroundPlane({ L, W }: { L: number; W: number }) {
  return (
    <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[L * FT_TO_M + 4, W * FT_TO_M + 4]} />
      <meshStandardMaterial color={GROUND_COLOR} />
    </mesh>
  );
}

function RoomFloors({ layout, L, W }: { layout: Layout; L: number; W: number }) {
  return (
    <group>
      {layout.rooms.map((room) => {
        const r = room.rect;
        return (
          <mesh
            key={`f-${room.id}`}
            position={[tx(r.x + r.w / 2, L), 0, tz(r.y + r.h / 2, W)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[r.w * FT_TO_M, r.h * FT_TO_M]} />
            <meshStandardMaterial color={ROOM_FILL[room.type] ?? SLAB_COLOR} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoomWalls({ layout, L, W }: { layout: Layout; L: number; W: number }) {
  return (
    <group>
      {layout.rooms.map((room) => {
        const r = room.rect;
        return (
          <mesh
            key={`w-${room.id}`}
            position={[tx(r.x + r.w / 2, L), WALL_HEIGHT_M / 2, tz(r.y + r.h / 2, W)]}
          >
            <boxGeometry args={[r.w * FT_TO_M, WALL_HEIGHT_M, r.h * FT_TO_M]} />
            <meshStandardMaterial color={WALL_COLOR} transparent opacity={0.38} />
          </mesh>
        );
      })}
    </group>
  );
}

function SlabPanels({
  structural,
  L,
  W,
  loadPath,
  pickingEnabled,
  onPick,
}: {
  structural: StructuralResult;
  L: number;
  W: number;
  loadPath: StructuralResult["loadPath"][number] | null;
  pickingEnabled: boolean;
  onPick: (id: string) => () => void;
}) {
  const { xLines, yLines, panels } = structural.plan;
  const slabY = WALL_HEIGHT_M + SLAB_THK_M / 2;
  return (
    <group>
      {panels.map((p) => {
        if (p.i + 1 >= xLines.length || p.j + 1 >= yLines.length) return null;
        const w = xLines[p.i + 1] - xLines[p.i];
        const h = yLines[p.j + 1] - yLines[p.j];
        if (w <= 0 || h <= 0) return null;
        const cx = tx(xLines[p.i] + w / 2, L);
        const cz = tz(yLines[p.j] + h / 2, W);
        const inPath = loadPath ? loadPath.slabs.includes(p.id) : false;
        return (
          <mesh
            key={p.id}
            position={[cx, slabY, cz]}
            rotation={[Math.PI / 2, 0, 0]}
            onClick={pickingEnabled ? onPick(p.id) : undefined}
          >
            <boxGeometry args={[w * FT_TO_M, SLAB_THK_M, h * FT_TO_M]} />
            <meshStandardMaterial
              color={inPath ? STATUS_COLOR.pass : SLAB_COLOR}
              transparent
              opacity={inPath ? 1 : 0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function BeamsMesh({
  structural,
  L,
  W,
  loadPath,
  pickingEnabled,
  onPick,
}: {
  structural: StructuralResult;
  L: number;
  W: number;
  loadPath: StructuralResult["loadPath"][number] | null;
  pickingEnabled: boolean;
  onPick: (id: string) => () => void;
}) {
  const beamsMap = new Map(structural.members.beams.map((m) => [m.id, m]));
  return (
    <group>
      {structural.plan.beams.map((b) => {
        const member = beamsMap.get(b.id);
        if (!member) return null;
        const len = (b.endFt - b.startFt) * FT_TO_M;
        if (len <= 0) return null;
        const depth = member.member.depthMm / 1000;
        const y = WALL_HEIGHT_M - depth / 2;
        const isX = b.axis === "x";
        const cx = isX
          ? tx(b.startFt + (b.endFt - b.startFt) / 2, L)
          : tx(b.lineFt, L);
        const cz = isX
          ? tz(b.lineFt, W)
          : tz(b.startFt + (b.endFt - b.startFt) / 2, W);
        const inPath = loadPath ? loadPath.beams.includes(b.id) : false;
        const status = statusOf(structural, b.id);
        return (
          <mesh
            key={b.id}
            position={[cx, y, cz]}
            onClick={pickingEnabled ? onPick(b.id) : undefined}
          >
            <boxGeometry
              args={[isX ? len : 0.23, depth, isX ? 0.23 : len]}
            />
            <meshStandardMaterial color={inPath ? "#5e1b26" : STATUS_COLOR[status]} />
          </mesh>
        );
      })}
    </group>
  );
}

function ColumnsMesh({
  structural,
  L,
  W,
  activeMember,
  pickingEnabled,
  onPick,
}: {
  structural: StructuralResult;
  L: number;
  W: number;
  activeMember: string | null;
  pickingEnabled: boolean;
  onPick: (id: string) => () => void;
}) {
  const columnsMap = new Map(structural.members.columns.map((m) => [m.id, m]));
  const footingMap = new Map(
    structural.foundation.footings.map((f) => [f.columnId, f]),
  );
  return (
    <group>
      {structural.plan.columns.map((c) => {
        const m = columnsMap.get(c.id);
        if (!m) return null;
        const width = m.member.sizeMm[0] / 1000;
        const status = statusOf(structural, c.id);
        const footing = footingMap.get(c.id)?.sizeM ?? 1.2;
        const isClicked = activeMember === c.id;
        return (
          <group key={c.id}>
            <mesh
              position={[tx(c.xFt, L), WALL_HEIGHT_M / 2, tz(c.yFt, W)]}
              onClick={pickingEnabled ? onPick(c.id) : undefined}
            >
              <boxGeometry args={[width, WALL_HEIGHT_M, width]} />
              <meshStandardMaterial color={isClicked ? "#5e1b26" : STATUS_COLOR[status]} />
            </mesh>
            <mesh
              position={[tx(c.xFt, L), -FOOTING_THK_M / 2 - 0.04, tz(c.yFt, W)]}
              onClick={pickingEnabled ? onPick(c.id) : undefined}
            >
              <boxGeometry args={[footing, FOOTING_THK_M, footing]} />
              <meshStandardMaterial color={FOOTING_COLOR} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
