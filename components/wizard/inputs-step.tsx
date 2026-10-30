"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CITIES } from "@/lib/data/cities";
import type { BuildingType, LengthUnit, PlotFacing, PlotInput } from "@/lib/engine/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PLOT_LIMITS,
  convertLength,
  isPlotFormValid,
  validatePlotInput,
} from "./plot-validation";
import { CompassSelector } from "./compass-selector";
import { CityInfoCard } from "./city-info-card";
import { PlotDescriptionBox } from "./plot-description-box";
import { PlotPreview } from "./plot-preview";
import { useWizardStore } from "./store";

const BUILDING_TYPES: {
  id: BuildingType;
  label: string;
  supported: boolean;
  note?: string;
}[] = [
  { id: "residential", label: "Residential", supported: true },
  { id: "school", label: "School", supported: false, note: "Coming soon" },
  { id: "office", label: "Office", supported: false, note: "Coming soon" },
];

const FEATURES: { key: keyof PlotInput; title: string; description: string }[] = [
  {
    key: "poojaRoom",
    title: "Pooja room",
    description: "Reserve a quiet, zone-appropriate pooja space in the plan.",
  },
  {
    key: "parking",
    title: "Parking",
    description: "Allocate a car / two-wheeler bay inside the plot.",
  },
  {
    key: "elderlyGroundFloor",
    title: "Elderly-friendly ground floor",
    description: "Keep all essentials reachable on the ground floor.",
  },
];

