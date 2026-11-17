import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#141221",
          backgroundImage: "radial-gradient(ellipse at top, rgba(97,74,207,0.35), transparent 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#614acf",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: "4px solid white" }} />
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "white" }}>
            Search <span style={{ color: "#a996f2", fontStyle: "italic", marginLeft: 10 }}>Mind</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "white", maxWidth: 900, lineHeight: 1.15 }}>
          L&apos;observatoire SEO qui traduit vos données en actions.
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#b8b3cf", marginTop: 28 }}>
          Audit technique · Mots-clés · Backlinks · Assistant IA · Visibilité GEO
        </div>
      </div>
    ),
    { ...size }
  );
}
