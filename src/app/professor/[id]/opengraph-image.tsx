import { ImageResponse } from "next/og";
import { getProfessor } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";

export const alt = "LUMS professor rating";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social scrapers re-fetch these often; serve from the CDN instead of Neon.
export const revalidate = 3600;

function stars(avg: number): string {
  const filled = Math.round(avg);
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = Number.isInteger(Number(id)) ? await getProfessor(Number(id)) : undefined;
  const name = professor?.name ?? "LUMS Faculty";
  const subtitle =
    [professor?.title, professor?.department].filter(Boolean).join(" · ") ||
    professor?.school ||
    "Lahore University of Management Sciences";
  const rated = (professor?.review_count ?? 0) > 0 && professor?.avg_rating != null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: "68px",
        }}
      >
        <div style={{ display: "flex", height: "12px", backgroundColor: "#ffb300" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 700,
              color: "#04198b",
              lineHeight: 1.15,
            }}
          >
            {name.length > 44 ? `${name.slice(0, 44)}…` : name}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#475569", marginTop: "16px" }}>
            {subtitle.length > 70 ? `${subtitle.slice(0, 70)}…` : subtitle}
          </div>

          {rated ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "22px",
                marginTop: "40px",
              }}
            >
              <div style={{ display: "flex", fontSize: 60, color: "#ffb300" }}>
                {stars(professor!.avg_rating!)}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 52,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {professor!.avg_rating!.toFixed(1)}/5
              </div>
              <div style={{ display: "flex", fontSize: 30, color: "#64748b" }}>
                {professor!.review_count} review{professor!.review_count === 1 ? "" : "s"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 34, color: "#64748b", marginTop: "40px" }}>
              No student reviews yet — be the first to rate.
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid #e2e8f0",
            paddingTop: "26px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              color: "#17223e",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {SITE_NAME}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#64748b" }}>
            Anonymous LUMS student ratings
          </div>
        </div>
      </div>
    ),
    size
  );
}
