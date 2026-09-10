// Plan 03: PATCH /api/projects/:slug (name/basePath/defaults), DELETE (requires
// the client to have the user type the slug to confirm — that's a UI gate;
// the server just deletes on request).
import { contractSchema, faultsSchema, projectVariableSchema, projectYamlSchema, upstreamSchema } from "@/src/compile/schema";
import { assertSafeUpstreamUrl, UpstreamError } from "@/src/proxy/ssrf";
import { invalidateConfig } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import type { StoredProject } from "@/src/store/types";
import { z } from "zod";
import { checkAdminAuth } from "../../_lib/admin-auth";
import { checkVersion, requireStoreManaged } from "../../_lib/project-mutations";

/** Plan 17: a `secret` variable's value is write-only — never returned by a
 *  read API. Shown as "***". */
function stripSecrets(project: StoredProject): StoredProject {
  if (!project.variables?.some((v) => v.secret)) return project;
  return {
    ...project,
    variables: project.variables.map((v) => (v.secret ? { ...v, value: "***", overrides: undefined } : v)),
  };
}

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
  const parsedBody = body as {
    name?: string;
    basePath?: string;
    defaults?: Record<string, unknown>;
    upstream?: unknown;
    faults?: unknown;
    variables?: unknown;
    defaultEnvironment?: string | null;
    contract?: unknown;
    ifVersion?: number;
  };

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });

  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;
  const versionError = checkVersion(project, parsedBody.ifVersion);
  if (versionError) return versionError;

  // Plan 07: upstream is opt-in. `null` or `{ mode: "off" }` clears it; any
  // other mode must pass the full SSRF gate (shape + DNS + private-range)
  // right here, at save time — control #1/#2.
  let upstream = project.upstream;
  if ("upstream" in parsedBody) {
    if (parsedBody.upstream == null) {
      upstream = undefined;
    } else {
      const shape = upstreamSchema.safeParse(parsedBody.upstream);
      if (!shape.success) {
        const issue = shape.error.issues[0]!;
        return Response.json({ error: `upstream.${issue.path.join(".") || "config"}: ${issue.message}` }, { status: 400 });
      }
      if (shape.data.mode === "off") {
        upstream = undefined;
      } else {
        try {
          await assertSafeUpstreamUrl(shape.data.url);
        } catch (e) {
          if (e instanceof UpstreamError) return Response.json({ error: e.message }, { status: 400 });
          throw e;
        }
        upstream = shape.data;
      }
    }
  }

  // Plan 11: faults are opt-in. `null` clears it; the schema's superRefine
  // rejects a latency config that could exceed the 5000ms cap, with the
  // arithmetic in the message.
  let faults = project.faults;
  if ("faults" in parsedBody) {
    if (parsedBody.faults == null) {
      faults = undefined;
    } else {
      const shape = faultsSchema.safeParse(parsedBody.faults);
      if (!shape.success) {
        const issue = shape.error.issues[0]!;
        return Response.json({ error: `faults.${issue.path.join(".") || "config"}: ${issue.message}` }, { status: 400 });
      }
      faults = shape.data;
    }
  }

  // Plan 17: a secret sent back as "***" must not overwrite the stored value.
  let variables = project.variables;
  if ("variables" in parsedBody) {
    const shape = z.array(projectVariableSchema).safeParse(parsedBody.variables);
    if (!shape.success) {
      return Response.json({ error: `variables: ${shape.error.issues[0]!.message}` }, { status: 400 });
    }
    const priorSecrets = new Map((project.variables ?? []).filter((v) => v.secret).map((v) => [v.key, v]));
    variables = shape.data.map((v) =>
      v.secret && v.value === "***" && priorSecrets.has(v.key) ? priorSecrets.get(v.key)! : v,
    );
  }
  const defaultEnvironment =
    "defaultEnvironment" in parsedBody ? (parsedBody.defaultEnvironment || undefined) : project.defaultEnvironment;

  let contract = project.contract;
  if ("contract" in parsedBody) {
    if (parsedBody.contract == null) {
      contract = undefined;
    } else {
      const shape = contractSchema.safeParse(parsedBody.contract);
      if (!shape.success) {
        return Response.json({ error: `contract.${shape.error.issues[0]!.path.join(".") || "config"}: ${shape.error.issues[0]!.message}` }, { status: 400 });
      }
      contract = shape.data;
    }
  }

  const merged = {
    ...project,
    name: parsedBody.name ?? project.name,
    basePath: "basePath" in parsedBody ? parsedBody.basePath : project.basePath,
    defaults: { ...project.defaults, ...(parsedBody.defaults ?? {}) },
    upstream,
    faults,
    variables,
    defaultEnvironment,
    contract,
  };
  const validated = projectYamlSchema.safeParse({ name: merged.name, slug, basePath: merged.basePath, defaults: merged.defaults });
  if (!validated.success) {
    const issue = validated.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "project"}: ${issue.message}` }, { status: 400 });
  }

  await store.saveProject(merged);
  invalidateConfig(slug);
  const saved = await store.getProject(slug);
  return Response.json(saved ? stripSecrets(saved) : saved);
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
