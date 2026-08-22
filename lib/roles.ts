import {
  Building2,
  GraduationCap,
  Presentation,
  School,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Role = {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  ready: boolean;
  /** CSS gradient for the card's icon badge — each role gets its own. */
  gradient: string;
  /** Representative color for the hover glow shadow. */
  glow: string;
};

export const ROLES: Role[] = [
  {
    slug: "student",
    label: "Student",
    description: "Career guidance, real skills, and a network of peers, ages 13 to 18.",
    icon: GraduationCap,
    href: "/student",
    ready: true,
    gradient: "linear-gradient(135deg, #6366f1, #a855f7)",
    glow: "#8b5cf6",
  },
  {
    slug: "teacher",
    label: "Teacher",
    description: "Guide students, share resources, track their progress.",
    icon: Presentation,
    href: "/coming-soon?role=Teacher",
    ready: false,
    gradient: "linear-gradient(135deg, #3b82f6, #22d3ee)",
    glow: "#22d3ee",
  },
  {
    slug: "parent",
    label: "Parent",
    description: "Stay involved in your child's career and skills journey.",
    icon: Users,
    href: "/coming-soon?role=Parent",
    ready: false,
    gradient: "linear-gradient(135deg, #ec4899, #f97316)",
    glow: "#ec4899",
  },
  {
    slug: "school-admin",
    label: "School Admin",
    description: "Manage your school's students and presence on Talent In.",
    icon: School,
    href: "/coming-soon?role=School+Admin",
    ready: false,
    gradient: "linear-gradient(135deg, #10b981, #14b8a6)",
    glow: "#10b981",
  },
  {
    slug: "institute-admin",
    label: "Institute Admin",
    description: "Administer your institute's programs and outreach.",
    icon: Building2,
    href: "/coming-soon?role=Institute+Admin",
    ready: false,
    gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
    glow: "#f59e0b",
  },
  {
    slug: "admin",
    label: "Admin",
    description: "Platform wide administration and oversight.",
    icon: ShieldCheck,
    href: "/coming-soon?role=Admin",
    ready: false,
    gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)",
    glow: "#d946ef",
  },
];
