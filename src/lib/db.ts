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

export async function countReviews(): Promise<number> {
  const rows = (await sql`SELECT COUNT(*)::int AS c FROM reviews`) as { c: number }[];
  return rows[0].c;
}

export async function listProfessors(query?: string): Promise<ProfessorWithStats[]> {
  const text = `
    ${STATS_SELECT}
    ${query ? "WHERE p.name ILIKE $1 OR p.department ILIKE $1 OR p.school ILIKE $1" : ""}
    GROUP BY p.id
    ORDER BY p.name ASC
  `;
  const rows = query
    ? await sql.query(text, [`%${query}%`])
    : await sql.query(text);
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

