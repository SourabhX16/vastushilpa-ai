"use client";

import { Sun, CloudRain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RainwaterEstimate, SolarPotential } from "@/lib/engine/energy/types";

export function SolarCard({
  solar,
  cityName,
}: {
  solar: SolarPotential;
  cityName: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-gold-600" aria-hidden />
            <CardTitle className="text-lg text-maroon-500">
              Rooftop Solar PV Potential
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-gold-500/50 text-sm text-gold-600"
          >
            screening estimate
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Est. Annual Output
            </p>
            <p className="font-mono text-base font-semibold text-ink">
              {solar.annualKWh.toLocaleString("en-IN")}{" "}
              <span className="text-sm font-normal text-muted-foreground">kWh/yr</span>
            </p>
            <p className="text-sm text-muted-foreground">
              ~{Math.round(solar.annualKWh / 365)} kWh/day avg
            </p>
          </div>

          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              CO₂ Avoided
            </p>
            <p className="font-mono text-base font-semibold text-emerald-700">
              {solar.co2AvoidedKg.toLocaleString("en-IN")}{" "}
              <span className="text-sm font-normal text-muted-foreground">kg/yr</span>
            </p>
            <p className="text-sm text-muted-foreground">
              @ 0.82 kg CO₂/kWh grid factor
            </p>
          </div>

          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Usable Roof Area
            </p>
            <p className="font-mono text-sm font-medium text-ink">
              {solar.usableRoofAreaM2} m²{" "}
              <span className="text-sm text-muted-foreground">
                ({Math.round(solar.roofAreaSqft)} ft² gross)
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              60% roof accessibility allowance
            </p>
          </div>

          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Solar Resource
            </p>
            <p className="font-mono text-sm font-medium text-ink">
              {solar.irradianceKWhM2Year}{" "}
              <span className="text-sm text-muted-foreground">kWh/m²/yr</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Regional base for {cityName}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-gold-500/20 bg-sand-100/40 p-2.5 text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-ink/80">Assumptions & Caveats:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {solar.assumptions.map((assump, idx) => (
              <li key={idx}>{assump}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function RainwaterCard({
  rainwater,
  cityName,
}: {
  rainwater: RainwaterEstimate;
  cityName: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-[#236760]" aria-hidden />
            <CardTitle className="text-lg text-maroon-500">
              Rainwater Harvesting Potential
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-gold-500/50 text-sm text-gold-600"
          >
            screening estimate
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Est. Annual Catchment
            </p>
            <p className="font-mono text-base font-semibold text-ink">
              {rainwater.annualLitres.toLocaleString("en-IN")}{" "}
              <span className="text-sm font-normal text-muted-foreground">litres</span>
            </p>
            <p className="text-sm text-muted-foreground">
              ~{rainwater.annualM3} m³ storage potential
            </p>
          </div>

          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Annual Rainfall
            </p>
            <p className="font-mono text-base font-semibold text-[#236760]">
              {rainwater.rainfallMm}{" "}
              <span className="text-sm font-normal text-muted-foreground">mm/yr</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Historical average for {cityName}
            </p>
          </div>

          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Roof Catchment Area
            </p>
            <p className="font-mono text-sm font-medium text-ink">
              {rainwater.catchmentAreaM2}{" "}
              <span className="text-sm text-muted-foreground">m²</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Projected horizontal roof footprint
            </p>
          </div>

          <div className="rounded-md border border-gold-500/25 bg-card/60 p-2.5">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Runoff Coefficient
            </p>
            <p className="font-mono text-sm font-medium text-ink">
              {rainwater.runoffCoefficient}
            </p>
            <p className="text-sm text-muted-foreground">
              Paved / smooth concrete roof slab
            </p>
          </div>
        </div>

        <div className="rounded-md border border-gold-500/20 bg-sand-100/40 p-2.5 text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-ink/80">Assumptions & Caveats:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {rainwater.assumptions.map((assump, idx) => (
              <li key={idx}>{assump}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function SolarRainCards({
  solar,
  rainwater,
  cityName,
}: {
  solar: SolarPotential;
  rainwater: RainwaterEstimate;
  cityName: string;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <SolarCard solar={solar} cityName={cityName} />
      <RainwaterCard rainwater={rainwater} cityName={cityName} />
    </div>
  );
}
