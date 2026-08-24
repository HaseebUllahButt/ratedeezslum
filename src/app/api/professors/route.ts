import { listProfessors, countFilteredProfessors } from "@/lib/db";
import type { SortKey } from "@/lib/db";

const VALID_SORTS = new Set<SortKey>(["highest", "lowest", "most-reviewed", "name"]);
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const school = searchParams.get("school")?.trim() || undefined;
  const rawSort = searchParams.get("sort") as SortKey | null;
  const sort: SortKey = rawSort && VALID_SORTS.has(rawSort) ? rawSort : "name";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [professors, total] = await Promise.all([
    listProfessors({ q, school, sort, limit, offset }),
    countFilteredProfessors({ q, school }),
  ]);

  const hasMore = offset + professors.length < total;

  return Response.json({ professors, total, limit, offset, hasMore, sort });
}
