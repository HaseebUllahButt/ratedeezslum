// Creates the Postgres schema on Neon. Run once per fresh database:
//   DATABASE_URL=... node scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(DATABASE_URL);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS professors (
      id SERIAL PRIMARY KEY,
      lums_employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      department TEXT,
      school TEXT,
      photo_url TEXT,
      profile_url TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      professor_id INTEGER NOT NULL REFERENCES professors(id),
      author_key TEXT,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_key TEXT`;
  await sql`ALTER TABLE reviews DROP COLUMN IF EXISTS course`;
  await sql`ALTER TABLE reviews DROP COLUMN IF EXISTS difficulty`;
  await sql`ALTER TABLE reviews DROP COLUMN IF EXISTS would_take_again`;

  await sql`CREATE INDEX IF NOT EXISTS idx_reviews_professor_id ON reviews(professor_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reviews_author_key ON reviews(author_key)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_professor_author ON reviews(professor_id, author_key)`;

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
