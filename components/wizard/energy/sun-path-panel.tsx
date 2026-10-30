"use client";

import { Badge } from "@/components/ui/badge";
import type { Season, SunPathResult } from "@/lib/engine/energy/types";
import { cn } from "@/lib/utils";

const SEASON_LABEL: Record<Season, string> = {
  summer: "Summer solstice",
  winter: "Winter solstice",
  equinox: "Equinox",
};

const SEASON_ORDER: Season[] = ["summer", "winter", "equinox"];

export function SeasonSwitch({
  value,
  onChange,
  className,
}: {
  value: Season;
  onChange: (season: Season) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-gold-500/40 bg-card/70",
        className,
      )}
      role="group"
      aria-label="Sun-path season"
    >
      {SEASON_ORDER.map((season) => (
        <button
          key={season}
          type="button"
          aria-pressed={value === season}
          onClick={() => onChange(season)}
          className={cn(
            "px-2 py-1 text-sm font-medium transition-colors",
            value === season
              ? "bg-maroon-500 text-primary-foreground"
              : "text-muted-foreground hover:bg-gold-500/10",
          )}
        >
          {season === "summer" ? "Summer" : season === "winter" ? "Winter" : "Equinox"}
        </button>
      ))}
    </div>
  );
}

export function SunPathPanel({
  sunPath,
  season,
  className,
}: {
  sunPath: SunPathResult;
  season: Season;
  className?: string;
}) {
  const day = sunPath.days[season];
  const width = 380;
  const height = 178;
  const left = 30;
  const right = 10;
  const top = 12;
  const bottom = 28;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (hour: number) => left + (hour / 24) * plotW;
  const y = (alt: number) => top + ((90 - Math.max(0, Math.min(90, alt))) / 90) * plotH;

  const selectedPath = pathFor(day.points, x, y);
  const sunrise = day.sunriseHour;
  const sunset = day.sunsetHour;

  return (
    <div
      className={cn(
        "rounded-md border border-gold-500/30 bg-card/60 p-2.5",
        className,
      )}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-maroon-500">
          Sun path — {SEASON_LABEL[season]}
        </p>
        <Badge
          variant="outline"
          className="border-gold-500/50 px-1.5 py-0 text-sm text-gold-600"
        >
          standard solar geometry · local solar time
        </Badge>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${SEASON_LABEL[season]} sun-path diagram for latitude ${sunPath.latitude.toFixed(2)} degrees: altitude against time`}
      >
        <rect
          x={left}
          y={top}
          width={plotW}
          height={plotH}
          fill="#faf6ec"
          stroke="#e7d9c2"
          strokeWidth="1"
        />
        {[0, 30, 60, 90].map((alt) => (
          <g key={alt}>
            <line
              x1={left}
              y1={y(alt)}
              x2={left + plotW}
              y2={y(alt)}
              stroke="#e7d9c2"
              strokeWidth="0.7"
            />
            <text
              x={left - 4}
              y={y(alt)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="14"
              fill="#8f7024"
            >
              {alt}°
            </text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].map((hour) => (
          <g key={hour}>
            <line
              x1={x(hour)}
              y1={top}
              x2={x(hour)}
              y2={top + plotH}
              stroke={hour === 12 ? "#d9c7a8" : "#f0e7d6"}
              strokeWidth="0.7"
              strokeDasharray={hour === 12 ? "2 2" : undefined}
            />
            <text
              x={x(hour)}
              y={top + plotH + 10}
              textAnchor="middle"
              fontSize="14"
              fill="#8f7024"
            >
              {hour}:00
            </text>
          </g>
        ))}
        {sunrise !== null && (
          <line
            x1={x(sunrise)}
            y1={top}
            x2={x(sunrise)}
            y2={top + plotH}
            stroke="#b08d3e"
            strokeDasharray="2 2"
            strokeWidth="0.9"
          />
        )}
        {sunset !== null && (
          <line
            x1={x(sunset)}
            y1={top}
            x2={x(sunset)}
            y2={top + plotH}
            stroke="#b08d3e"
            strokeDasharray="2 2"
            strokeWidth="0.9"
          />
        )}
        {SEASON_ORDER.filter((s) => s !== season).map((s) => (
          <path
            key={s}
            d={pathFor(sunPath.days[s].points, x, y)}
            fill="none"
            stroke="#d9c7a8"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}
        <path
          d={selectedPath}
          fill="none"
          stroke="#a94e2a"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx={x(12)}
          cy={y(day.maxAltitudeDeg)}
          r="2.6"
          fill="#b08d3e"
          stroke="#8f7024"
          strokeWidth="0.8"
        />
        <text
          x={left + plotW}
          y={top + 10}
          textAnchor="end"
          fontSize="14"
          fill="#5e1b26"
        >
          max {day.maxAltitudeDeg.toFixed(1)}° · δ {day.declinationDeg.toFixed(1)}°
        </text>
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-1 text-sm text-muted-foreground">
        <span>
          Sunrise {sunrise === null ? "—" : `${formatHour(sunrise)}`} · Sunset{" "}
          {sunset === null ? "—" : `${formatHour(sunset)}`}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-3 rounded bg-terracotta-500" />
            selected
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-3 rounded bg-sand-300" />
            other seasons
          </span>
        </span>
      </div>
    </div>
  );
}

function pathFor(
  points: { hour: number; altitudeDeg: number }[],
  x: (hour: number) => number,
  y: (alt: number) => number,
): string {
  let d = "";
  let drawing = false;
  for (const point of points) {
    if (point.altitudeDeg <= 0) {
      drawing = false;
      continue;
    }
    d += `${drawing ? " L" : " M"} ${x(point.hour).toFixed(2)} ${y(point.altitudeDeg).toFixed(2)}`;
    drawing = true;
  }
  return d.trim();
}

function formatHour(value: number): string {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  const hh = m === 60 ? h + 1 : h;
  const mm = m === 60 ? 0 : m;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
