import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Concierge",
    short_name: "Concierge",
    description: "Finds things to do in your open time, wherever you are.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#1f5f4a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
