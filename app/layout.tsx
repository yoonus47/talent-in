import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/navbar";
import { ChatFab } from "@/components/chat-fab";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SwipeNavigator } from "@/components/swipe-navigator";
import { BrandSplash } from "@/components/brand-splash";
import { getCurrentProfile } from "@/lib/data";
import { getNavRoutes } from "@/lib/nav-links";
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
        {/* pb-32 clears the mobile bottom tab bar plus the floating
            ChatFabButton stacked above it (see components/mobile-tab-
            bar.tsx and components/chat-fab-button.tsx) — neither reserves
            its own space, so page content needs a floor here or its last
            bit ends up hidden/unclickable underneath them. Desktop has no
            tab bar and a lower-riding FAB, so it needs much less. */}
        <main className="flex-1 pb-32 sm:pb-10">
          <SwipeNavigator links={navRoutes}>{children}</SwipeNavigator>
        </main>
        <ChatFab />
        <MobileTabBar />
        {/* useSearchParams requires a Suspense boundary; see
            components/brand-splash.tsx for what this actually shows and
            when. */}
        <Suspense fallback={null}>
          <BrandSplash />
        </Suspense>
      </body>
    </html>
  );
}
