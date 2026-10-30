"use client";

import type {
  StructuralResult,
} from "@/lib/engine/structural/types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { UnverifiedBadge, UNVERIFIED_TOOLTIP } from "./unverified-badge";

/**
 * The full structural report for one layout: summary vs pre-autofix state,
 * checks grouped by member, load path, autofix log, foundation + seismic
 * notes, the assumption ledger and the mandatory engineering disclaimer.
 */

const DISCLAIMER =
  "Preliminary design. Must be verified by a licensed structural engineer.";

export function StructuralReport({
  structural,
  className,
}: {
  structural: StructuralResult;
  className?: string;
}) {
  const s = structural;
  const beamCount = s.members.beams.length;
  const colCount = s.members.columns.length;
  const panelCount = s.members.panels.length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* summary */}
      <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base text-maroon-500">Structural preview — IS 456:2000</h3>
          <Badge className="bg-ink/85 px-1.5 py-0 text-sm text-sand-50">
            {s.summary.pass} pass · {s.summary.amber} amber · {s.summary.fail} fail (of {s.summary.total} checks)
          </Badge>
          {s.initialSummary && s.summary.fail === 0 && (
            <Badge variant="outline" className="px-1.5 py-0 text-sm text-gold-600">
              autofixed from {s.initialSummary.fail} failing
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {panelCount} slab panels · {beamCount} beams · {colCount} columns ·{" "}
          {s.foundation.footings.length} footing estimates · {s.plan.levels === 2 ? "two structural levels (notional first floor note)" : "single level"}
        </p>
        {s.summary.fail === 0 && s.summary.amber > 0 && (
          <p className="mt-1 text-sm text-amber-700">
            Everything auto-fixed to code within engine limits; {s.summary.amber} items stay amber — they need engineering judgement (bi-axial column design), not size changes.
          </p>
        )}
      </div>

      {/* member checks */}
      <GroupedChecks structural={s} />

      {/* autofix log */}
      {s.autoFixLog.length > 0 && (
        <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
          <h4 className="font-display text-base text-maroon-500">Auto-fix ladder ({s.autoFixLog.length} steps)</h4>
          <div className="mt-2 max-h-64 overflow-y-auto pr-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7">Member</TableHead>
                  <TableHead className="h-7">Before</TableHead>
                  <TableHead className="h-7">After</TableHead>
                  <TableHead className="h-7">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.autoFixLog.map((f, i) => (
                  <TableRow key={`${f.member}-${i}`}>
                    <TableCell className="py-1.5 font-mono text-sm">{f.member}</TableCell>
                    <TableCell className="py-1.5 font-mono text-sm text-ink/80">{f.before}</TableCell>
                    <TableCell className="py-1.5 font-mono text-sm text-emerald-800">{f.after}</TableCell>
                    <TableCell className="py-1.5 text-sm text-muted-foreground">{f.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* load path + forced spans */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
          <h4 className="font-display text-base text-maroon-500">Load path</h4>
          <p className="mt-1 text-sm text-muted-foreground">{s.loadPathNote}</p>
          <p className="mt-2 text-sm text-ink/85">
            Example: {s.loadPath[0]?.columnId} ← {s.loadPath[0]?.beams.length} beam end shears
            from {s.loadPath[0]?.slabs.length} surrounding slabs → footing {s.loadPath[0]?.footing}.
          </p>
        </div>
        {s.forcedSpans.length > 0 && (
          <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
            <h4 className="font-display text-base text-maroon-500">Forced spans (Brahmasthan)</h4>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {s.forcedSpans.map((sp, i) => (
                <li key={i}>
                  {sp.note}
                  {sp.exceeds45m && (
                    <Badge className="ml-1 bg-terracotta-600 px-1 py-0 text-sm text-white">
                      &gt; 4.5 m — engineer review
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* foundation */}
      <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-base text-maroon-500">Foundation estimates</h4>
          <UnverifiedBadge label={`SBC ${s.foundation.sbcKPa} kPa assumed`} tooltip={`${UNVERIFIED_TOOLTIP} Bearing 150 kN/m² is an assumed value; footings follow service load / SBC; punching/one-way shear NOT checked.`} />
        </div>
        <div className="mt-2 max-h-60 overflow-y-auto pr-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7">Footing</TableHead>
                <TableHead className="h-7">Column</TableHead>
                <TableHead className="h-7">Size</TableHead>
                <TableHead className="h-7 text-right">Service load</TableHead>
                <TableHead className="h-7 text-right">Bearing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.foundation.footings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="py-1.5 font-mono text-sm">{f.id}</TableCell>
                  <TableCell className="py-1.5 font-mono text-sm">{f.columnId}</TableCell>
                  <TableCell className="py-1.5 text-sm">{f.sizeM.toFixed(1)} × {f.sizeM.toFixed(1)} m</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-sm">{(f.bearing * f.areaM2).toFixed(0)} kN</TableCell>
                  <TableCell className="py-1.5 text-right font-mono text-sm">{f.bearing.toFixed(0)} kN/m²</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{s.foundation.note}</p>
      </div>

      {/* seismic */}
      <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-base text-maroon-500">Seismic advisory · {s.seismic.label}</h4>
          <UnverifiedBadge label="city seismic data unverified" tooltip={`${UNVERIFIED_TOOLTIP} Zone mapping comes from cities.ts (verified: false).`} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{s.seismic.note}</p>
      </div>

      {/* assumptions */}
      <div className="rounded-lg border border-dashed border-gold-500/40 bg-card/50 p-4">
        <h4 className="font-display text-base text-maroon-500">Assumption ledger</h4>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {s.assumptions.map((a) => (
            <li key={a.id} className="rounded border border-gold-500/25 bg-sand-50/60 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{a.label}</span>
                {!a.verified && <UnverifiedBadge label="needs check" />}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {a.value} — {a.source}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* disclaimer */}
      <p className="rounded-md border border-terracotta-500/40 bg-terracotta-500/5 px-3 py-2 text-sm font-medium text-maroon-600">
        {DISCLAIMER}
      </p>
    </div>
  );
}

function GroupedChecks({ structural }: { structural: StructuralResult }) {
  return (
    <>
      <ChecksGroup title={`Beams (${structural.members.beams.length})`} members={structural.members.beams.map((m) => ({ id: m.id, size: `${m.member.widthMm}×${m.member.depthMm} mm · ${m.member.bars.count}⌀${m.member.bars.dia}`, status: m.status, checks: m.checks }))} />
      <ChecksGroup title={`Columns (${structural.members.columns.length})`} members={structural.members.columns.map((m) => ({ id: m.id, size: `${m.member.sizeMm[0]}×${m.member.sizeMm[1]} mm · ${m.member.bars.count}⌀${m.member.bars.dia} · Pu ${m.member.pu.toFixed(0)} kN`, status: m.status, checks: m.checks }))} />
      <ChecksGroup title={`Slab panels (${structural.members.panels.length})`} members={structural.members.panels.map((m) => ({ id: m.id, size: `${m.member.twoWay ? "two-way" : "one-way"} · t=${m.member.thicknessMm} mm · ${m.member.lx.toFixed(2)}×${m.member.ly.toFixed(2)} m`, status: m.status, checks: m.checks }))} />
    </>
  );
}

function ChecksGroup({
  title,
  members,
}: {
  title: string;
  members: {
    id: string;
    size: string;
    status: "pass" | "amber" | "fail";
    checks: StructuralResult["members"]["beams"][number]["checks"];
  }[];
}) {
  if (members.length === 0) return null;
  return (
    <div className="rounded-lg border border-gold-500/30 bg-card/60 p-4">
      <h4 className="font-display text-base text-maroon-500">{title}</h4>
      <div className="mt-2 max-h-72 overflow-y-auto pr-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-7">Member</TableHead>
              <TableHead className="h-7">Check</TableHead>
              <TableHead className="h-7">Demand / capacity</TableHead>
              <TableHead className="h-7">Clause</TableHead>
              <TableHead className="h-7 text-right">Util</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} className="align-top">
                <TableCell className="py-1.5">
                  <p className="font-mono text-sm text-ink">{m.id}</p>
                  <p className="text-sm text-muted-foreground">{m.size}</p>
                  <Badge className={cn("mt-1 px-1 py-0 text-sm", m.status === "pass" && "bg-emerald-700 text-white", m.status === "amber" && "bg-amber-800 text-white", m.status === "fail" && "bg-terracotta-600 text-white")}>
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell className="py-1.5">
                  <ul className="space-y-1">
                    {m.checks.map((c) => (
                      <li key={c.id} className="text-sm text-ink/90">
                        {c.label}
                        {!c.verified && <UnverifiedBadge label="*" />}
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell className="py-1.5">
                  <ul className="space-y-1 font-mono text-sm text-ink/80">
                    {m.checks.map((c) => (
                      <li key={c.id}>{c.demand} ⇄ {c.capacity}</li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell className="py-1.5">
                  <ul className="space-y-1 text-sm text-gold-600">
                    {m.checks.map((c) => (
                      <li key={c.id}>{c.clause}</li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell className="py-1.5">
                  <ul className="space-y-1">
                    {m.checks.map((c) => (
                      <li key={c.id} className={cn("text-right font-mono text-sm", c.status === "pass" && "text-emerald-800", c.status === "amber" && "text-amber-700", c.status === "fail" && "text-terracotta-700")}>
                        {c.util.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

