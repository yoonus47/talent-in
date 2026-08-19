import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
