import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vastushilpa AI",
    short_name: "Vastushilpa",
    description:
      "Ancient wisdom. Modern engineering. One plan. Vastu-aligned house plans with IS 456 structural checks.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3EBDD",
    theme_color: "#5F2B1C",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
