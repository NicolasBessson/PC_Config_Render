import { CATEGORIES, getComponent } from "@/lib/catalog";

/** GET /api/components/:id */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  for (const category of CATEGORIES) {
    const component = getComponent(category, id);
    if (component) return Response.json({ category, ...component });
  }
  return Response.json({ error: "Composant introuvable." }, { status: 404 });
}
