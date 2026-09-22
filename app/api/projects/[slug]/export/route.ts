// Plan 03: GET /api/projects/:slug/export — read-only, no auth needed (same
// trust level as viewing the project already has). Repo-managed projects can
// still export — it's just a redundant copy of what mocks/**  already has.
import { exportProjectToYaml } from "@/src/store/export-yaml";
import { getRuntimeStore } from "@/src/store/runtime-source";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  return Response.json(exportProjectToYaml(project));
}
