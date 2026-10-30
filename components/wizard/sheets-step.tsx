"use client";

import { useMemo, useState } from "react";
import { generateLayouts } from "@/lib/engine/generateLayouts";
import { runStructural } from "@/lib/engine/structural";
import { scoreVastu } from "@/lib/engine/scoreVastu";
import { analyzeEnergy, buildBaselineLayout, scoreEnergy } from "@/lib/engine/energy";
import { calculateAyadi, suggestNearestAuspicious } from "@/lib/engine/ayadi";
import type { LayoutMode, Strictness } from "@/lib/engine/types";
import { getCityById } from "@/lib/data/cities";
import { Button } from "@/components/ui/button";
import { PlanView } from "./plan-view";
import { useWizardStore } from "./store";
import { isPlotFormValid, validatePlotInput } from "./plot-validation";
import { formatProgrammeCoverage, getProgrammeCoverage } from "@/lib/export/programmeCoverage";

const MODES: LayoutMode[] = ["balanced", "vastu-first", "energy-first"];
const TITLES = ["Plot & Inputs", "Ayadi Working", "Floor Plan & Vastu Grid", "Vastu Analysis", "Structural Design", "Energy & Ventilation"];

export function SheetsStep() {
  const input = useWizardStore((s) => s.input);
  const [mode, setMode] = useState<LayoutMode>("balanced");
  const strictness: Strictness = "balanced";
  const errors = useMemo(() => validatePlotInput(input), [input]);
  const data = useMemo(() => {
    if (!isPlotFormValid(errors)) return null;
    try {
      const layouts = generateLayouts(input, strictness);
      if (!layouts.length) return null;
      const layout = layouts.find((item) => item.id === mode) ?? layouts[0];
      const vastu = scoreVastu(layout, input);
      const structural = runStructural(input, layout);
      const baselineLayout = buildBaselineLayout(input, layouts[0]);
      const baselineAnalysis = analyzeEnergy(input, baselineLayout, { baseline: true });
      const energy = scoreEnergy(analyzeEnergy(input, layout), baselineAnalysis);
      const ayadi = calculateAyadi(input);
      const suggestions = ayadi.overallAuspicious ? [] : suggestNearestAuspicious(input);
      return { layouts, layout, vastu, structural, energy, ayadi, suggestions, baseline: scoreEnergy(baselineAnalysis, baselineAnalysis) };
    } catch {
      return null;
    }
  }, [errors, input, mode]);
  const ready = Boolean(data);
  const city = getCityById(input.city);

  return <section className="sheets-step space-y-4" aria-label="Drawing sheets">
    <div className="sheets-toolbar flex flex-wrap items-center gap-3 rounded-lg border border-gold-500/30 bg-card p-3">
      <label className="text-sm font-medium">Layout <select className="ml-2 rounded border border-gold-500/40 bg-sand-50 px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value as LayoutMode)}>{MODES.map((item) => <option key={item} value={item}>{item === "vastu-first" ? "Vastu-first" : item === "energy-first" ? "Energy-first" : "Balanced"}</option>)}</select></label>
      <span className="text-sm text-muted-foreground">Strictness: <strong className="text-ink">{strictness}</strong></span>
      <Button disabled={!ready} title={!ready ? "Complete valid plot inputs to generate all six sheets." : "Open the browser print dialog."} onClick={() => window.print()}>Print / Save as PDF</Button>
      <p className="basis-full text-xs text-muted-foreground">In the print dialog choose Save as PDF, paper A3, landscape, margins None, and tick Background graphics.</p>
    </div>
    {!data ? <div className="rounded-lg border border-dashed border-gold-500/50 bg-card p-8 text-center"><h2 className="font-display text-xl text-maroon-500">Sheets are not available</h2><p className="mt-2 text-sm text-muted-foreground">Complete valid plot dimensions, facing, city, and building inputs to generate the six drawing sheets.</p></div> : <div className="sheets-preview space-y-5">
      <Sheet input={input} number={1} title={TITLES[0]} mode={data.layout.name}><div className="sheet-columns"><section><h2>Plot to scale</h2><PlotDiagram input={input}/></section><section><h2>Project inputs</h2><table><tbody>{Object.entries({Length:`${input.length} ${input.unit}`,Width:`${input.width} ${input.unit}`,Facing:input.facing,City:city?.name ?? input.city,Building:input.buildingType,Bedrooms:input.bedrooms,"Pooja room":input.poojaRoom?"Yes":"No",Parking:input.parking?"Yes":"No","Elderly ground floor":input.elderlyGroundFloor?"Yes":"No"}).map(([k,v])=><tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table><h2>Climate basis</h2>{city ? <table><tbody>{[["Latitude",`${city.latitude}°`],["Climate zone",city.climateZone],["Seismic zone",city.seismicZone],["Summer / winter",`${city.avgSummerTempC}°C / ${city.avgWinterTempC}°C`],["Humidity",`${city.avgRelativeHumidityPct}%`],["Rainfall",`${city.annualRainfallMm} mm/year`],["Wind",city.prevailingWind]].map(([k,v])=><tr key={k}><th>{k}</th><td>{v} {!city.verified&&<Unverified/>}</td></tr>)}</tbody></table>:<p>Climate data unavailable</p>}</section></div></Sheet>
      <Sheet input={input} number={2} title={TITLES[1]} mode={data.layout.name}><p className="sheet-warning">Ayadi formulas are under verification against published sources. Treat results as indicative.</p><h2>{data.ayadi.overallAuspicious?"Overall verdict: Auspicious":"Overall verdict: Not auspicious"} <Unverified/></h2><table><thead><tr><th>Step</th><th>Formula</th><th>Calculation</th><th>Result</th><th>Verdict</th></tr></thead><tbody>{data.ayadi.steps.map((s,i)=><tr key={i}><td>{s.label}</td><td>{s.formulaText}</td><td>{s.calculation}</td><td>{s.result}</td><td>{s.auspicious===null?"Not evaluated":s.auspicious?"Pass":"Fail"} {s.unverified&&<Unverified/>}</td></tr>)}</tbody></table>{data.suggestions.length>0&&<><h2>Nearest suggested dimensions</h2><table><thead><tr><th>Length</th><th>Width</th><th>Change</th></tr></thead><tbody>{data.suggestions.slice(0,8).map((s,i)=><tr key={i}><td>{s.length} {s.unit}</td><td>{s.width} {s.unit}</td><td>{s.deltaLengthFt >= 0?"+":""}{s.deltaLengthFt} × {s.deltaWidthFt >= 0?"+":""}{s.deltaWidthFt} ft</td></tr>)}</tbody></table></>}</Sheet>
      <Sheet input={input} number={3} title={TITLES[2]} mode={data.layout.name} coverage={formatProgrammeCoverage(getProgrammeCoverage(input, data.layout))}><div className="sheet-plan"><PlanView input={input} layout={data.layout} showPadas/><Compass/><div className="room-key">{data.layout.rooms.map((r)=><span key={r.id}>{r.label} · {(r.rect.w*r.rect.h).toFixed(0)} sq ft</span>)}</div></div></Sheet>
      <Sheet input={input} number={4} title={TITLES[3]} mode={data.layout.name} coverage={formatProgrammeCoverage(getProgrammeCoverage(input, data.layout))}><div className="score-block"><strong>{data.vastu.score100}</strong><span>/ 100 Vastu score</span><p>Ideal {data.vastu.counts.ideal} · Acceptable {data.vastu.counts.acceptable} · Poor {data.vastu.counts.poor}</p></div><p><b>{(data.vastu.unverifiedShare*100).toFixed(0)}% of score from unverified rules</b> · <Unverified/></p><p><b>Balance heuristic (not a traditional rule)</b></p><table><thead><tr><th>Room / check</th><th>Status</th><th>Reason</th><th>Remedy</th><th>Rule source</th></tr></thead><tbody>{data.vastu.breakdown.map((r,i)=><tr key={i}><td>{r.label}</td><td>{r.status}</td><td>{r.reason}</td><td>{r.remedy??"—"}</td><td>{r.source} {r.verified?"Verified":<Unverified/>}</td></tr>)}</tbody></table></Sheet>
      <Sheet input={input} number={5} title={TITLES[4]} mode={data.layout.name}><div className="sheet-plan structural-plan"><PlanView input={input} layout={data.layout} structural={data.structural} showStructure/><Compass/></div><p className="summary-line">Pass {data.structural.summary.pass} · Amber {data.structural.summary.amber} · Fail {data.structural.summary.fail}</p>{([...[ ["Panels",data.structural.members.panels], ["Beams",data.structural.members.beams], ["Columns",data.structural.members.columns] ] ] as const).map(([group,members])=><section key={group}><h2>{group}</h2><table><thead><tr><th>Member / check</th><th>Demand</th><th>Capacity</th><th>Status</th><th>Clause</th><th>Verified</th></tr></thead><tbody>{members.flatMap((m)=>m.checks.map((c)=><tr key={`${m.id}-${c.id}`}><td>{m.id}: {c.label}</td><td>{c.demand}</td><td>{c.capacity}</td><td>{c.status}</td><td>{c.clause}</td><td>{c.verified?"Yes":"No — unverified"}</td></tr>))}</tbody></table></section>)}<h2>Assumptions & notes</h2><ul>{data.structural.assumptions.map((a)=><li key={a.id}>{a.label}: {a.value} {a.verified?"":"(unverified)"}</li>)}<li>Seismic Zone {data.structural.seismic.zone}: {data.structural.seismic.note} {!data.structural.seismic.verified&&<Unverified/>}</li><li>Foundation: SBC {data.structural.foundation.sbcKPa} kPa. {data.structural.foundation.note} <Unverified/></li></ul><h2>Auto-fix log</h2>{data.structural.autoFixLog.length?data.structural.autoFixLog.map((x,i)=><p key={i}>{x.member}, {x.check}: {x.before} → {x.after} — {x.reason}</p>):<p>No automatic fixes applied.</p>}</Sheet>
      <Sheet input={input} number={6} title={TITLES[5]} mode={data.layout.name}><div className="energy-top"><div className="score-block"><strong>{data.energy.score100}</strong><span>/ 100 energy score <Estimated/></span></div><p>{data.energy.breakdown.map((b)=><span key={b.label} className="energy-item">{b.label}: {b.value}/100 · {b.points.toFixed(1)} points (estimated)</span>)}</p></div><div className="sheet-plan"><PlanView input={input} layout={data.layout} energy={data.energy} showDaylightHeatmap showVentilationArrows showSunShading/><Compass/></div><div className="sheet-columns"><section><h2>Sun path</h2><SunDiagram summer={data.energy.sunPath.days.summer.points} winter={data.energy.sunPath.days.winter.points}/><p>Summer and winter solar altitude / azimuth estimates.</p><h2>Window & overhang notes</h2>{data.energy.windows.map((w,i)=><p key={i}>{w.roomLabel}: {w.orientation} window {w.widthFt} × {w.heightFt} ft; overhang {w.requiredOverhangFt.toFixed(1)} ft. {w.shadingNote}</p>)}</section><section><h2>Before / after (estimated)</h2><p>Baseline {data.baseline.score100}/100 · Selected {data.energy.score100}/100</p><p>Cooling: {Math.round(data.baseline.cooling.annualCoolingKWh)} → {Math.round(data.energy.cooling.annualCoolingKWh)} kWh/year</p><h2>Solar & rainwater estimates</h2><p>Rooftop solar: {data.energy.solar.annualKWh.toLocaleString()} kWh/year <Estimated/></p><p>Rainwater: {data.energy.rainwater.annualLitres.toLocaleString()} litres/year <Estimated/></p><h2>Assumptions</h2><ul>{data.energy.assumptions.map((a,i)=><li key={i}>{typeof a==="string"?a:JSON.stringify(a)}</li>)}</ul></section></div></Sheet>
    </div>}
  </section>;
}

function Sheet({input,number,title,mode,coverage,children}:{input:ReturnType<typeof useWizardStore.getState>["input"];number:number;title:string;mode:string;coverage?:string;children:React.ReactNode}) { return <article className="drawing-sheet"><div className="sheet-border"><i className="ornament top-left">❧</i><i className="ornament top-right">❧</i><div className="sheet-content">{children}</div><footer className="sheet-titleblock"><div><b>{input.bedrooms}BHK, {getCityById(input.city)?.name??input.city}</b><span>Plot {input.length} × {input.width} {input.unit} · Facing {input.facing}</span></div><div><b>{title}</b><span>{mode} layout · Sheet {number} of 6</span>{coverage&&<span>Programme coverage: {coverage}</span>}</div><div><b>Scale: indicative, plan dimensions govern</b><span>{new Date().toLocaleDateString("en-IN")} · Preliminary design. Must be verified by a licensed structural engineer.</span></div></footer><i className="ornament bottom-left">❧</i><i className="ornament bottom-right">❧</i></div></article> }
function Unverified(){return <small className="unverified-mark">UNVERIFIED</small>}
function Estimated(){return <small className="estimated-mark">ESTIMATED</small>}
function Compass(){return <div className="sheet-compass"><b>N</b><span>↑</span><small>North</small></div>}
function PlotDiagram({input}:{input:ReturnType<typeof useWizardStore.getState>["input"]}){return <svg className="plot-diagram" viewBox="0 0 300 220" role="img" aria-label="Plot with north arrow and road"><rect x="48" y="28" width="205" height="150" fill="#f4ead6" stroke="#641d28" strokeWidth="2"/><path d="M45 185H256" stroke="#777" strokeWidth="10"/><text x="150" y="202" textAnchor="middle">ROAD · {input.facing} FACING</text><text x="150" y="105" textAnchor="middle">{input.length} × {input.width} {input.unit}</text><path d="M270 65V30m0 0-7 12m7-12 7 12" stroke="#641d28"/><text x="270" y="22" textAnchor="middle">N</text></svg>}
function SunDiagram({summer,winter}:{summer:{azimuthDeg:number;altitudeDeg:number;daylight:boolean}[];winter:{azimuthDeg:number;altitudeDeg:number;daylight:boolean}[]}) {const point=(p:typeof summer)=>p.filter(x=>x.daylight).map(x=>`${150+Math.cos((x.azimuthDeg-90)*Math.PI/180)*x.altitudeDeg*2},${120-Math.sin(x.altitudeDeg*Math.PI/180)*80}`).join(" ");return <svg className="sun-diagram" viewBox="0 0 300 140"><path d="M20 120H280M35 120A115 115 0 0 1 265 120" fill="none" stroke="#a88a55"/><polyline points={point(summer)} fill="none" stroke="#c46a32" strokeWidth="3"/><polyline points={point(winter)} fill="none" stroke="#527b88" strokeWidth="3"/><text x="25" y="135">E</text><text x="265" y="135">W</text><text x="100" y="20">Summer</text><text x="180" y="20">Winter</text></svg>}
