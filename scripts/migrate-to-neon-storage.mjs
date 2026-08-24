// Migrates LUMS hotlinked photos -> Neon Object Storage (S3) + updates s3_photo_url
// Requires: AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET, DATABASE_URL
// Usage: node scripts/migrate-to-neon-storage.mjs [--limit=50] [--dry-run] [--force]

import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const ENDPOINT = process.env.AWS_ENDPOINT_URL_S3;
const REGION = process.env.AWS_REGION || "us-east-2";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET = process.env.S3_BUCKET || "ratedeezlums";
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL || `${ENDPOINT}/${BUCKET}`;

if (!DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) throw new Error("S3 credentials missing (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)");

const sql = neon(DATABASE_URL);
const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const LIMIT = args.limit ? Number(args.limit) : 0;
const DRY_RUN = !!args["dry-run"];
const FORCE = !!args.force;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extFromContentType(ct, url) {
  if (ct?.includes("png")) return "png";
  if (ct?.includes("webp")) return "webp";
  if (ct?.includes("gif")) return "gif";
  // fallback to url
  const m = url.match(/\.(\w+)(?:\?|$)/);
  if (m && ["jpg", "jpeg", "png", "webp", "gif"].includes(m[1].toLowerCase())) return m[1].toLowerCase();
  return "jpg";
}

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ratedeezslum-migrator/1.0)" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) throw new Error(`not an image: ${ct}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) throw new Error(`too small ${buf.length}`);
      return { buf, ct };
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(800 * (i + 1));
    }
  }
}

async function main() {
  // ensure column exists (idempotent)
  await sql`ALTER TABLE professors ADD COLUMN IF NOT EXISTS s3_photo_url TEXT`;

  const where = FORCE ? `WHERE photo_url IS NOT NULL` : `WHERE photo_url IS NOT NULL AND s3_photo_url IS NULL`;
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : "";
  const professors = await sql.query(
    `SELECT id, lums_employee_id, name, photo_url, s3_photo_url FROM professors ${where} ORDER BY id ASC ${limitClause}`
  );

  console.log(`Found ${professors.length} professors to migrate (limit=${LIMIT || "all"}, force=${FORCE}, dryRun=${DRY_RUN})`);
  if (professors.length === 0) return;

  let ok = 0, fail = 0, skip = 0;
  // concurrency 4
  const CONC = 4;
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= professors.length) break;
      const p = professors[i];
      const tag = `[${i + 1}/${professors.length}] ${p.lums_employee_id} ${p.name}`;
      try {
        const { buf, ct } = await fetchWithRetry(p.photo_url);
        const ext = extFromContentType(ct, p.photo_url);
        const key = `faculty/${p.lums_employee_id}.${ext}`;
        const publicUrl = `${PUBLIC_BASE.replace(/\/$/, "")}/${key}`;

        if (DRY_RUN) {
          console.log(`${tag} -> dry-run would upload ${key} (${buf.length}b ${ct}) -> ${publicUrl}`);
          ok++;
          continue;
        }

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buf,
            ContentType: ct.split(";")[0] || "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );

        await sql.query(`UPDATE professors SET s3_photo_url = $1 WHERE id = $2`, [publicUrl, p.id]);
        console.log(`${tag} -> ${key} (${buf.length}b ${ct})`);
        ok++;
      } catch (e) {
        console.error(`${tag} FAILED: ${e.message}`);
        fail++;
      }
      // be nice to LUMS + Neon storage (beta guardrails)
      await sleep(250);
    }
  }

  await Promise.all(Array.from({ length: CONC }, () => worker()));

  console.log(`Done. ok=${ok} fail=${fail} total=${professors.length}`);
  const remaining = await sql.query(`SELECT COUNT(*)::int AS c FROM professors WHERE photo_url IS NOT NULL AND s3_photo_url IS NULL`);
  console.log(`Remaining not migrated: ${remaining[0].c}`);

  // verify anon fetch for one
  if (ok > 0) {
    const sample = await sql.query(`SELECT s3_photo_url FROM professors WHERE s3_photo_url IS NOT NULL LIMIT 1`);
    console.log(`Sample S3 URL: ${sample[0]?.s3_photo_url}`);
    try {
      const r = await fetch(sample[0].s3_photo_url);
      console.log(`Anon fetch sample: ${r.status} ${r.headers.get("content-type")}`);
    } catch (e) {
      console.log(`Anon fetch failed (bucket may still be private): ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
