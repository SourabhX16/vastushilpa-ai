import { KiteDivider } from "@/components/ornaments";

export default function SiteFooter() {
  return (
    <footer className="z-10 mt-12 border-t border-gold-500/30 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center md:px-8">
        <KiteDivider className="h-2 w-28" />
        <p className="text-sm font-semibold text-ink">
          Preliminary design. Must be verified by a licensed structural
          engineer.
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Vastushilpa AI is a hackathon prototype. Plans are generated from
          rule-based scoring, not construction documents. Light and energy
          results are estimated; every rule cites its source and unverified
          rules are visibly flagged.
        </p>
      </div>
    </footer>
  );
}
