// Loads data/professors.json (produced by scripts/scrape.mjs) into Neon Postgres.
// Requires scripts/migrate.mjs to have been run first.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
import { readFile } from "node:fs/promises";
import path from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const DATA_PATH = path.join(process.cwd(), "data", "professors.json");
const sql = neon(DATABASE_URL);

async function main() {
  const professors = JSON.parse(await readFile(DATA_PATH, "utf-8"));

  for (const p of professors) {
    await sql`
      INSERT INTO professors (lums_employee_id, name, title, department, school, photo_url, profile_url)
      VALUES (${p.lumsEmployeeId}, ${p.name}, ${p.title}, ${p.department}, ${p.school}, ${p.photoUrl}, ${p.profileUrl})
      ON CONFLICT (lums_employee_id) DO UPDATE SET
        name = excluded.name,
        title = excluded.title,
        department = excluded.department,
        school = excluded.school,
        photo_url = excluded.photo_url,
        profile_url = excluded.profile_url
    `;
  }

  console.log(`Seeded ${professors.length} professors.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
