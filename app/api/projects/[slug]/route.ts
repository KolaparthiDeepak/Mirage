// Plan 03: PATCH /api/projects/:slug (name/basePath/defaults), DELETE (requires
// the client to have the user type the slug to confirm — that's a UI gate;
// the server just deletes on request).
import { projectYamlSchema } from "@/src/compile/schema";
import { invalidateConfig } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../_lib/admin-auth";
import { checkVersion, requireStoreManaged } from "../../_lib/project-mutations";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const parsedBody = body as { name?: string; basePath?: string; defaults?: Record<string, unknown>; ifVersion?: number };

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });

  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;
  const versionError = checkVersion(project, parsedBody.ifVersion);
  if (versionError) return versionError;

  const merged = {
    ...project,
    name: parsedBody.name ?? project.name,
    basePath: "basePath" in parsedBody ? parsedBody.basePath : project.basePath,
    defaults: { ...project.defaults, ...(parsedBody.defaults ?? {}) },
  };
  const validated = projectYamlSchema.safeParse({ name: merged.name, slug, basePath: merged.basePath, defaults: merged.defaults });
  if (!validated.success) {
    const issue = validated.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "project"}: ${issue.message}` }, { status: 400 });
  }

  await store.saveProject(merged);
  invalidateConfig(slug);
  return Response.json(await store.getProject(slug));
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  await store.deleteProject(slug);
  invalidateConfig(slug);
  return new Response(null, { status: 204 });
}
