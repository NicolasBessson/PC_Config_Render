import { games } from "@/lib/catalog";

/** GET /api/games */
export async function GET() {
  return Response.json(games);
}
