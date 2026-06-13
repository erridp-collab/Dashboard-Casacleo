import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alva Host Manager",
    short_name: "Alva Host",
    description: "Gestionale Operativo Affitti Brevi",
    start_url: "/",
    display: "standalone",
    background_color: "#fefce8",
    theme_color: "#701a2f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
