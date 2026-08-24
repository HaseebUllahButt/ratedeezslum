import { readPfpRecords, readVerdicts, writeVerdict } from "@/lib/pfpStore";

export async function GET() {
  const [records, verdicts] = await Promise.all([readPfpRecords(), readVerdicts()]);
  return Response.json({ records, verdicts });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lumsEmployeeId, choice } = (body ?? {}) as Record<string, unknown>;
  if (typeof lumsEmployeeId !== "string" || !lumsEmployeeId.trim()) {
    return Response.json({ error: "lumsEmployeeId is required" }, { status: 400 });
  }
  if (choice !== null && typeof choice !== "string") {
    return Response.json(
      { error: "choice must be a candidate URL string or null to reject all" },
      { status: 400 }
    );
  }

  if (choice !== null) {
    const records = await readPfpRecords();
    const record = records.find((r) => r.lumsEmployeeId === lumsEmployeeId);
    if (!record) {
      return Response.json({ error: "Unknown professor" }, { status: 404 });
    }
    const ok = record.candidates.some(
      (c) => c.url === choice || c.localPath === choice
    );
    if (!ok) {
      return Response.json({ error: "choice is not a known candidate" }, { status: 400 });
    }
  }

  const verdict = {
    lumsEmployeeId,
    choice,
    updatedAt: new Date().toISOString(),
  };
  await writeVerdict(verdict);
  return Response.json({ verdict });
}
