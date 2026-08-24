import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.local.example)");
}

export const sql = neon(DATABASE_URL);

export type Professor = {
  id: number;
  lums_employee_id: string;
  name: string;
  title: string | null;
  department: string | null;
  school: string | null;
  photo_url: string | null;
  profile_url: string | null;
};

export type Review = {
  id: number;
  professor_id: number;
  course: string | null;
  rating: number;
  difficulty: number;
  would_take_again: boolean;
  comment: string;
  created_at: string;
};

export type ProfessorWithStats = Professor & {
  review_count: number;
  avg_rating: number | null;
  avg_difficulty: number | null;
  would_take_again_pct: number | null;
};

const STATS_SELECT = `
  SELECT
    p.*,
    COUNT(r.id)::int AS review_count,
    AVG(r.rating)::float AS avg_rating,
    AVG(r.difficulty)::float AS avg_difficulty,
    (AVG(CASE WHEN r.id IS NULL THEN NULL WHEN r.would_take_again THEN 1.0 ELSE 0.0 END) * 100)::float AS would_take_again_pct
  FROM professors p
  LEFT JOIN reviews r ON r.professor_id = p.id
`;

export async function countProfessors(): Promise<number> {
  const rows = (await sql`SELECT COUNT(*)::int AS c FROM professors`) as { c: number }[];
  return rows[0].c;
}

export async function countFilteredProfessors(opts: { q?: string; school?: string }): Promise<number> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (opts.q) {
    clauses.push(`(p.name ILIKE $${idx} OR p.department ILIKE $${idx} OR p.school ILIKE $${idx})`);
    params.push(`%${opts.q}%`);
    idx++;
  }
  if (opts.school) {
    clauses.push(`p.school = $${idx}`);
    params.push(opts.school);
    idx++;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const text = `SELECT COUNT(*)::int AS c FROM professors p ${where}`;
  const rows = await sql.query(text, params);
  return (rows as { c: number }[])[0].c;
}

export async function listSchools(): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT school FROM professors WHERE school IS NOT NULL ORDER BY school ASC`;
  return (rows as { school: string }[]).map((r) => r.school);
}

export async function countReviews(): Promise<number> {
  const rows = (await sql`SELECT COUNT(*)::int AS c FROM reviews`) as { c: number }[];
  return rows[0].c;
}

export type SortKey = "highest" | "lowest" | "most-reviewed" | "name";

export type ListProfessorsOpts = {
  q?: string;
  school?: string;
  sort?: SortKey;
  limit?: number;
  offset?: number;
};

function buildOrderBy(sort: SortKey = "name"): string {
  switch (sort) {
    case "highest":
      return "ORDER BY avg_rating DESC NULLS LAST, review_count DESC, p.name ASC";
    case "lowest":
      return "ORDER BY avg_rating ASC NULLS LAST, review_count DESC, p.name ASC";
    case "most-reviewed":
      return "ORDER BY review_count DESC, avg_rating DESC NULLS LAST, p.name ASC";
    case "name":
    default:
      return "ORDER BY p.name ASC";
  }
}

/**
 * Paginated professor listing. All filters/sorting happen server-side so a single
 * small Neon query is needed per page. Defaults protect Neon from huge scans.
 */
export async function listProfessors(
  queryOrOpts?: string | ListProfessorsOpts,
  maybeOpts?: ListProfessorsOpts
): Promise<ProfessorWithStats[]> {
  // backwards-compat: listProfessors("search") -> { q: "search" }
  let opts: ListProfessorsOpts;
  if (typeof queryOrOpts === "string") {
    opts = { q: queryOrOpts, ...(maybeOpts ?? {}) };
  } else {
    opts = queryOrOpts ?? {};
  }

  const q = opts.q?.trim() || undefined;
  const school = opts.school?.trim() || undefined;
  const sort: SortKey = opts.sort ?? "name";
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);

  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (q) {
    clauses.push(`(p.name ILIKE $${idx} OR p.department ILIKE $${idx} OR p.school ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (school) {
    clauses.push(`p.school = $${idx}`);
    params.push(school);
    idx++;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy = buildOrderBy(sort);

  // limit/offset are appended last and always parameterized to avoid injection
  const text = `
    ${STATS_SELECT}
    ${where}
    GROUP BY p.id
    ${orderBy}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);
  const rows = await sql.query(text, params);
  return rows as ProfessorWithStats[];
}

export async function getProfessor(id: number): Promise<ProfessorWithStats | undefined> {
  const rows = await sql.query(`${STATS_SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]);
  return (rows as ProfessorWithStats[])[0];
}

export async function listReviewsForProfessor(professorId: number): Promise<Review[]> {
  const rows = await sql.query(
    `SELECT * FROM reviews WHERE professor_id = $1 ORDER BY created_at DESC`,
    [professorId]
  );
  return rows as Review[];
}

export async function insertReview(input: {
  professorId: number;
  course: string | null;
  rating: number;
  difficulty: number;
  wouldTakeAgain: boolean;
  comment: string;
}): Promise<Review> {
  const rows = await sql.query(
    `
    INSERT INTO reviews (professor_id, course, rating, difficulty, would_take_again, comment)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      input.professorId,
      input.course,
      input.rating,
      input.difficulty,
      input.wouldTakeAgain,
      input.comment,
    ]
  );
  return (rows as Review[])[0];
}

