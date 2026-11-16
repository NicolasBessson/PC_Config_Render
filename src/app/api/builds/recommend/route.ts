import { z } from "zod";
import { recommend, recommendInputSchema } from "@/lib/recommend";

/** POST /api/builds/recommend — { budget, gameIds, resolution, targetFps, style } */
export async function POST(request: Request) {
  const input = recommendInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Critères invalides.", details: z.treeifyError(input.error) }, { status: 400 });
  return Response.json(recommend(input.data));
}
