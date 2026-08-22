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
};

export const ROLES: Role[] = [
  {
    slug: "student",
    label: "Student",
    description: "Career guidance, real skills, and a network of peers — ages 13–18.",
    icon: GraduationCap,
    href: "/student",
    ready: true,
  },
  {
    slug: "teacher",
    label: "Teacher",
    description: "Guide students, share resources, track their progress.",
    icon: Presentation,
    href: "/coming-soon?role=Teacher",
    ready: false,
  },
  {
    slug: "parent",
    label: "Parent",
    description: "Stay involved in your child's career and skills journey.",
    icon: Users,
    href: "/coming-soon?role=Parent",
    ready: false,
  },
  {
    slug: "school-admin",
    label: "School Admin",
    description: "Manage your school's students and presence on Talent In.",
    icon: School,
    href: "/coming-soon?role=School+Admin",
    ready: false,
  },
  {
    slug: "institute-admin",
    label: "Education Institute Admin",
    description: "Administer your institute's programs and outreach.",
    icon: Building2,
    href: "/coming-soon?role=Education+Institute+Admin",
    ready: false,
  },
  {
    slug: "admin",
    label: "Admin",
    description: "Platform-wide administration and oversight.",
    icon: ShieldCheck,
    href: "/coming-soon?role=Admin",
    ready: false,
  },
];
