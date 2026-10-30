"use client";

import { useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InputsStep } from "./wizard/inputs-step";
import { RulesStep } from "./wizard/rules-step";
import { useWizardStore } from "./wizard/store";
import { DesignStep } from "./wizard/design-step";
import { isPlotFormValid, validatePlotInput } from "./wizard/plot-validation";

const STEPS = [
  { id: 0, label: "Inputs", hint: "Plot size, location, climate, building type" },
  { id: 1, label: "Rules", hint: "Vastu grid, Ayadi, solar path, IS 456" },
  { id: 2, label: "Design", hint: "2D plan, 3D view, scores, DXF export" },
  { id: 3, label: "Sheets", hint: "A3 drawing sheets and pass / fail report" },
] as const;

export default function WizardShell() {
  const step = useWizardStore((s) => s.step);
  const goToStep = useWizardStore((s) => s.goToStep);
  const hydrated = useWizardStore((s) => s.hydrated);
  const input = useWizardStore((s) => s.input);

  // Rehydrate the persisted project after mount to avoid a hydration mismatch.
  useEffect(() => {
    void useWizardStore.persist.rehydrate();
  }, []);

  const inputErrors = useMemo(() => validatePlotInput(input), [input]);
  const canLeaveInputs = isPlotFormValid(inputErrors);

  const canGoNext =
    !(step === 0 && !canLeaveInputs) && step < STEPS.length - 1;

  const handleNext = () => {
    if (!canGoNext) return;
    goToStep(Math.min(step + 1, STEPS.length - 1));
  };

  const handlePrevious = () => {
    goToStep(Math.max(0, step - 1));
  };

  // Opaque cream card: must stay opaque over the fixed photo backdrop.
  return (
    <Card className="mx-auto w-full max-w-5xl border-gold-500/30 shadow-lg shadow-maroon-500/5">
      <CardHeader className="pb-0">
        <CardTitle className="justify-center flex items-center gap-4 pb-4">
          {STEPS.map((stepDef, i) => (
            <div key={stepDef.id} className="flex items-center gap-4">
              {i > 0 && <span aria-hidden className="h-px w-6 bg-gold-500/50 md:w-12" />}
              <button
                type="button"
                onClick={() => goToStep(stepDef.id)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 outline-none",
                  "focus-visible:ring-ring rounded-sm focus-visible:ring-2"
                )}
                aria-current={step === stepDef.id ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 rotate-45 items-center justify-center border transition-colors",
                    step === stepDef.id
                      ? "border-gold-600 bg-maroon-500 shadow-md shadow-maroon-500/30"
                      : stepDef.id < step
                        ? "border-gold-500 bg-secondary"
                        : "border-gold-500/50 bg-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "-rotate-45 font-display text-sm",
                      step === stepDef.id
                        ? "text-primary-foreground"
                        : stepDef.id < step
                          ? "text-maroon-600"
                          : "text-gold-600"
                    )}
                  >
                    {stepDef.id + 1}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-widest",
                    step === stepDef.id ? "text-maroon-500" : "text-muted-foreground"
                  )}
                >
                  {stepDef.label}
                </span>
              </button>
            </div>
          ))}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hydrated ? (
          <WizardSkeleton />
        ) : (
          <>
            <div className="min-h-[240px] rounded border border-dashed border-gold-500/40 bg-sand-50/70 p-4 md:p-5">
              {step === 0 && <InputsStep />}
              {step === 1 && <RulesStep />}
              {step === 2 && <DesignStep />}
              {step >= 3 && (
                <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                  <h3 className="font-display text-2xl text-maroon-500">
                    {STEPS[step].label}
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {STEPS[step].hint}
                  </p>
                  <Badge variant="secondary" className="mt-4">
                    Empty slot — wired up in the next step
                  </Badge>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                disabled={step === 0}
                onClick={handlePrevious}
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              <Button disabled={!canGoNext} onClick={handleNext}>
                Next
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WizardSkeleton() {
  return (
    <div
      className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded border border-dashed border-gold-500/40 bg-sand-50/70 p-8 text-center"
      aria-busy="true"
      aria-label="Loading your saved project"
    >
      <Loader2 className="h-6 w-6 animate-spin text-gold-600" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading your saved project…</p>
      <span className="sr-only">
        If this takes long, your browser may be blocking local storage.
      </span>
    </div>
  );
}
