// Plan 03: POST /api/projects — create.
import { projectYamlSchema } from "@/src/compile/schema";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../_lib/admin-auth";

export async function POST(req: Request): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }

  const parsed = projectYamlSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "project"}: ${issue.message}` }, { status: 400 });
  }

  const store = await getRuntimeStore();
  if (await store.getProject(parsed.data.slug)) {
    return Response.json({ error: `project "${parsed.data.slug}" already exists` }, { status: 409 });
  }

  await store.saveProject({
    slug: parsed.data.slug,
    name: parsed.data.name,
    basePath: parsed.data.basePath,
    defaults: {
      delayMs: parsed.data.defaults?.delayMs ?? 0,
      cors: parsed.data.defaults?.cors ?? true,
      notFound: parsed.data.defaults?.notFound ?? { status: 404, body: { reason: "UNKNOWN_ROUTE" } },
    },
    source: "store",
    configVersion: 0, // ignored by saveProject — server-authoritative
    updatedAt: new Date(0).toISOString(),
    rules: [],
  });

  const created = await store.getProject(parsed.data.slug);
  return Response.json(created, { status: 201 });
}
