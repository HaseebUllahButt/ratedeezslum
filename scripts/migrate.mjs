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
      course TEXT,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
      would_take_again BOOLEAN NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_reviews_professor_id ON reviews(professor_id)`;

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
