// Plan 16 — GET list / POST create-or-update one flow.
import { flowSchema } from "@/src/flows/schema";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../_lib/project-mutations";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const flows = await store.listFlows(slug);
  return Response.json({ flows: flows.map((f) => ({ id: f.id, name: f.name, updatedAt: f.updatedAt })) });
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
  const parsed = flowSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "flow"}: ${issue.message}` }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const now = new Date().toISOString();
  const existing = await store.getFlow(slug, parsed.data.id);
  await store.saveFlow({
    id: parsed.data.id,
    slug,
    name: parsed.data.name,
    definition: parsed.data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  return Response.json({ flow: parsed.data }, { status: existing ? 200 : 201 });
}
