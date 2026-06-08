import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Legends Inventory Transfers",
    short_name: "Pulls",
    description:
      "Internal tool for tracking inventory pulls between Legends stores and the warehouse",
    start_url: "/feed",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    icons: [
      // Next.js auto-generates these from src/app/icon.tsx and apple-icon.tsx
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
