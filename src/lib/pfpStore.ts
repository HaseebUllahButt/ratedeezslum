import fs from "node:fs/promises";
import path from "node:path";

const CANDIDATES_FILE = path.join(process.cwd(), "data", "pfp_candidates.json");
const VERDICTS_FILE = path.join(process.cwd(), "data", "pfp_verdicts.json");

export type PfpCandidate = {
  url: string;
  score: number;
  sourceTitle: string | null;
  sourceProfile: string;
  query?: string;
  slug?: string;
  localPath?: string | null;
  // v2 additions
  sourceType?: "linkedin" | "lums" | "scholar" | "researchgate" | "orcid" | "university" | "other";
  confidence?: "high" | "medium" | "low";
  evidence?: string[];
  downloadFailed?: boolean;
};

export type PfpRecord = {
  lumsEmployeeId: string;
  name: string;
  title: string | null;
  department: string | null;
  school: string | null;
  profileUrl: string | null;
  candidates: PfpCandidate[];
  status: "found" | "found_low_confidence" | "not_found" | "retry" | "retry_bing_only" | "requeued";
  updatedAt: string;
  shard?: number;
  queriesRun?: string[];
};

export type CandidateDecision = {
  decision: "yes" | "no" | "skip";
  confidence?: number; // 1-5
  comment?: string;
};

export type Verdict = {
  lumsEmployeeId: string;
  choice: string | null; // legacy: chosen candidate url (or null = reject all) — kept for compat
  updatedAt: string;
  // v2: per-candidate yes/no/skip + overall feedback
  decisions?: Record<string, CandidateDecision>;
  comment?: string;
  overallDecision?: "yes" | "no" | "skip" | "requeue";
  requeue?: { requested: boolean; instructions?: string; updatedAt: string };
};

export type RequeueEntry = {
  lumsEmployeeId: string;
  name: string;
  instructions: string;
  requestedAt: string;
};

const PROFESSORS_FILE = path.join(process.cwd(), "data", "professors.json");

export async function readPfpRecords(): Promise<PfpRecord[]> {
  try {
    const raw = await fs.readFile(CANDIDATES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, PfpRecord>;
    const records = Object.values(parsed);
    // synthesize placeholders for missing professors not yet scraped, so reviewer sees all 134
    try {
      const profRaw = await fs.readFile(PROFESSORS_FILE, "utf8");
      const professors = JSON.parse(profRaw) as Array<{
        lumsEmployeeId: string;
        name: string;
        title: string | null;
        department: string | null;
        school: string | null;
        profileUrl: string | null;
        photoUrl: string | null;
      }>;
      const missing = professors.filter((p) => !p.photoUrl);
      const seen = new Set(records.map((r) => r.lumsEmployeeId));
      for (const p of missing) {
        if (!seen.has(String(p.lumsEmployeeId))) {
          records.push({
            lumsEmployeeId: String(p.lumsEmployeeId),
            name: p.name,
            title: p.title,
            department: p.department,
            school: p.school,
            profileUrl: p.profileUrl,
            candidates: [],
            status: "retry" as const,
            updatedAt: "— not yet scraped —",
          });
        }
      }
    } catch {
      // ignore
    }
    return records.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function readVerdicts(): Promise<Record<string, Verdict>> {
  try {
    const raw = await fs.readFile(VERDICTS_FILE, "utf8");
    return JSON.parse(raw) as Record<string, Verdict>;
  } catch {
    return {};
  }
}

export async function writeVerdict(verdict: Verdict): Promise<void> {
  const all = await readVerdicts();
  all[verdict.lumsEmployeeId] = verdict;
  const tmp = VERDICTS_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(all, null, 1), "utf8");
  await fs.rename(tmp, VERDICTS_FILE);
}

const REQUEUE_FILE = path.join(process.cwd(), "data", "pfp_requeue.json");

export async function readRequeue(): Promise<RequeueEntry[]> {
  try {
    const raw = await fs.readFile(REQUEUE_FILE, "utf8");
    return JSON.parse(raw) as RequeueEntry[];
  } catch {
    return [];
  }
}

export async function writeRequeue(entry: RequeueEntry): Promise<void> {
  const all = await readRequeue();
  const idx = all.findIndex((r) => r.lumsEmployeeId === entry.lumsEmployeeId);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  const tmp = REQUEUE_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(all, null, 1), "utf8");
  await fs.rename(tmp, REQUEUE_FILE);
}

export async function clearRequeue(lumsEmployeeId: string): Promise<void> {
  const all = await readRequeue();
  const filtered = all.filter((r) => r.lumsEmployeeId !== lumsEmployeeId);
  const tmp = REQUEUE_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(filtered, null, 1), "utf8");
  await fs.rename(tmp, REQUEUE_FILE);
}
