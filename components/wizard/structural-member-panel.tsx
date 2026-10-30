"use client";

import type {
  CheckStatus,
  StructuralBeamMember,
  StructuralColumnMember,
  StructuralPanelMember,
  StructuralResult,
} from "@/lib/engine/structural/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UnverifiedBadge } from "./unverified-badge";

/**
 * Side panel for a clicked structural member (beam/column/panel id from the
 * plan overlay or the 3D model): its checks, demand vs capacity, clause
 * citations, unverified flags and any autofix steps applied to it.
 */

const STATUS_BADGE: Record<CheckStatus, string> = {
  pass: "bg-emerald-700/90 text-white",
  amber: "bg-amber-600 text-white",
  fail: "bg-terracotta-600 text-white",
};

const STATUS_WORD: Record<CheckStatus, string> = {
  pass: "Pass",
  amber: "Amber",
  fail: "Fails",
};

export function MemberPanel({
  structural,
  memberId,
  onClose,
}: {
  structural: StructuralResult;
  memberId: string | null;
  onClose?: () => void;
}) {
  if (!memberId) return null;
  const panel = structural.members.panels.find((m) => m.id === memberId);
  const beam = structural.members.beams.find((m) => m.id === memberId);
  const col = structural.members.columns.find((m) => m.id === memberId);
  const member:
    | StructuralPanelMember
    | StructuralBeamMember
    | StructuralColumnMember
    | undefined = panel ?? beam ?? col;
  if (!member) {
    return (
      <div className="rounded-md border border-gold-500/40 bg-card/70 p-3 text-xs text-muted-foreground">
        Member {memberId} not found in the structural run.
      </div>
    );
  }

  const type = panel ? "slab panel" : beam ? "beam" : "column";
  const headline = describeMember(memberId, panel, beam, col);

  const fixes = structural.autoFixLog.filter((l) => l.member === memberId);

  return (
    <aside className="rounded-md border border-gold-500/40 bg-card/85 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-sm text-maroon-500">{memberId}</p>
          <p className="text-[11px] text-muted-foreground">{headline} · {type}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("px-1.5 py-0 text-[10px]", STATUS_BADGE[member.status])}>
            {STATUS_WORD[member.status]}
          </Badge>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              close
            </button>
          )}
        </div>
      </div>

      <ul className="mt-2 space-y-1.5">
        {member.checks.map((c) => (
          <li key={c.id} className="rounded border border-gold-500/25 bg-sand-50/70 px-2 py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-ink">{c.label}</span>
              <div className="flex items-center gap-1.5">
                {!c.verified && <UnverifiedBadge label="unverified" />}
                <Badge variant="outline" className="px-1 py-0 text-[9px] text-gold-600">
                  {c.clause}
                </Badge>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[10px] text-ink/80">{c.demand}</span>
              <span className="text-[10px] text-muted-foreground">vs</span>
              <span className="font-mono text-[10px] text-ink/80">{c.capacity}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                util {c.util.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gold-500/15">
              <div
                className={cn(
                  "h-full rounded-full",
                  c.status === "pass" && "bg-emerald-700",
                  c.status === "amber" && "bg-amber-500",
                  c.status === "fail" && "bg-terracotta-600",
                )}
                style={{ width: `${Math.min(100, c.util * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{c.reason}</p>
          </li>
        ))}
      </ul>

      {fixes.length > 0 && (
        <div className="mt-2 rounded border border-gold-500/30 bg-amber-500/10 p-2">
          <p className="text-[11px] font-medium text-maroon-500">Auto-fix applied</p>
          <ul className="mt-1 space-y-0.5">
            {fixes.map((f, i) => (
              <li key={i} className="font-mono text-[10px] text-ink/80">
                {f.before} → {f.after} · {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function describeMember(
  id: string,
  panel?: StructuralPanelMember,
  beam?: StructuralBeamMember,
  col?: StructuralColumnMember,
): string {
  if (panel) {
    const m = panel.member;
    return `${m.twoWay ? "two-way" : "one-way"} · ${m.lx.toFixed(2)}×${m.ly.toFixed(2)} m · t=${m.thicknessMm} mm`;
  }
  if (beam) {
    const b = beam.member;
    return `${b.widthMm}×${b.depthMm} mm · span ${b.spanM.toFixed(2)} m · ${b.bars.count}⌀${b.bars.dia}`;
  }
  if (col) {
    return `${col.member.sizeMm[0]}×${col.member.sizeMm[1]} mm · Pu ${col.member.pu.toFixed(0)} kN · ${col.member.bars.count}⌀${col.member.bars.dia}`;
  }
  return id;
}
