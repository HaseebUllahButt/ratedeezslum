import { getProfessor, listReviewsForProfessor } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/professors/[id]">
) {
  const { id } = await ctx.params;
  const professorId = Number(id);
  if (!Number.isInteger(professorId)) {
    return Response.json({ error: "Invalid professor id" }, { status: 400 });
  }

  const professor = await getProfessor(professorId);
  if (!professor) {
    return Response.json({ error: "Professor not found" }, { status: 404 });
  }

  const reviews = await listReviewsForProfessor(professorId);
  return Response.json({ professor, reviews });
}
