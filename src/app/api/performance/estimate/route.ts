import { z } from "zod";
import { resolutionSchema } from "@/lib/catalog";
import { estimateFps } from "@/lib/perf/estimate";

const schema = z.object({ cpuId: z.string().max(64), gpuId: z.string().max(64), gameId: z.string().max(64), resolution: resolutionSchema });

/** POST /api/performance/estimate — { cpuId, gpuId, gameId, resolution } */
export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Paramètres invalides.", details: z.treeifyError(input.error) }, { status: 400 });
  return Response.json(estimateFps(input.data));
}
