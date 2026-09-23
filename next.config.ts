import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets `npm run dev` be opened from another device on the same Wi-Fi
  // (e.g. a phone, to preview on a real screen instead of just this
  // browser pane) via the "Network:" URL `next dev` prints on startup.
  // Dev-only — has no effect on the deployed app. If your machine's LAN
  // IP changes (different network, router reboot), update this to match
  // whatever new IP `next dev`'s own startup log shows.
  allowedDevOrigins: ["192.168.1.108"],
  experimental: {
    serverActions: {
      // Next.js caps Server Action request bodies at 1MB by default — too
      // small for our post images (5MB cap) or avatars (3MB cap), both
      // submitted as multipart/form-data straight into a Server Action.
      // Any real photo silently failed to attach because of this, even
      // after the image validated fine client-side.
      bodySizeLimit: "8mb",
    },
  },
  images: {
    // Next.js 16 requires qualities to be explicitly allow-listed — the
    // default is [75] only, so any other value silently snaps back to 75.
    // 60 = feed thumbnails, 90 = the tap-to-open lightbox.
    qualities: [60, 90],
    remotePatterns: [
      // Supabase Storage serves avatars/uploads from <project-ref>.supabase.co —
      // widen/narrow this once you know your project's hostname.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // The seeded demo posts' images point here — keep them working
      // through next/image too instead of special-casing them out.
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
