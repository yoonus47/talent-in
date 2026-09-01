import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    // Supabase Storage serves avatars/uploads from <project-ref>.supabase.co —
    // widen/narrow this once you know your project's hostname.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
