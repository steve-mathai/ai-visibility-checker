import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Visibility Checker",
    short_name: "AI Visibility",
    description:
      "See how likely ChatGPT, Perplexity, Google AI Overviews and Claude are to find and cite a page.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f8",
    theme_color: "#14232b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
