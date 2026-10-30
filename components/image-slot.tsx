"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageSlotProps {
  /** Slot name; the component probes /public/bg/<name>.webp. */
  name: string;
  className?: string;
  /** Extra classes for the rendered <img> (e.g. object-position tuning). */
  imgClassName?: string;
  alt?: string;
  /** Small caption painted in the placeholder frame. */
  caption?: string;
  /** Drop the dashed placeholder chrome (full-bleed banners). */
  frame?: boolean;
  /** Render a body-level preload link so the asset starts loading at t0. */
  preload?: boolean;
  /** Override the default sizes hint passed to next/image. */
  sizes?: string;
}

/**
 * Decorative image slot. Renders a heritage placeholder frame now and, once
 * /public/bg/<name>.webp exists, probes for the file at runtime and renders
 * it instead. No build step needed to add images later.
 *
 * If the file is missing (or the optimized variant later 404s) the slot degrades
 * to the shared SVG heritage background with no broken-image icon and no
 * layout shift: rendered images are absolutely positioned inside fixed-size
 * parents (explicit dimensions), so nothing reflows.
 */
export default function ImageSlot({
  name,
  className,
  imgClassName,
  alt = "",
  caption,
  frame = true,
  preload = false,
  sizes,
}: ImageSlotProps) {
  const url = `/bg/${name}.webp`;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled) setSrc(url);
    };
    probe.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      className={cn(
        frame && "relative overflow-hidden rounded-xl border border-dashed border-gold-500/40 bg-sand-50/20",
        className,
      )}
      aria-label={frame && !src ? `Image slot: ${name}` : undefined}
    >
      {preload && !src && <link rel="preload" as="image" href={url} />}
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "(max-width: 768px) 100vw, 1200px"}
          className={cn("object-cover", imgClassName)}
          priority={name === "body-hero"}
          onError={() => setSrc(null)}
        />
      ) : (
        frame && (
          <>
            <span
              className="absolute right-2 top-2 rounded border border-gold-500/30 bg-sand-50/80 px-1.5 py-0.5 font-mono text-sm uppercase tracking-wider text-gold-600"
              aria-hidden
            >
              {caption ?? `${name} · image slot`}
            </span>
            <span
              aria-hidden
              className="absolute right-2 bottom-2 text-sm uppercase tracking-[0.2em] text-gold-600"
            >
              /public/bg/{name}.webp
            </span>
          </>
        )
      )}
    </div>
  );
}
