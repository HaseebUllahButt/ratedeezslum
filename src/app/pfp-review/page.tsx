import PfpReviewClient from "@/components/PfpReviewClient";
import { readPfpRecords, readVerdicts } from "@/lib/pfpStore";

export const metadata = {
  title: "PFP Review | RateDeezLums",
};

export default async function PfpReviewPage() {
  const [records, verdicts] = await Promise.all([readPfpRecords(), readVerdicts()]);
  return <PfpReviewClient initialRecords={records} initialVerdicts={verdicts} />;
}
