/*
 * Hero banner.
 *
 * The background art is USER-SUPPLIED material (app/public/bg/body-hero.webp,
 * a traditional Indian miniature print of the Govardhan-hill motif); its
 * source is unverified, so confirm usage rights before public release.
 *
 * - <ImageSlot name="body-hero" /> is the full-width hero layer behind the
 *   headline; `frame={false}` keeps the dashed placeholder chrome off the
 *   banner so a missing file degrades cleanly to the SVG heritage
 *   background. Missing/failed images never reflow: the section has
 *   explicit fixed heights per breakpoint and the wizard card stays above
 *   the fold at 1440x800.
 * - object-position crops (never stretches) the art: crest/underside of the
 *   hill reads across the top, the standing figure and his group stay
 *   visible at the right, and the headline block sits on the masked cream
 *   side, clear of the figure's face and hands.
 * - .hero-scrim (globals.css) carries the measured cream overlay
 *   (left-to-right + bottom fade into the page background); worst-case
 *   text contrast over the banner pixels at 1440x800 / 1920x1080 is
 *   headline 5.51:1, accent span 6.49:1, subtitle 8.30:1, eyebrow 12.57:1.
 */
import { KiteDivider } from "@/components/ornaments";
import ImageSlot from "@/components/image-slot";

export default function Hero() {
  return (
    <section className="relative h-[240px] w-full overflow-hidden md:h-[300px] lg:h-[340px]">
      <div aria-hidden className="absolute inset-0">
        <ImageSlot
          name="body-hero"
          className="absolute inset-0 h-full w-full"
          imgClassName="object-cover object-[100%_0%] md:object-[50%_66%] lg:object-[50%_62%]"
          frame={false}
          preload
          sizes="100vw"
        />
        <div className="hero-scrim absolute inset-0" />
      </div>
      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col items-start px-4 pt-10 md:px-8 md:pt-12">
        <p className="max-w-full rounded-sm border border-gold-500/40 bg-background px-2 py-1 text-sm font-semibold uppercase tracking-[0.16em] text-maroon-600">
          Rule-based plan synthesis
        </p>
        <h2 className="font-display mt-4 max-w-xl text-pretty text-2xl leading-tight text-maroon-500 md:text-4xl">
          Ancient wisdom. Modern engineering.{" "}
          <span className="text-maroon-600">One plan.</span>
        </h2>
        <KiteDivider className="mt-4 h-2 w-24" />
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink">
          Vastu grid · Ayadi harmony · solar alignment · IS 456 checks ·
          daylight and ventilation scoring
        </p>
      </div>
    </section>
  );
}
