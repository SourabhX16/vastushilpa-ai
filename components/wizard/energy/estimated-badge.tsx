"use client";

import { UnverifiedBadge } from "../unverified-badge";

/**
 * Every energy figure in the UI carries this badge. The energy module is a
 * simplified early-stage model, not a simulation or a certified result.
 */
export function EstimatedBadge({
  label = "estimated",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <UnverifiedBadge
      label={label}
      tooltip="Simplified model ESTIMATE from sun-path geometry and placeholder climate data — not an energy simulation, not code compliance and not a certified performance claim."
      className={className}
    />
  );
}
