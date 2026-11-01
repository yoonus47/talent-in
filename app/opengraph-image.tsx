import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "TalentZify: find your path, build your future";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Geist, the site's own typeface, cut to static weights (satori can't read
// the variable woff2 next/font ships). The built-in og font is Regular only,
// which is what made the first version look thin and washed out.
const geistExtraBold = await readFile(join(process.cwd(), "assets/fonts/Geist-ExtraBold.ttf"));
const geistSemiBold = await readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf"));

// CSS variables don't exist inside ImageResponse, so the palette from
// app/globals.css is repeated here: the dark-theme text gradient (rose,
// magenta, sky) for type on this dark card, the solid-fill gradient for the
// logo mark.
const TEXT_GRADIENT = "linear-gradient(100deg, #fb7185 0%, #e879f9 48%, #38bdf8 100%)";
const FILL_GRADIENT = "linear-gradient(135deg, #e11d48 0%, #c026d3 55%, #6366f1 100%)";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#090912",
          fontFamily: "Geist",
          color: "white",
        }}
      >
        {/* Colored light pooling in from three corners. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: [
              "radial-gradient(circle at 0px 0px, rgba(225, 29, 72, 0.55) 0px, rgba(225, 29, 72, 0) 640px)",
              "radial-gradient(circle at 1200px 630px, rgba(99, 102, 241, 0.6) 0px, rgba(99, 102, 241, 0) 700px)",
              "radial-gradient(circle at 1020px 30px, rgba(192, 38, 211, 0.35) 0px, rgba(192, 38, 211, 0) 480px)",
            ].join(", "),
          }}
        />

        {/* The path: rising curve, ending in a glowing node. */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <defs>
            <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fb7185" stopOpacity="0" />
              <stop offset="0.45" stopColor="#e879f9" stopOpacity="0.9" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>
            <radialGradient id="glow">
              <stop offset="0" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            d="M 380 585 C 560 585 640 540 760 480 S 960 330 1086 250"
            fill="none"
            stroke="url(#trail)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="760" cy="480" r="9" fill="#e879f9" />
          <circle cx="1086" cy="250" r="58" fill="url(#glow)" />
          <circle cx="1086" cy="250" r="15" fill="white" />
        </svg>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            padding: "64px 76px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                backgroundImage: FILL_GRADIENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                fontWeight: 800,
                color: "white",
              }}
            >
              T
            </div>
            <div
              style={{
                marginLeft: 16,
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: -1,
              }}
            >
              TalentZify
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 54 }}>
            <div
              style={{
                fontSize: 100,
                fontWeight: 800,
                letterSpacing: -4,
                lineHeight: 1.04,
              }}
            >
              Find your path.
            </div>
            <div
              style={{
                fontSize: 100,
                fontWeight: 800,
                letterSpacing: -4,
                lineHeight: 1.04,
                // paddingBottom keeps descenders inside the clipped box.
                paddingBottom: 8,
                color: "transparent",
                backgroundImage: TEXT_GRADIENT,
                backgroundClip: "text",
              }}
            >
              Build your future.
            </div>
          </div>

          <div
            style={{
              marginTop: 26,
              fontSize: 30,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.72)",
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.35,
            }}
          >
            <div>Career clarity, real skills and a community</div>
            <div>for students aged 13 to 18.</div>
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.55)",
              letterSpacing: 0.5,
            }}
          >
            talentzify.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistSemiBold, style: "normal", weight: 600 },
        { name: "Geist", data: geistExtraBold, style: "normal", weight: 800 },
      ],
    },
  );
}
