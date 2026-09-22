import PfpReviewClient from "@/components/PfpReviewClient";
import { readPfpRecords, readVerdicts } from "@/lib/pfpStore";

import type { Metadata } from "next";

// Internal triage tool - no public search value, and it exposes unreviewed data.
export const metadata: Metadata = {
  title: "PFP Review",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PfpReviewPage() {
  const [records, verdicts] = await Promise.all([readPfpRecords(), readVerdicts()]);
  return <PfpReviewClient initialRecords={records} initialVerdicts={verdicts} />;
}
