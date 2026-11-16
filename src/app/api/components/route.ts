import { catalog, CATEGORIES, type Category } from "@/lib/catalog";

/** GET /api/components?category=gpu — le catalogue, filtrable par catégorie. */
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  if (category === null) return Response.json(catalog);
  if (!CATEGORIES.includes(category as Category)) return Response.json({ error: `Catégorie inconnue. Valeurs admises : ${CATEGORIES.join(", ")}.` }, { status: 400 });
  return Response.json(catalog[category as Category]);
}
