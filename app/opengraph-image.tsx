import { ImageResponse } from "next/og";

export const alt = "TalentZify: find your path, build your future";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview students see when sharing talentzify.com in WhatsApp,
// Instagram, etc. Same rose, magenta, indigo stops as --gradient-brand in
// app/globals.css (CSS variables aren't available inside ImageResponse).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e11d48 0%, #c026d3 50%, #6366f1 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4 }}>TalentZify</div>
        <div style={{ marginTop: 20, fontSize: 52, fontWeight: 600 }}>
          Find your path. Build your future.
        </div>
        <div style={{ marginTop: 28, fontSize: 32, opacity: 0.85 }}>
          Career guidance, real skills, and a community for students aged 13 to 18
        </div>
      </div>
    ),
    { ...size },
  );
}
