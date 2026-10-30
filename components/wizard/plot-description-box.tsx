"use client";

import { useState } from "react";
import { AlertTriangle, Check, Info, Wand2 } from "lucide-react";
import { useWizardStore } from "./store";
import { parsePlotDescription, type ParseOutcome } from "./parse-plot";

const PLACEHOLDER =
  "East-facing 30x40, 3BHK, Bhopal";

/**
 * Natural-language quick-fill box. Parsing is pure regex/keyword matching;
 * results list what was understood and what was NOT (never guesses).
 */
export function PlotDescriptionBox() {
  const patchInput = useWizardStore((s) => s.patchInput);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    if (!text.trim()) {
      setError("Type a description first, e.g. “East-facing 30x40, 3BHK, Bhopal”.");
      setOutcome(null);
      return;
    }
    setError(null);
    const result = parsePlotDescription(text);
    setOutcome(result);
    if (Object.keys(result.patch).length > 0) {
      patchInput(result.patch);
    }
  };

  return (
    <section className="rounded-lg border border-gold-500/30 bg-card/70 p-4">
      <label htmlFor="plot-description" className="mb-2 flex items-center gap-2 text-sm font-medium text-maroon-500">
        <Wand2 className="h-4 w-4 text-gold-600" aria-hidden />
        Describe your plot in words
      </label>
      <textarea
        id="plot-description"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={2}
        className="w-full resize-none rounded-md border border-gold-500/40 bg-sand-50/80 px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Keyword parsing only — nothing is guessed.
        </p>
        <button
          type="button"
          onClick={apply}
          className="rounded-md border border-gold-500/60 bg-secondary px-3 py-1.5 text-sm font-semibold text-maroon-500 shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Fill the form
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {outcome && (
        <div className="mt-2 space-y-2">
          {outcome.understood.length > 0 && (
            <ul className="space-y-1">
              {outcome.understood.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-sm text-maroon-600">
                  <Check className="h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {outcome.missing.length > 0 && (
            <ul className="space-y-1">
              {outcome.missing.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-sm text-terracotta-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {outcome.notes.length > 0 && (
            <ul className="space-y-1">
              {outcome.notes.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {outcome.understood.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing could be understood from that description — fill the form manually.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
