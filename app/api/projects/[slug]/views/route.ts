// Plan 21 — GET list (built-ins + saved) / POST create-or-update one saved view.
import { BUILTIN_VIEWS } from "@/src/views/builtins";
import { savedViewSchema } from "@/src/views/schema";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../_lib/project-mutations";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const saved = await store.listViews(slug);
  return Response.json({
    builtin: BUILTIN_VIEWS.map((v) => ({ id: v.id, name: v.name, query: v.query })),
    saved: saved.map((v) => ({ id: v.id, name: v.name, query: v.query, createdAt: v.createdAt })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const parsed = savedViewSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "view"}: ${issue.message}` }, { status: 400 });
  }
  if (BUILTIN_VIEWS.some((v) => v.id === parsed.data.id)) {
    return Response.json({ error: `"${parsed.data.id}" is a built-in view id and cannot be reused` }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const existing = await store.getView(slug, parsed.data.id);
  await store.saveView({
    id: parsed.data.id,
    slug,
    name: parsed.data.name,
    query: parsed.data.query,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });

  return Response.json({ view: parsed.data }, { status: existing ? 200 : 201 });
}
