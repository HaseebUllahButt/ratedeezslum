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
  localPath?: string;
};

export type PfpRecord = {
  lumsEmployeeId: string;
  name: string;
  title: string | null;
  department: string | null;
  school: string | null;
  profileUrl: string | null;
  candidates: PfpCandidate[];
  status: "found" | "not_found" | "retry";
  updatedAt: string;
};

export type Verdict = {
  lumsEmployeeId: string;
  choice: string | null;
  updatedAt: string;
};

export async function readPfpRecords(): Promise<PfpRecord[]> {
  try {
    const raw = await fs.readFile(CANDIDATES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, PfpRecord>;
    return Object.values(parsed).sort((a, b) => a.name.localeCompare(b.name));
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
