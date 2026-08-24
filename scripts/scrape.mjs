// Scrapes the public LUMS faculty directory (https://lums.edu.pk/faculty-resources)
// and writes normalized professor records to data/professors.json.
//
// The directory page renders as a single Drupal view with view_args=all,
// so every faculty member (~400+) is present in one response — no pagination needed.

import * as cheerio from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://lums.edu.pk/faculty-resources";
const OUT_PATH = path.join(process.cwd(), "data", "professors.json");

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ratedeezlums-scraper/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const professors = [];
  $(".profile-faculty-users").each((_, el) => {
    const card = $(el);
    const href = card.find("a[href^='/lums_employee/']").first().attr("href") ?? "";
    const idMatch = href.match(/\/lums_employee\/(\d+)/);
    if (!idMatch) return;
    const lumsEmployeeId = idMatch[1];

    const nameTitle = card.find(".name-title").text().trim();
    const realName = card.find(".real-name").text().trim();
    const fullName = [nameTitle, realName].filter(Boolean).join(" ").trim();
    if (!fullName) return;

    const designation = card.find(".profile-faculty-users-designation").text().trim();
    const department = card.find(".profile-faculty-users-departments").text().trim();
    const school = card.find(".profile-faculty-users-schools").text().trim();
    const rawImg = card.find(".profile-faculty-users-image img").attr("src") ?? "";
    const photoUrl = rawImg ? new URL(rawImg, SOURCE_URL).toString() : null;
    const isPlaceholderPhoto = /dummyUser/i.test(rawImg);

    professors.push({
      lumsEmployeeId,
      name: fullName,
      title: designation || null,
      department: department || null,
      school: school || null,
      photoUrl: isPlaceholderPhoto ? null : photoUrl,
      profileUrl: new URL(href, SOURCE_URL).toString(),
    });
  });

  // De-dupe by lumsEmployeeId, in case the directory ever lists someone twice.
  const seen = new Map();
  for (const p of professors) {
    seen.set(p.lumsEmployeeId, p);
  }
  const unique = [...seen.values()];

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(unique, null, 2));
  console.log(`Scraped ${unique.length} faculty records -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
