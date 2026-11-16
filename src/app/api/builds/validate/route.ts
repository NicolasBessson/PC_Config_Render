import { z } from "zod";
import { buildPrice, estimatePower, resolveBuild } from "@/lib/build";
import { CATEGORIES, getComponent } from "@/lib/catalog";
import { checkBuild } from "@/lib/compat";

const schema = z.object(Object.fromEntries(CATEGORIES.map((c) => [c, z.string().max(64).optional()])));

/** POST /api/builds/validate — { cpu: "r5-7600", motherboard: "b650-tomahawk", … } */
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Corps de requête invalide.", details: z.treeifyError(body.error) }, { status: 400 });
  const unknown = CATEGORIES.filter((c) => body.data[c] && !getComponent(c, body.data[c]));
  if (unknown.length > 0) return Response.json({ error: `Composant inconnu pour : ${unknown.join(", ")}.` }, { status: 400 });
  const build = resolveBuild(body.data);
  return Response.json({ ...checkBuild(build), priceChf: buildPrice(build), power: estimatePower(build) });
}
