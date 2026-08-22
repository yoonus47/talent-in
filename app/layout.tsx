import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/navbar";
import { ThemeToggle } from "@/components/theme-toggle";
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
  title: "Talent In: Career & Skills for Indian Students",
  description:
    "A community for Indian school students (13 to 18) to build career clarity, upskill, and get job-ready, together.",
};

// Runs before paint so a previously-chosen dark theme applies with no
// flash of light mode. Light is the default — this only ever *adds* dark.
const NO_FLASH_THEME_SCRIPT = `
try {
  if (localStorage.getItem('talent-in-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
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
        <main className="flex-1">{children}</main>
        <ThemeToggle />
      </body>
    </html>
  );
}
