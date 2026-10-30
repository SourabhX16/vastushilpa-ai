import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCityById } from "@/lib/data/cities";
import { UnverifiedBadge } from "./unverified-badge";

interface CityInfoCardProps {
  cityId: string;
}

/** Climate / seismic context card for the selected city. */
export function CityInfoCard({ cityId }: CityInfoCardProps) {
  const city = cityId ? getCityById(cityId) : undefined;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-maroon-500">
          <MapPin className="h-4 w-4 text-gold-600" aria-hidden />
          {city ? `${city.name} — site context` : "Site context"}
        </CardTitle>
        {city && !city.verified && <UnverifiedBadge label="Unverified" tooltip="City data is compiled from unverified sources — verify before relying on it." />}
      </CardHeader>
      <CardContent>
        {!city ? (
          <p className="rounded-lg border border-dashed border-gold-500/40 bg-card/60 p-4 text-sm text-muted-foreground">
            Select a city to load latitude, climate zone, seismic zone and weather
            context.
          </p>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Detail label="Latitude" value={`${city.latitude.toFixed(2)}° N`} />
              <Detail label="Longitude" value={`${city.longitude.toFixed(2)}° E`} />
              <Detail label="Climate zone" value={city.climateZone} />
              <Detail label="Seismic zone" value={`Zone ${city.seismicZone}`} />
              <Detail
                label="Summer / winter"
                value={`${city.avgSummerTempC}°C / ${city.avgWinterTempC}°C`}
              />
              <Detail label="Humidity" value={`${city.avgRelativeHumidityPct}%`} />
              <Detail label="Rainfall" value={`≈ ${city.annualRainfallMm} mm/yr`} />
              <Detail label="Prevailing wind" value={city.prevailingWind} />
            </dl>
            {city.notes && (
              <p className="border-t border-gold-500/20 pt-2 text-sm italic text-muted-foreground">
                Note: {city.notes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gold-500/10 pb-1 sm:block sm:border-b-0">
      <dt className="text-sm uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize text-ink sm:text-sm">{value}</dd>
    </div>
  );
}
