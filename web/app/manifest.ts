import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cowrie",
    short_name: "Cowrie",
    description: "Talk to your money. Programmable, gasless stablecoin money on Monad.",
    start_url: "/",
    display: "standalone",
    background_color: "#171030",
    theme_color: "#171030",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
