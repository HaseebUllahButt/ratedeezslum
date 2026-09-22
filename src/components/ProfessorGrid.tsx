import Link from "next/link";
import type { ProfessorWithStats } from "@/lib/db";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";

/**
 * Server-rendered professor list for hub pages. Unlike the searchable homepage
 * list this is plain markup with real links, so crawlers reach every profile.
 */
export default function ProfessorGrid({
  professors,
}: {
  professors: ProfessorWithStats[];
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {professors.map((professor, index) => (
        <li key={professor.id}>
          <Link
            href={`/professor/${professor.id}`}
            className="group flex h-full items-center gap-4 border border-slate-200 bg-white p-4 transition-colors hover:border-lums-navy"
          >
            <Avatar
              name={professor.name}
              photoUrl={professor.photo_url}
              s3PhotoUrl={professor.s3_photo_url}
              size={56}
              priority={index < 4}
              className="h-14 w-14 flex-shrink-0 rounded-none border border-slate-200 object-cover"
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold uppercase tracking-tight text-lums-navy">
                {professor.name}
              </h3>
              <p className="truncate text-xs text-slate-600">
                {[professor.title, professor.department].filter(Boolean).join(" · ") ||
                  professor.school}
              </p>
              {professor.review_count > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  <StarRating value={professor.avg_rating ?? 0} />
                  <span className="text-xs font-bold text-slate-900">
                    {professor.avg_rating?.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({professor.review_count})
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No reviews yet</p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
