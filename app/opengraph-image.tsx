import { ImageResponse } from "next/og";

export const alt =
  "Glass Box — click a real control and watch a real backend react";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card, generated at build time.
 *
 * Recruiters open a shared link on a phone first, so the card is the first
 * impression. It reuses the site's palette — void base, cyan nominal, fuchsia
 * action — and mimics the hairline-flat panel rather than a marketing banner.
 * No custom font is loaded; ImageResponse's default keeps the build self
 * contained.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#08090b",
        padding: 72,
        border: "1px solid #1e2227",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 14, height: 14, background: "#34d8e8" }} />
        <div
          style={{
            color: "#79808a",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          Glass Box · nominal
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            color: "#e8eaed",
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          One box.
        </div>
        <div
          style={{
            color: "#e8eaed",
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          Every layer visible.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          color: "#9ba1a9",
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Click a real control. Watch a real backend react.</span>
          <span style={{ color: "#79808a", fontSize: 22 }}>
            Every number is measured — copy the curl and check it.
          </span>
        </div>
        <div style={{ color: "#f42bb0", fontSize: 24 }}>evict search:*</div>
      </div>
    </div>,
    size,
  );
}
