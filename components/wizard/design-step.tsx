"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CircleDashed, Download, Info, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { generateLayouts } from "@/lib/engine/generateLayouts";
import { runStructural } from "@/lib/engine/structural";
import type { StructuralResult } from "@/lib/engine/structural/types";
import { scoreVastu } from "@/lib/engine/scoreVastu";
import { analyzeEnergy, buildBaselineLayout, scoreEnergy } from "@/lib/engine/energy";
import type { EnergyResult, Season } from "@/lib/engine/energy/types";
import type { Layout, LayoutMode, Strictness, VastuResult } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { PlanView } from "./plan-view";
import { isPlotFormValid, validatePlotInput } from "./plot-validation";
import { useWizardStore } from "./store";
import { MemberPanel } from "./structural-member-panel";
import { StructuralReport } from "./structural-report";
import { UnverifiedBadge, UNVERIFIED_TOOLTIP } from "./unverified-badge";
import { BalanceDashboard } from "./energy/balance-dashboard";
import { BeforeAfterCard } from "./energy/before-after-card";
import { EnergyScoreCard } from "./energy/energy-card";
import { EstimatedBadge } from "./energy/estimated-badge";
import { SolarRainCards } from "./energy/solar-rain-cards";
import { AssumptionsPanel } from "./energy/assumptions-panel";
import { SeasonSwitch, SunPathPanel } from "./energy/sun-path-panel";
import { TradeoffExplainer } from "./energy/tradeoff-explainer";
import { buildDxf } from "@/lib/export/dxf";
import { computeVastuGrid } from "@/lib/engine/vastuGrid";
import { formatProgrammeCoverage, getProgrammeCoverage } from "@/lib/export/programmeCoverage";

const Model3D = dynamic(
  () => import("./model-3d").then((m) => m.Model3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-gold-500/40 bg-sand-50/70 text-sm text-muted-foreground">
        Loading the 3D model…
      </div>
    ),
  },
);

/**
 * DesignStep (step 3 in the UI, id 2): layout controls, a three-way balance,
 * plan and score review, followed by energy and structural detail.
 */

const STRICTNESS_ORDER: Strictness[] = ["strict", "balanced", "flexible"];

const STRICTNESS_HINTS: Record<Strictness, string> = {
  strict: "Rooms stay inside their preferred zones wherever possible.",
  balanced: "Preferred zones first, acceptable zones as fallback.",
  flexible: "Let rooms go anywhere the footprint allows; vastu is advisory.",
};

const STATUS_STYLE: Record<"ideal" | "acceptable" | "poor", string> = {
  ideal: "border-transparent bg-emerald-700/90 text-white",
  acceptable: "border-transparent bg-amber-800 text-white",
  poor: "border-transparent bg-terracotta-600 text-white",
};

