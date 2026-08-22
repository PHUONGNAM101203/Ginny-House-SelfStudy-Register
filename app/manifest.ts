import type { MetadataRoute } from "next"

// Enables "Add to Home Screen" / desktop install — required for push
// notifications to work at all on iOS Safari (Apple only grants Notification
// permission to an installed PWA, never to a regular browser tab). Icons
// reuse the same navy-background Ginny House mark as app/icon.png so the
// installed app icon matches the browser tab favicon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ginny House Self-Study Register",
    short_name: "Ginny House",
    description: "Đăng ký góc tự học cho học sinh Ginny House",
    start_url: "/noi-bo/lich",
    display: "standalone",
    background_color: "#022B9D",
    theme_color: "#022B9D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