/** Step 1 of the wizard: plot inputs with live preview and quick-fill. */
export function InputsStep() {
  const input = useWizardStore((s) => s.input);
  const patchInput = useWizardStore((s) => s.patchInput);
  const loadSampleProject = useWizardStore((s) => s.loadSampleProject);
  const resetProject = useWizardStore((s) => s.resetProject);

  const errors = useMemo(() => validatePlotInput(input), [input]);
  const valid = isPlotFormValid(errors);

  const handleUnitChange = (unit: LengthUnit) => {
    if (unit === input.unit) return;
    patchInput({
      unit,
      length: convertLength(input.length, input.unit, unit),
      width: convertLength(input.width, input.unit, unit),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="lg"
          className="h-auto min-h-12 w-full whitespace-normal px-3 py-3 text-center leading-snug bg-maroon-500 text-primary-foreground shadow-sm hover:bg-maroon-600 sm:flex-1"
          onClick={loadSampleProject}
        >
          <Sparkles aria-hidden />
          Load sample project (30x40 ft, East-facing, Bhopal, 3BHK)
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10 shrink-0 border-gold-500/50 text-gold-600 hover:bg-secondary"
          onClick={resetProject}
        >
          <RotateCcw aria-hidden />
          Reset
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* ------------------------- form column ------------------------- */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">Plot dimensions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <UnitToggle value={input.unit} onChange={handleUnitChange} />
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <DimensionField
                  label="Plot length (east-west side)"
                  unit={input.unit}
                  value={input.length}
                  error={errors.length}
                  onCommit={(n) => patchInput({ length: n })}
                />
                <DimensionField
                  label="Plot width (north-south side)"
                  unit={input.unit}
                  value={input.width}
                  error={errors.width}
                  onCommit={(n) => patchInput({ width: n })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">Road-facing direction</CardTitle>
            </CardHeader>
            <CardContent>
              <CompassSelector
                value={input.facing}
                onChange={(facing: PlotFacing) => patchInput({ facing })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">City</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={input.city || ""} onValueChange={(v) => patchInput({ city: v })}>
                <SelectTrigger
                  aria-label="City"
                  className={cn(
                    "border-gold-500/40 bg-sand-50/80",
                    errors.city && "border-destructive",
                  )}
                >
                  <SelectValue placeholder="Select a city" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && (
                <p role="alert" className="text-sm text-destructive">{errors.city}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">Building type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {BUILDING_TYPES.map((type) => {
                  const active = type.supported && input.buildingType === type.id;
                  const styles = active
                    ? "border-maroon-600 bg-maroon-500 text-primary-foreground shadow-md shadow-maroon-500/20"
                    : "border-gold-500/40 bg-card text-ink hover:border-gold-600";
                  return (
                    <button
                      key={type.id}
                      type="button"
                      aria-pressed={active}
                      disabled={!type.supported}
                      onClick={() => patchInput({ buildingType: type.id })}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        styles,
                        !type.supported && "cursor-not-allowed opacity-60 hover:border-gold-500/40",
                      )}
                    >
                      {type.label}
                      {!type.supported && type.note && (
                        <span className="rounded-full border border-gold-500/60 bg-gold-500/10 px-1.5 text-sm font-medium uppercase tracking-wider text-gold-600">
                          {type.note}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">Bedrooms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div role="group" aria-label="Number of bedrooms" className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = input.bedrooms === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={active}
                      onClick={() => patchInput({ bedrooms: n })}
                      className={cn(
                        "h-9 flex-1 rounded-md border text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-maroon-600 bg-maroon-500 text-primary-foreground shadow-sm"
                          : "border-gold-500/40 bg-card text-gold-600 hover:bg-secondary",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {errors.bedrooms && (
                <p role="alert" className="text-sm text-destructive">{errors.bedrooms}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FEATURES.map((feature) => (
                <ToggleRow
                  key={feature.key}
                  title={feature.title}
                  description={feature.description}
                  checked={Boolean(input[feature.key])}
                  onChange={(checked) =>
                    patchInput({ [feature.key]: checked } as Partial<PlotInput>)
                  }
                />
              ))}
            </CardContent>
          </Card>

          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              valid
                ? "border-gold-500/40 bg-gold-500/10 text-maroon-600"
                : "border-terracotta-500/40 bg-terracotta-500/10 text-terracotta-600",
            )}
            aria-live="polite"
          >
            {valid ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                All inputs are valid — continue to the rules step.
              </>
            ) : (
              <>Complete the highlighted fields above to continue.</>
            )}
          </div>
        </div>

        {/* ------------------------- side column ------------------------- */}
        <div className="min-w-0 space-y-4">
          <PlotDescriptionBox />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-maroon-500">Live plot preview</CardTitle>
            </CardHeader>
            <CardContent>
              <PlotPreview input={input} />
            </CardContent>
          </Card>

          <CityInfoCard cityId={input.city} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------- sub components --------------------------- */

function UnitToggle({
  value,
  onChange,
}: {
  value: LengthUnit;
  onChange: (unit: LengthUnit) => void;
}) {
  const options: { id: LengthUnit; label: string }[] = [
    { id: "ft", label: "Feet (ft)" },
    { id: "m", label: "Metre (m)" },
  ];
  return (
    <div
      role="group"
      aria-label="Length unit"
      className="inline-flex overflow-hidden rounded-md border border-gold-500/40 bg-card shadow-sm"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === option.id
              ? "bg-maroon-500 text-primary-foreground"
              : "bg-card text-gold-600 hover:bg-secondary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DimensionField({
  label,
  unit,
  value,
  error,
  onCommit,
}: {
  label: string;
  unit: LengthUnit;
  value: number;
  error?: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(() => (value > 0 ? String(value) : ""));
  const lastCommitted = useRef(value);

  // Re-sync the text box when the store changes from elsewhere
  // (sample load, unit toggle, suggestion apply).
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setText(value > 0 ? String(value) : "");
    }
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setText(raw);
    const parsed = parseFloat(raw);
    const committed = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    lastCommitted.current = committed;
    onCommit(committed);
  };

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium uppercase tracking-wide text-ink/70">
        {label}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min={PLOT_LIMITS[unit].min}
        max={PLOT_LIMITS[unit].max}
        step="0.5"
        value={text}
        onChange={handleChange}
        aria-invalid={Boolean(error)}
        className={cn(
          "border-gold-500/40 bg-sand-50/80 text-ink",
          error && "border-destructive text-destructive",
        )}
      />
      {error ? (
        <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {PLOT_LIMITS[unit].min}–{PLOT_LIMITS[unit].max} {unit}
        </p>
      )}
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const switchId = `toggle-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label
      htmlFor={switchId}
      className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-gold-500/30 bg-card/60 px-3 py-2.5 transition-colors hover:border-gold-500/60"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{title}</span>
        {description && (
          <span className="text-sm text-muted-foreground">{description}</span>
        )}
      </span>
      <input
        id={switchId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-maroon-600 bg-maroon-500" : "border-gold-500/60 bg-sand-200",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
        )}
      >
        <span
          className={cn(
            "mx-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform",
            checked ? "translate-x-[16px]" : "translate-x-0",
          )}
        />
      </span>
    </label>
  );
}
