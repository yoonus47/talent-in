import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/navbar";
import { ChatFab } from "@/components/chat-fab";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SwipeNavigator } from "@/components/swipe-navigator";
import { BrandSplash } from "@/components/brand-splash";
import { ReferralBonusToast } from "@/components/referral-bonus-toast";
import { APP_VERSION, VersionBadge } from "@/components/version-badge";
import { getCurrentProfile } from "@/lib/data";
import { getNavRoutes } from "@/lib/nav-links";
import { touchLastActive } from "@/lib/actions/profile";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TalentZify: Career & Skills for Indian Students",
  description:
    "A community for Indian school students (13 to 18) to build career clarity, upskill, and get job-ready, together.",
};

// Runs before paint so a previously-chosen dark theme applies with no
// flash of light mode. Light is the default — this only ever *adds* dark.
const NO_FLASH_THEME_SCRIPT = `
try {
  if (localStorage.getItem('talentzify-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch (e) {}
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Same tab order Navbar renders (lib/nav-links.ts) — getCurrentProfile
  // is cache()-wrapped, so this doesn't cost a second Supabase round trip
  // on top of Navbar's own call.
  const profile = await getCurrentProfile();
  const navRoutes = profile ? getNavRoutes(profile.username) : [];

  // Owner-side monitoring only — see touchLastActive's own comment. A
  // failure here should never take a page down with it, same reasoning
  // as e.g. app/community/[id]/page.tsx's markCommunityThreadRead.
  if (profile) {
    try {
      await touchLastActive(profile.id);
    } catch (err) {
      console.error("touchLastActive failed:", err);
    }
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="no-flash-theme" strategy="beforeInteractive">
          {NO_FLASH_THEME_SCRIPT}
        </Script>
        <Navbar />
        {/* pb-32 clears the bottom tab bar plus the floating ChatFabButton
            stacked above it (see components/mobile-tab-bar.tsx and
            components/chat-fab-button.tsx) — neither reserves its own
            space, so page content needs a floor here or its last bit ends
            up hidden/unclickable underneath them. Matches NavLinks' own
            lg breakpoint (components/nav-links.tsx) for where the tab bar
            actually stops rendering — true desktop widths have no tab bar
            and a lower-riding FAB, so they need much less. */}
        <main className="flex-1 pb-32 lg:pb-10">
          <SwipeNavigator links={navRoutes}>{children}</SwipeNavigator>
        </main>
        <ChatFab />
        <MobileTabBar />
        {/* Desktop-only counterpart to the mobile version badge rendered
            inline in components/navbar.tsx — at lg+ that navbar has no
            spare room for it (nav pills own the middle, wordmark/bell/
            avatar own the edges), so it lives here instead as a fixed
            corner watermark, well clear of ChatFabButton's own
            bottom-right spot. Same subtle style as the mobile badge (a
            louder, bigger-type two-line card briefly replaced it here but
            read as too loud), just a longer caption — there's room for
            it in this corner that the mobile navbar gap doesn't have. */}
        {profile && (
          <VersionBadge className="fixed bottom-4 left-4 z-30 hidden max-w-[240px] lg:inline-flex">
            Alpha v{APP_VERSION}. This is a pre-release version. You may encounter bugs, unstable
            features or unexpected behavior.
          </VersionBadge>
        )}
        {/* useSearchParams requires a Suspense boundary; see
            components/brand-splash.tsx and components/referral-bonus-
            toast.tsx for what these actually show and when. */}
        <Suspense fallback={null}>
          <BrandSplash />
          <ReferralBonusToast />
        </Suspense>
      </body>
    </html>
  );
}
