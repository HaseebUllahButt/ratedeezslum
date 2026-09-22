/**
 * Slugs for school and department hub pages.
 *
 * Schools use their established LUMS abbreviations where one exists: students
 * search "SBASSE faculty", not the full twelve-word name, and the short URL is
 * the better landing target. Anything unrecognised falls back to a generated
 * slug so a new school added to the directory still gets a working page.
 */
const SCHOOL_SLUGS: Record<string, string> = {
  "Syed Babar Ali School of Science and Engineering": "sbasse",
  "Suleman Dawood School of Business": "sdsb",
  "Mushtaq Ahmad Gurmani School of Humanities and Social Sciences": "mgshss",
  "Shaikh Ahmad Hassan School of Law": "sahsol",
  "Syed Ahsan Ali and Syed Maratib Ali School of Education": "soe",
};

/** Short form shown in headings and titles, when the school has a known one. */
const SCHOOL_ABBREVIATIONS: Record<string, string> = {
  "Syed Babar Ali School of Science and Engineering": "SBASSE",
  "Suleman Dawood School of Business": "SDSB",
  "Mushtaq Ahmad Gurmani School of Humanities and Social Sciences": "MGSHSS",
  "Shaikh Ahmad Hassan School of Law": "SAHSOL",
  "Syed Ahsan Ali and Syed Maratib Ali School of Education": "SOE",
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function schoolSlug(school: string): string {
  return SCHOOL_SLUGS[school] ?? slugify(school);
}

export function schoolAbbreviation(school: string): string | null {
  return SCHOOL_ABBREVIATIONS[school] ?? null;
}

export function departmentSlug(department: string): string {
  return slugify(department);
}

/** Resolves a URL slug back to the exact stored value, or undefined. */
export function matchSlug(
  slug: string,
  values: string[],
  toSlug: (value: string) => string
): string | undefined {
  return values.find((value) => toSlug(value) === slug);
}
