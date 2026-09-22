import { ImageResponse } from "next/og";
import { countProfessors, countReviews } from "@/lib/db";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const revalidate = 3600;

export default async function Image() {
  const [totalProfessors, totalReviews] = await Promise.all([
    countProfessors(),
    countReviews(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#17223e",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", height: "10px", backgroundColor: "#ffb300" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              color: "#ffb300",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              color: "#ffffff",
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: "18px",
            }}
          >
            LUMS Professor
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              color: "#ffffff",
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Ratings &amp; Reviews
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: "#ffb300",
              color: "#17223e",
              fontSize: 30,
              fontWeight: 700,
              padding: "12px 24px",
            }}
          >
            {totalProfessors} professors
          </div>
          <div
            style={{
              display: "flex",
              border: "2px solid rgba(255,255,255,0.35)",
              color: "#ffffff",
              fontSize: 30,
              padding: "12px 24px",
            }}
          >
            {/* "0 student reviews" is a weak share card - invite instead. */}
            {totalReviews > 0
              ? `${totalReviews} student review${totalReviews === 1 ? "" : "s"}`
              : "Rate yours anonymously"}
          </div>
        </div>
      </div>
    ),
    size
  );
}
