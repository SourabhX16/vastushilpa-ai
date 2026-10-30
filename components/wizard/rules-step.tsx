"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateAyadi, suggestNearestAuspicious } from "@/lib/engine/ayadi";
import type { AyadiResult, AyadiSuggestion } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { isPlotFormValid, validatePlotInput } from "./plot-validation";
import { UnverifiedBadge, UNVERIFIED_TOOLTIP } from "./unverified-badge";
import { VastuGridCard } from "./vastu-grid-card";
import { useWizardStore } from "./store";

/** Step 2 (part 1): the Ayadi working, verdicts and nearest-auspicious fixes. */
export function RulesStep() {
  const input = useWizardStore((s) => s.input);
  const patchInput = useWizardStore((s) => s.patchInput);

  const errors = useMemo(() => validatePlotInput(input), [input]);

  const ayadi = useMemo<{ status: "ok"; value: AyadiResult } | { status: "error"; message: string }>(() => {
    try {
      return { status: "ok", value: calculateAyadi(input) };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Unexpected calculation error.",
      };
    }
  }, [input]);

  if (!isPlotFormValid(errors)) {
    return (
      <EmptyRulesState
        title="Ayadi check needs complete plot inputs"
        message="Go back and finish the Inputs step — dimensions, unit, city and bedrooms are required before the rules engine can run."
      />
    );
  }

  if (ayadi.status === "error") {
    return (
      <EmptyRulesState
        title="The Ayadi calculation failed"
        message={ayadi.message}
        error
      />
    );
  }

  const result = ayadi.value;

  return (
    <div className="space-y-4">
      {/* -------------------------- verdict banner -------------------------- */}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          result.overallAuspicious
            ? "border-gold-500/50 bg-gold-500/10"
            : "border-terracotta-500/50 bg-terracotta-500/10",
        )}
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          {result.overallAuspicious ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-gold-600" aria-hidden />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-terracotta-600" aria-hidden />
          )}
          <div>
            <p className="font-display text-lg text-maroon-500">
              {result.overallAuspicious ? "Overall verdict: Auspicious" : "Overall verdict: Not auspicious"}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.steps.length} working steps · {result.unverifiedCount} depend on unverified formulas
            </p>
          </div>
        </div>
        <UnverifiedBadge
          label={`${result.unverifiedCount} unverified`}
          tooltip={`${UNVERIFIED_TOOLTIP} Every Ayadi step below is config-derived and unverified.`}
        />
      </div>

      {/* ------------------------- worked steps ------------------------- */}
      <Card className="border-gold-500/30 bg-sand-50/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-maroon-500">Calculation working</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative ml-2 space-y-5 border-l border-gold-500/40 pl-6">
            {result.steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                    step.auspicious === true
                      ? "border-gold-600 bg-gold-500/20 text-maroon-500"
                      : step.auspicious === false
                        ? "border-terracotta-500 bg-terracotta-500/20 text-terracotta-600"
                        : "border-gold-500/50 bg-card text-gold-600",
                  )}
                >
                  {step.auspicious === true ? "✓" : step.auspicious === false ? "✕" : "–"}
                </span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="text-sm font-semibold text-ink">{step.label}</h4>
                  <Badge
                    aria-label={
                      step.auspicious === null
                        ? "Not evaluated"
                        : step.auspicious
                          ? "Pass"
                          : "Fail"
                    }
                    className={cn(
                      "px-1.5 py-0 text-[10px]",
                      step.auspicious === true && "border-transparent bg-emerald-700/90 text-white",
                      step.auspicious === false && "border-transparent bg-terracotta-600 text-white",
                      step.auspicious === null && "border-transparent bg-secondary text-muted-foreground",
                    )}
                  >
                    {step.auspicious === true ? "Auspicious" : step.auspicious === false ? "Not auspicious" : "Not evaluated"}
                  </Badge>
                  {step.unverified && <UnverifiedBadge />}
                </div>
                <p className="mt-1 text-xs italic text-muted-foreground">{step.formulaText}</p>
                <p className="mt-1 rounded bg-card/80 px-2 py-1 font-mono text-[11px] leading-relaxed text-ink/90 shadow-sm">
                  {step.calculation}
                </p>
                <p className="mt-1 text-xs font-medium text-maroon-600">= {step.result}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* --------------------- suggestions when failing --------------------- */}
      {result.overallAuspicious ? (
        <div className="flex items-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/5 px-3 py-2 text-xs text-maroon-600">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
          The current {input.length} × {input.width} {input.unit} plot passes every evaluated Ayadi check — no changes needed.
        </div>
      ) : (
        <SuggestionsPanel input={input} onApply={(dims) => patchInput(dims)} />
      )}

      {/* --------------------- vastu zone grid --------------------- */}
      <VastuGridCard input={input} />
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function EmptyRulesState({
  title,
  message,
  error,
}: {
  title: string;
  message: string;
  error?: boolean;
}) {
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

function SuggestionsPanel({
  input,
  onApply,
}: {
  input: Parameters<typeof suggestNearestAuspicious>[0];
  onApply: (patch: { length: number; width: number }) => void;
}) {
  const suggestions = useMemo<AyadiSuggestion[] | null>(() => {
    try {
      return suggestNearestAuspicious(input);
    } catch {
      return null;
    }
    // Suggestion search is cheap (±3 ft grid) but recomputes only when the
    // plot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.length, input.width, input.unit]);

  if (suggestions === null) {
    return (
      <EmptyRulesState
        title="Could not search for auspicious dimensions"
        message="The suggestion search failed — edit the dimensions manually and try again."
        error
      />
    );
  }

  return (
    <section className="rounded-lg border border-terracotta-500/40 bg-terracotta-500/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-maroon-500">Nearest auspicious dimensions</h3>
          <p className="text-xs text-muted-foreground">
            Searched ±3 ft in 0.5 ft steps around {input.length} × {input.width} {input.unit}.
          </p>
        </div>
        <UnverifiedBadge
          label="Derived from unverified formulas"
          tooltip={`${UNVERIFIED_TOOLTIP} Suggestions inherit the unverified Ayadi encoding.`}
        />
      </div>
      {suggestions.length === 0 ? (
        <p className="rounded-md border border-dashed border-gold-500/40 bg-card/60 px-3 py-6 text-center text-sm text-muted-foreground">
          No auspicious dimension pair within ±3 ft. Try larger adjustments or proceed treating Ayadi as advisory.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {suggestions.map((s) => (
            <div
              key={`${s.length}x${s.width}`}
              className="flex flex-col gap-2 rounded-md border border-gold-500/40 bg-sand-50/80 p-3 shadow-sm"
            >
              <p className="font-display text-lg text-maroon-500">
                {s.length} × {s.width} {s.unit}
              </p>
              <p className="font-mono text-[11px] text-terracotta-600">
                {fmtDelta(s.deltaLengthFt, "L")} · {fmtDelta(s.deltaWidthFt, "W")}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-auto gap-1.5 bg-maroon-500 text-primary-foreground hover:bg-maroon-600"
                onClick={() => onApply({ length: s.length, width: s.width })}
              >
                Apply
                <ArrowRight aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function fmtDelta(delta: number, axis: "L" | "W"): string {
  const sign = delta >= 0 ? "+" : "−";
  return `${axis} ${sign}${Math.abs(delta).toFixed(1)} ft`;
}
