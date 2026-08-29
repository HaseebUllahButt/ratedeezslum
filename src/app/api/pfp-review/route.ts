import { readPfpRecords, readVerdicts, writeVerdict, writeRequeue } from "@/lib/pfpStore";
import type { Verdict, CandidateDecision } from "@/lib/pfpStore";

export async function GET() {
  const [records, verdicts] = await Promise.all([readPfpRecords(), readVerdicts()]);
  const { readRequeue } = await import("@/lib/pfpStore");
  const requeue = await readRequeue();
  return Response.json({ records, verdicts, requeue });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    lumsEmployeeId,
    choice,
    decisions,
    comment,
    overallDecision,
    requeueInstructions,
  } = (body ?? {}) as Record<string, unknown>;

  if (typeof lumsEmployeeId !== "string" || !lumsEmployeeId.trim()) {
    return Response.json({ error: "lumsEmployeeId is required" }, { status: 400 });
  }

  // legacy choice validation (optional now — v2 uses decisions)
  if (choice !== undefined && choice !== null && typeof choice !== "string") {
    return Response.json(
      { error: "choice must be a candidate URL string or null to reject all" },
      { status: 400 }
    );
  }

  // validate decisions if provided
  let normalizedDecisions: Record<string, CandidateDecision> | undefined;
  if (decisions !== undefined && decisions !== null) {
    if (typeof decisions !== "object" || Array.isArray(decisions)) {
      return Response.json({ error: "decisions must be an object" }, { status: 400 });
    }
    normalizedDecisions = {};
    for (const [k, v] of Object.entries(decisions as Record<string, unknown>)) {
      const d = v as Record<string, unknown>;
      if (!d || !["yes", "no", "skip"].includes(String(d.decision))) {
        return Response.json({ error: `invalid decision for ${k}` }, { status: 400 });
      }
      const conf = d.confidence;
      if (conf !== undefined && (typeof conf !== "number" || conf < 1 || conf > 5)) {
        return Response.json({ error: `confidence 1-5 required for ${k}` }, { status: 400 });
      }
      normalizedDecisions[k] = {
        decision: d.decision as CandidateDecision["decision"],
        confidence: typeof conf === "number" ? conf : undefined,
        comment: typeof d.comment === "string" ? d.comment.slice(0, 1000) : undefined,
      };
    }
  }

  if (choice !== undefined && choice !== null) {
    const records = await readPfpRecords();
    const record = records.find((r) => r.lumsEmployeeId === lumsEmployeeId);
    if (!record) {
      return Response.json({ error: "Unknown professor" }, { status: 404 });
    }
    const ok = record.candidates.some((c) => c.url === choice || c.localPath === choice);
    if (!ok) {
      return Response.json({ error: "choice is not a known candidate" }, { status: 400 });
    }
  }

  // build merged verdict: keep existing fields not being overwritten
  const existing = (await readVerdicts())[lumsEmployeeId as string];
  const verdict: Verdict = {
    lumsEmployeeId: lumsEmployeeId as string,
    choice: (choice as string | null) ?? existing?.choice ?? null,
    decisions: normalizedDecisions ?? existing?.decisions,
    comment: typeof comment === "string" ? comment.slice(0, 5000) : existing?.comment,
    overallDecision: (overallDecision as Verdict["overallDecision"]) ?? existing?.overallDecision,
    requeue: existing?.requeue,
    updatedAt: new Date().toISOString(),
  };

  // handle requeue request -> also write to pfp_requeue.json
  if (typeof requeueInstructions === "string" && requeueInstructions.trim()) {
    const records = await readPfpRecords();
    const rec = records.find((r) => r.lumsEmployeeId === lumsEmployeeId);
    verdict.requeue = {
      requested: true,
      instructions: requeueInstructions.slice(0, 5000),
      updatedAt: new Date().toISOString(),
    };
    verdict.overallDecision = "requeue";
    await writeRequeue({
      lumsEmployeeId: lumsEmployeeId as string,
      name: rec?.name ?? lumsEmployeeId as string,
      instructions: requeueInstructions.slice(0, 5000),
      requestedAt: new Date().toISOString(),
    });
  } else if (overallDecision === "requeue") {
    // allow clearing? keep as-is
  }

  await writeVerdict(verdict);
  return Response.json({ verdict });
}
