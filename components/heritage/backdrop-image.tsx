"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/*
 * Fixed, full-viewport photo backdrop behind the SVG heritage layers.
 *
 * Photo is USER-SUPPLIED (public/bg/body-hero.webp) — confirm usage
 * rights before public release.
 *
 * - Decorative: alt="" / aria-hidden via the fixed container.
 * - Desktop only (the hero banner carries the art on mobile), gated on a
 *   media query plus an idle tick so the hero image always loads first.
 * - Filters/opacity live in .backdrop-photo (globals.css): ~8% opacity,
 *   sepia/desaturated into the cream palette. Opaque surfaces upstream are
 *   unaffected; the layer sits inside the z-0 fixed stack behind all content.
 * - The source is probed before the optimized <Image> renders, so a missing
 *   file never shows a broken-image icon; the SVG jaali/mandala/arch layers
 *   remain the visual. Fixed positioning → no layout shift either way.
 * - Static by design: no parallax or animation, so prefers-reduced-motion
 *   is respected.
 */
export default function BackdropImage() {
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const schedule = (cb: () => void): number =>
      idleWindow.requestIdleCallback
        ? idleWindow.requestIdleCallback(cb, { timeout: 2000 })
        : (globalThis.setTimeout(cb, 1200) as unknown as number);
    const cancel = (id: number) => {
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(id);
      else globalThis.clearTimeout(id);
    };

    let cancelled = false;
    let probe: HTMLImageElement | null = null;
    const id = schedule(() => {
      probe = new window.Image();
      probe.onload = () => {
        if (!cancelled) setEnabled(true);
      };
      probe.src = "/bg/body-hero.webp";
    });

    return () => {
      cancelled = true;
      cancel(id);
    };
  }, []);

  if (!enabled || failed) return null;

  return (
    <Image
      src="/bg/body-hero.webp"
      alt=""
      aria-hidden
      fill
      loading="lazy"
      sizes="100vw"
      className="backdrop-photo object-cover"
      onError={() => setFailed(true)}
    />
  );
}
