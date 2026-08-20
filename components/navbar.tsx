import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentProfile } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";

export async function Navbar() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const links = [
    { href: "/feed", label: "Feed" },
    { href: "/discover", label: "Discover" },
    { href: "/quiz", label: "Career Quiz" },
    { href: `/profile/${profile.username}`, label: "Profile" },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/feed" className="ig-gradient-text text-lg font-bold">
          Talent In
        </Link>

        <div className="hidden items-center gap-5 text-sm font-medium text-muted-foreground sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings" title="Settings">
            <Avatar name={profile.full_name} src={profile.avatar_url} size={32} />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </nav>
      <div className="flex items-center justify-center gap-5 border-t border-border py-2 text-sm font-medium text-muted-foreground sm:hidden">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
