import { listProfessors } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const professors = await listProfessors(q);
  return Response.json({ professors });
}