export function DesignStep() {
  const input = useWizardStore((s) => s.input);
  const [strictness, setStrictness] = useState<Strictness>("balanced");
  const [mode, setMode] = useState<LayoutMode>("balanced");
  const [showPadas, setShowPadas] = useState(false);
  const [showStructure, setShowStructure] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [activeMember, setActiveMember] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showDaylightHeatmap, setShowDaylightHeatmap] = useState(false);
  const [showVentilationArrows, setShowVentilationArrows] = useState(false);
  const [showSunShading, setShowSunShading] = useState(false);
  const [season, setSeason] = useState<Season>("summer");

  const errors = useMemo(() => validatePlotInput(input), [input]);

  const layoutsResult = useMemo(() => {
    if (!isPlotFormValid(errors)) return null;
    try {
      return generateLayouts(input, strictness);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unexpected layout error.",
      };
    }
  }, [input, errors, strictness]);

  const layouts = useMemo(
    () => (Array.isArray(layoutsResult) ? layoutsResult.filter(Boolean) : []),
    [layoutsResult],
  );
  const vastuByLayout = useMemo(
    () => new Map(layouts.map((layout) => [layout.id, scoreVastu(layout, input)])),
    [layouts, input],
  );
  const structuralByLayout = useMemo(() => {
    const results = new Map<string, StructuralResult | null>();
    for (const layout of layouts) {
      try {
        results.set(layout.id, runStructural(input, layout));
      } catch {
        results.set(layout.id, null);
      }
    }
    return results;
  }, [layouts, input]);
  const energyState = useMemo(() => {
    const results = new Map<string, EnergyResult>();
    const errors = new Map<string, string>();
    if (layouts.length === 0) return { results, errors, baseline: null, baselineStructural: null };

    let baseline: EnergyResult | null = null;
    let baselineStructural: StructuralResult | null = null;
    try {
      const reference = layouts[0];
      const baselineLayout = buildBaselineLayout(input, reference);
      const baselineAnalysis = analyzeEnergy(input, baselineLayout, { baseline: true });
      baseline = scoreEnergy(baselineAnalysis, baselineAnalysis);
      try {
        baselineStructural = runStructural(input, baselineLayout);
      } catch {
        baselineStructural = null;
      }
      for (const layout of layouts) {
        try {
          results.set(layout.id, scoreEnergy(analyzeEnergy(input, layout), baselineAnalysis));
        } catch (error) {
          errors.set(layout.id, error instanceof Error ? error.message : "Energy analysis failed for this layout.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Energy analysis could not be prepared for this plot.";
      for (const layout of layouts) errors.set(layout.id, message);
    }
    return { results, errors, baseline, baselineStructural };
  }, [input, layouts]);

  const selectedLayout = layouts.find((layout) => layout.id === mode) ?? layouts[0] ?? null;
  const selectedStructural = selectedLayout ? structuralByLayout.get(selectedLayout.id) ?? null : null;

  /* keep a stale-selected member when switching layouts, but only clear to
     something that actually exists: */
  const memberToUse = useMemo(() => {
    if (!selectedStructural || !activeMember) return null;
    const exists = [
      selectedStructural.members.beams.some((m) => m.id === activeMember),
      selectedStructural.members.columns.some((m) => m.id === activeMember),
      selectedStructural.members.panels.some((m) => m.id === activeMember),
    ].some(Boolean);
    return exists ? activeMember : null;
  }, [selectedStructural, activeMember]);

  if (!isPlotFormValid(errors)) {
    return (
      <DesignEmpty
        title="Design engine needs complete plot inputs"
        message="Finish the Inputs step — dimensions, unit, city and bedrooms are required before layouts can be generated."
      />
    );
  }

  if (!layoutsResult) {
    return (
      <DesignEmpty
        title="No layouts generated"
        message="The engine did not run for this input — adjust the strictness slider or check the Inputs step."
        error
      />
    );
  }

  if ("error" in layoutsResult) {
    return <DesignEmpty title="The layout engine failed" message={layoutsResult.error} error />;
  }

  const current = selectedLayout;
  const structural = current ? structuralByLayout.get(current.id) ?? null : null;
  const energyReady = layouts.length > 0 && energyState.results.size === layouts.length;
  const layoutScore = current ? vastuByLayout.get(current.id) ?? null : null;

  const handleExportDxf = () => {
    if (!current || !structural || !layoutScore) return;
    const dxf = buildDxf({
      plot: input,
      layout: current,
      structural,
      vastuGrid: computeVastuGrid(input).cells,
      projectName: `${input.bedrooms}BHK ${input.city}`,
      vastuScore: layoutScore.score100,
      date: new Date().toISOString().slice(0, 10),
    });
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const lengthFt = input.unit === "ft" ? input.length : input.length / 0.3048;
    const widthFt = input.unit === "ft" ? input.width : input.width / 0.3048;
    anchor.href = url;
    anchor.download = `vastushilpa-${current.id}-${lengthFt}x${widthFt}ft.dxf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs value={current.id} onValueChange={(v) => setMode(v as LayoutMode)} className="w-full min-w-0">
      <div className="grid min-w-0 gap-3">
        <div className="min-w-0 space-y-1.5">
          <span className="font-display text-sm text-maroon-500">Layout</span>
          <TabsList aria-label="Layout options" className="flex h-auto w-full flex-nowrap justify-stretch gap-1">
            {layouts.map((layout) => (
              <TabsTrigger
                key={layout.id}
                value={layout.id}
                aria-label={layout.name}
                className="min-w-0 flex-1 whitespace-nowrap px-2 text-xs sm:text-sm data-[state=active]:text-maroon-500"
              >
                {layout.id === "vastu-first" ? "Vastu-first" : layout.id === "energy-first" ? "Energy-first" : "Balanced"}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,1fr)] lg:items-stretch">
        <div className="min-w-0 space-y-2 rounded-lg border border-gold-500/30 bg-sand-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-gold-600" aria-hidden />
            <span className="font-display text-sm text-maroon-500">Zone strictness</span>
            <Badge variant="outline" className="border-gold-500/60 text-sm capitalize text-gold-600">
              {strictness}
            </Badge>
          </div>
          <Slider
            aria-label="Zone strictness: strict, balanced or flexible"
            aria-valuetext={strictness}
            min={0}
            max={2}
            step={1}
            value={[STRICTNESS_ORDER.indexOf(strictness)]}
            onValueChange={([idx]) => setStrictness(STRICTNESS_ORDER[idx] ?? "balanced")}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">{STRICTNESS_HINTS[strictness]}</p>
        </div>

        <div className="min-w-0 space-y-1">
          <button
            type="button"
            disabled={!current || !structural || !layoutScore}
            title={!current || !structural ? "Generate a layout and structural plan before exporting." : "Export this layout as a DXF drawing."}
            onClick={handleExportDxf}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gold-500/50 bg-white px-3 py-2 text-sm font-medium text-maroon-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export DXF
          </button>
          <p className="text-center text-sm text-muted-foreground">Opens in AutoCAD, LibreCAD, DraftSight</p>
        </div>
        </div>
      </div>

      {layouts.map((layout) => {
        const layoutScore = vastuByLayout.get(layout.id)!;
        const coverage = getProgrammeCoverage(input, layout);
        const layoutEnergy = energyState.results.get(layout.id) ?? null;
        const layoutStructural = structuralByLayout.get(layout.id) ?? null;

        return (
          <TabsContent key={layout.id} value={layout.id} className="space-y-4 focus-visible:outline-none">
            <ProgrammeCoverageStrip coverage={coverage} />

            <section aria-label="Three-way layout balance" className="space-y-3">
              {energyReady ? (
                <BalanceDashboard
                  layouts={layouts}
                  vastu={vastuByLayout}
                  energy={energyState.results}
                  structural={structuralByLayout}
                  activeMode={current?.id ?? mode}
                  onSelect={setMode}
                />
              ) : (
                <EnergyStatusCard
                  title={layouts.length === 0 ? "Energy comparison is waiting" : "Energy comparison unavailable"}
                  message={layouts.length === 0
                    ? "Generate a valid layout to compare estimated energy scores."
                    : Array.from(energyState.errors.values())[0] ?? "Energy results are not available for every layout."}
                  error={layouts.length > 0}
                />
              )}
              <div className="grid gap-2 lg:grid-cols-3">
                {layouts.map((summaryLayout) => {
                  const result = structuralByLayout.get(summaryLayout.id);
                  const total = result
                    ? result.members.panels.length + result.members.beams.length + result.members.columns.length
                    : 0;
                  const pass = result
                    ? [...result.members.panels, ...result.members.beams, ...result.members.columns]
                        .filter((member) => member.status === "pass").length
                    : 0;
                  return (
                    <div key={summaryLayout.id} className="rounded-md border border-gold-500/25 bg-card/60 px-3 py-2">
                      <p className="text-sm font-semibold uppercase tracking-wide text-maroon-500">{summaryLayout.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Structure: {result ? `${pass} of ${total} members pass after autofix` : "not available"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-maroon-500">2D plan — {layout.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PlanView
                    input={input}
                    layout={layout}
                    showPadas={showPadas}
                    structural={layoutStructural}
                    showStructure={showStructure}
                    activeMember={memberToUse}
                    onSelectMember={setActiveMember}
                    energy={layoutEnergy}
                    season={season}
                    showDaylightHeatmap={showDaylightHeatmap}
                    showVentilationArrows={showVentilationArrows}
                    showSunShading={showSunShading}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={showPadas}
                        onChange={(e) => setShowPadas(e.target.checked)}
                        className="h-3.5 w-3.5 accent-maroon-500"
                      />
                      Show 9×9 pada grid
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
                      <input type="checkbox" checked={showDaylightHeatmap} onChange={(e) => setShowDaylightHeatmap(e.target.checked)} className="h-3.5 w-3.5 accent-maroon-500" />
                      Daylight heatmap
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
                      <input type="checkbox" checked={showVentilationArrows} onChange={(e) => setShowVentilationArrows(e.target.checked)} className="h-3.5 w-3.5 accent-maroon-500" />
                      Ventilation arrows
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
                      <input type="checkbox" checked={showSunShading} onChange={(e) => setShowSunShading(e.target.checked)} className="h-3.5 w-3.5 accent-maroon-500" />
                      Sun path / shading
                    </label>
                    {showSunShading && <SeasonSwitch value={season} onChange={setSeason} />}
                    {layoutStructural && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={showStructure}
                          onChange={(e) => setShowStructure(e.target.checked)}
                          className="h-3.5 w-3.5 accent-maroon-500"
                        />
                        Structure grid
                      </label>
                    )}
                    <span className="text-sm text-gold-600">
                      North-up · the plan is provisional, not a construction drawing.
                    </span>
                  </div>
                  {showSunShading && layoutEnergy && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-maroon-500">
                        Sun path and shading <EstimatedBadge />
                      </div>
                      <SunPathPanel sunPath={layoutEnergy.sunPath} season={season} />
                    </div>
                  )}
                  {layoutStructural && (
                    <MemberPanel
                      structural={layoutStructural}
                      memberId={memberToUse}
                      onClose={() => setActiveMember(null)}
                    />
                  )}
                  {layout.notes.length > 0 && (
                    <ul className="space-y-1 rounded-md border border-gold-500/30 bg-card/70 p-3 text-sm text-muted-foreground">
                      {layout.notes.map((note, i) => (
                        <li key={`${note}-${i}`} className="flex gap-1.5">
                          <Info className="mt-0.5 h-3 w-3 shrink-0 text-gold-600" aria-hidden />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <div className="min-w-0 space-y-4">
                <VastuScoreCard score={layoutScore} hasMissing={coverage.unplaced.length > 0} />
                {layoutEnergy ? <EnergyScoreCard result={layoutEnergy} /> : (
                  <EnergyStatusCard
                    title={layouts.length === 0 ? "Energy estimate is waiting" : "Energy estimate unavailable"}
                    message={energyState.errors.get(layout.id) ?? "No energy result is available for this layout."}
                    error={Boolean(layout)}
                  />
                )}
                {layoutStructural ? (
                  <StructuralSummaryCard
                    structural={layoutStructural}
                    showReport={showReport}
                    onToggle={() => setShowReport((v) => !v)}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-gold-500/50 bg-card/50 p-5 text-center">
                    <h3 className="font-display text-base text-maroon-500">Structural safety (next)</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      IS 456 checks — wall spans, stair rise/run, beam layout.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {layoutEnergy && layoutStructural && energyState.baseline && (
              <section aria-label="Trade-off explainer" className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-maroon-500">Trade-offs</span>
                  <EstimatedBadge />
                </div>
                <TradeoffExplainer vastu={layoutScore} energy={layoutEnergy} structural={layoutStructural} />
              </section>
            )}

            {layoutEnergy && layoutStructural && energyState.baseline && (
              <section aria-label="Energy comparison and potential" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-maroon-500">Model baseline comparison</span>
                  <EstimatedBadge />
                </div>
                <BeforeAfterCard
                  current={layoutEnergy}
                  baseline={energyState.baseline}
                  baselineStructural={energyState.baselineStructural}
                  currentStructural={layoutStructural}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-maroon-500">Solar and rainwater potential</span>
                  <EstimatedBadge />
                </div>
                <SolarRainCards solar={layoutEnergy.solar} rainwater={layoutEnergy.rainwater} cityName={layoutEnergy.city.name} />
                <AssumptionsPanel assumptions={layoutEnergy.assumptions} title="Energy assumptions & formulas" />
              </section>
            )}

            <section aria-label="Vastu room-by-room detail">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg text-maroon-500">
                    Room-by-room vastu table
                    <UnverifiedBadge
                      label="Rules unverified"
                      tooltip={`${UNVERIFIED_TOOLTIP} Room-zone tables come from vastu.config.ts (verified: false).`}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-2">
                  <RoomTable score={layoutScore} />
                </CardContent>
              </Card>
            </section>

            <section aria-label="Structural report and 3D model">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-2">
                  <h3 className="font-display text-sm text-maroon-500">Structural report</h3>
                  {layoutStructural && showReport ? (
                    <StructuralReport structural={layoutStructural} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {layoutStructural
                        ? "Open the full structural report from the Structural preview card above."
                        : "Structural checks are not available for this layout."}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm text-maroon-500">3D structural model</h3>
                    {layoutStructural && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={show3D}
                          onChange={(e) => setShow3D(e.target.checked)}
                          className="h-3.5 w-3.5 accent-maroon-500"
                        />
                        Show model
                      </label>
                    )}
                  </div>
                  {layoutStructural && (
                    <Model3DPanel
                      structural={layoutStructural}
                      layout={layout}
                      activeMember={memberToUse}
                      onSelectMember={setActiveMember}
                      show={show3D}
                    />
                  )}
                </div>
              </div>
            </section>

            <p className="rounded-md border border-terracotta-500/40 bg-terracotta-500/5 px-3 py-2 text-sm text-maroon-600">
              Illustrative layouts from unverified traditional rules — treat every score as indicative and
              consult an architect or vastu consultant before anything buildable.
            </p>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
/* ------------------------------ pieces ------------------------------ */

const SCORE_META: Record<string, { title: string; detail: string }> = {
  "90+": { title: "Strong compliance", detail: " Nearly every room sits in a favourable zone." },
  "70–89": { title: "Broadly compliant", detail: "A few rooms relax toward acceptable or avoid zones." },
  "<70": { title: "Compromised", detail: "The footprint forces several room-zone compromises — read the table." },
};

function scoreMeta(score: number): { title: string; detail: string } {
  if (score >= 90) return SCORE_META["90+"];
  if (score >= 70) return SCORE_META["70–89"];
  return SCORE_META["<70"];
}

function ProgrammeCoverageStrip({ coverage }: { coverage: ReturnType<typeof getProgrammeCoverage> }) {
  const missing = coverage.unplaced.length > 0;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-gold-500/30 bg-sand-50/70 px-3 py-2 text-sm">
      <span className="font-semibold text-ink">Programme coverage</span>
      <Badge className={missing ? "border-amber-600/30 bg-amber-100 text-amber-900" : "border-emerald-700/30 bg-emerald-50 text-emerald-800"}>
        {missing ? "Warning" : "All requested spaces placed"}
      </Badge>
      {missing && <span className="text-muted-foreground">{formatProgrammeCoverage(coverage)}</span>}
    </div>
  );
}

function VastuScoreCard({ score, hasMissing }: { score: VastuResult; hasMissing: boolean }) {
  const meta = scoreMeta(score.score100);
  const pct = clamp(score.score100, 0, 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg text-maroon-500">
          Vastu score — {score.layoutId === "balanced" ? "Balanced plan" : score.layoutId === "vastu-first" ? "Vastu-first plan" : "Energy-first plan"}
          <UnverifiedBadge
            label={`${Math.round(score.unverifiedShare * 100)}% unverified`}
            tooltip={`${UNVERIFIED_TOOLTIP} The whole /100 scales on rule data marked verified: false.`}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasMissing && <p className="text-sm text-amber-800">Score covers placed rooms only</p>}
        <div className="flex items-end gap-3">
          <span className="font-display text-5xl leading-none text-maroon-500" aria-live="polite">
            {score.score100}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">of 100</span>
          <div className="ml-auto pb-1 text-right">
            <p className="text-sm font-semibold text-ink">{meta.title}</p>
            <p className="max-w-[26ch] text-sm text-muted-foreground">{meta.detail}</p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuenow={score.score100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Vastu score out of 100"
          className="h-2 w-full overflow-hidden rounded-full bg-gold-500/15"
        >
          <div className="h-full rounded-full bg-maroon-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge className={cn("px-1.5 py-0", STATUS_STYLE.ideal)}>Ideal · {score.counts.ideal}</Badge>
          <Badge className={cn("px-1.5 py-0", STATUS_STYLE.acceptable)}>Acceptable · {score.counts.acceptable}</Badge>
          <Badge className={cn("px-1.5 py-0", STATUS_STYLE.poor)}>Poor · {score.counts.poor}</Badge>
          <span className="ml-auto text-sm text-muted-foreground">
            Entrance bonus: {score.entrance.points}/{score.entrance.maxPoints} · {score.entrance.reason}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RoomTable({ score }: { score: VastuResult }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Room</TableHead>
          <TableHead>Zone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[score.entrance, score.brahmasthan, ...score.breakdown, score.symmetry].map((check, i) => (
          <TableRow key={`${check.label}-${i}`}>
            <TableCell className="max-w-[24ch] py-2">
              <p className="font-medium text-ink">
                {check === score.symmetry ? "Balance heuristic (not a traditional rule)" : check.label}
              </p>
              {check.remedy && (
                <p className="text-sm italic text-terracotta-600" title={check.why}>
                  {check.remedy}
                </p>
              )}
            </TableCell>
            <TableCell className="py-2">
              {check.zone ? (
                <span className="font-mono text-sm text-gold-600">{check.zone}</span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="py-2">
              <Badge className={cn("px-1.5 py-0", STATUS_STYLE[check.status])}>
                {check.status === "ideal" ? "Ideal" : check.status === "acceptable" ? "Acceptable" : "Poor"}
              </Badge>
            </TableCell>
            <TableCell className="py-2 text-right font-mono text-sm text-ink/90">
              {check.points}/{check.maxPoints}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EnergyStatusCard({
  title,
  message,
  error = false,
}: {
  title: string;
  message: string;
  error?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-24 items-center gap-3 p-4">
        {error ? <AlertTriangle className="h-5 w-5 shrink-0 text-terracotta-600" aria-hidden /> : <CircleDashed className="h-5 w-5 shrink-0 text-gold-600" aria-hidden />}
        <div>
          <h3 className={cn("font-display text-base", error ? "text-terracotta-700" : "text-maroon-500")}>{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DesignEmpty({ title, message, error }: { title: string; message: string; error?: boolean }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gold-500/40 bg-sand-50/70 p-8 text-center">
      {error ? (
        <AlertTriangle className="h-8 w-8 text-terracotta-600" aria-hidden />
      ) : (
        <CircleDashed className="h-8 w-8 text-gold-600" aria-hidden />
      )}
      <h3 className="font-display text-xl text-maroon-500">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/* --------------------------- structural bits --------------------------- */

function StructuralSummaryCard({
  structural,
  showReport,
  onToggle,
}: {
  structural: StructuralResult;
  showReport: boolean;
  onToggle: () => void;
}) {
  const topFixes = structural.autoFixLog.slice(0, 3);
  const forced = structural.forcedSpans.some((sp) => sp.exceeds45m);
  return (
    <div className={cn(
      "rounded-lg p-5 text-left",
      structural.ok
        ? "border border-gold-500/40 bg-emerald-800/5"
        : "border border-terracotta-500/50 bg-terracotta-500/10",
    )}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base text-maroon-500">
          Structural preview — IS 456:2000
        </h3>
        <UnverifiedBadge
          label="assumptions live in report"
          tooltip={`${UNVERIFIED_TOOLTIP} Concrete/steel grades, covers, SBC and storey height are stated in the Structural report panel.`}
        />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {structural.summary.pass}/{structural.summary.total} checks pass
        {structural.summary.amber > 0 ? ` · ${structural.summary.amber} amber` : ""}
        {" · "}{structural.summary.fail} fail without fixes needed
        {structural.initialSummary ? ` (started at ${structural.initialSummary.fail} failing)` : ""}
      </p>
      {structural.autoFixLog.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-sm text-ink/80">
          {topFixes.map((f, i) => (
            <li key={i}>{f.member}: {f.before} → {f.after}</li>
          ))}
        </ul>
      )}
      {forced && (
        <p className="mt-1 text-sm text-terracotta-700">
          Some Brahmasthan-omitted spans exceed 4.5 m — flagged in the report.
        </p>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 text-sm font-medium text-maroon-500 underline-offset-2 hover:underline"
      >
        {showReport ? "Hide report" : "Open full structural report"}
      </button>
    </div>
  );
}

function Model3DPanel({
  structural,
  layout,
  activeMember,
  onSelectMember,
  show,
}: {
  structural: StructuralResult;
  layout: Layout;
  activeMember: string | null;
  onSelectMember: (id: string | null) => void;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <Model3D
      layout={layout}
      structural={structural}
      activeMember={activeMember}
      onSelectMember={onSelectMember}
    />
  );
}
