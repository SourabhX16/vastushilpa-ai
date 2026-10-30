import { WordmarkOrnament } from "@/components/ornaments";
import { Badge } from "@/components/ui/badge";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gold-500/30 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-8">
        <WordmarkOrnament className="h-8 w-8 shrink-0" />
        <div className="leading-tight">
          <h1 className="font-display text-lg tracking-wide text-maroon-500">
            Vastushilpa AI
          </h1>
          <p className="font-devanagari text-[11px] text-muted-foreground">
            वास्तुशिल्प · शिल्प शास्त्र
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-gold-500/60 font-medium text-gold-600"
          >
            Hackathon prototype
          </Badge>
        </div>
      </div>
    </header>
  );
}
