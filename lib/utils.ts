import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turns "Ananya Sharma" into "AS" for avatar fallbacks. */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// A handful of neon shades — bright enough to pop on both light and dark
// backgrounds, dark text reads fine on all of them.
const NEON_COLORS = [
  "#ff2d95", // neon pink
  "#39ff14", // neon green
  "#00e5ff", // neon cyan
  "#f9f002", // neon yellow
  "#ff6f00", // neon orange
  "#bc13fe", // neon purple
  "#04d9ff", // neon blue
  "#ff073a", // neon red
];

/** Deterministically picks a neon color for a user's avatar fallback. */
export function neonAvatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return NEON_COLORS[hash % NEON_COLORS.length];
}

const CATEGORY_LABELS: Record<string, string> = {
  career_guidance: "Career Guidance",
  upskilling: "Upskilling",
  job_readiness: "Job Readiness",
  tech_skills: "Tech Skills",
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [secondsInUnit, label] of units) {
    const value = Math.floor(seconds / secondsInUnit);
    if (value >= 1) return `${value}${label} ago`;
  }
  return "just now";
}
