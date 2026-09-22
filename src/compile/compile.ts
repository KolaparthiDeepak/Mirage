import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { compileSegments, methodSubsumes, segmentsSubsume } from "../engine/match";
import { parseTemplate, TemplateError } from "../engine/template";
import type { MockResponse, ProjectConfig, Route } from "../engine/types";
import { expandOpenApi } from "../openapi/expand";
import { projectYamlSchema, ruleFileSchema, type Rule } from "./schema";

export interface CompiledBundle {
  builtAt: string;
  commit: string;
  warnings: string[];
  projects: Record<string, ProjectConfig>;
}
export interface CompileResult {
  bundle: CompiledBundle;
  errors: string[];
  warnings: string[];
}

const DEFAULT_NOT_FOUND: MockResponse = { status: 404, body: { reason: "UNKNOWN_ROUTE" } };

type OaDoc = Record<string, unknown> & {
  paths?: Record<string, unknown>;
  components?: Record<string, Record<string, unknown>>;
};

/** Union `paths` and `components.*` across a project's OpenAPI files; the first
 *  document wins on `info` and the spec version. A colliding key is an error —
 *  this used to silently keep only the last file's document. */
function mergeOpenApiDocs(
  base: unknown,
  next: unknown,
  label: string,
  errors: string[],
): unknown {
  if (base == null) return next;
  const a = base as OaDoc;
  const b = next as OaDoc;
  const paths = { ...(a.paths ?? {}) };
  for (const [k, v] of Object.entries(b.paths ?? {})) {
    if (k in paths) errors.push(`${label}: duplicate OpenAPI path "${k}" across the project's specs`);
    paths[k] = v;
  }
  const components: Record<string, Record<string, unknown>> = { ...(a.components ?? {}) };
  for (const [group, entries] of Object.entries(b.components ?? {})) {
    const merged = { ...(components[group] ?? {}) };
    for (const [k, v] of Object.entries(entries)) {
      if (k in merged) errors.push(`${label}: duplicate OpenAPI components.${group}."${k}" across the project's specs`);
      merged[k] = v;
    }
    components[group] = merged;
  }
  return { ...b, ...a, paths, ...(Object.keys(components).length > 0 ? { components } : {}) };
}

function fmtErr(e: unknown): string {
  if (e instanceof z.ZodError) {
    const i = e.issues[0]!;
    return `${i.path.join(".")}: ${i.message}`;
  }
  return (e as Error).message;
}

function isEnoent(e: unknown): boolean {
  return (e as NodeJS.ErrnoException)?.code === "ENOENT";
}

function walkRuleFiles(dir: string): string[] {
  const routesDir = join(dir, "routes");
  try {
    return readdirSync(routesDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort()
      .map((f) => join(routesDir, f));
  } catch {
    return [];
  }
}

// RFC 7230 field-name token. A name outside it, or a value carrying a control
// character, makes the Response constructor throw at request time — a mock that
// compiled clean but 500s in production.
const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

// Exported so plan 03's save endpoints re-run the exact build-time checks
// (header grammar, control characters, template tokens) rather than a second
// implementation that could drift from what the build actually enforces.
export function assertResponseValid(resp: MockResponse): void {
  const visit = (v: unknown): void => {
    if (typeof v === "string") parseTemplate(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(resp.body);
  for (const [name, value] of Object.entries(resp.headers ?? {})) {
    if (!HEADER_NAME_RE.test(name)) {
      throw new TemplateError(`invalid response header name "${name}"`);
    }
    if (/[\u0000-\u001f\u007f]/.test(value)) {
      throw new TemplateError(`response header "${name}" contains a control character`);
    }
    parseTemplate(value);
  }
}

// Exported so the store's config-cache (plan 02) can compile a stored rule the
// same way a file-defined one is compiled — one conversion, not two.
export function toRoute(rule: Rule): Route {
  // Plan 10: a variant rule's default (and the value every resolve()-path
  // reader sees) is variant[0]. The state layer overrides it per session.
  const response = rule.response ?? rule.responses!.variants[0]!;
  return {
    id: rule.id,
    method: rule.request.method,
    path: rule.request.path,
    segments: compileSegments(rule.request.path),
    match: rule.request.match as Route["match"],
    response,
    responses: rule.responses,
    callback: rule.callback as Route["callback"],
    drift: rule.drift,
  };
}

function detectDeadRules(routes: Route[], warnings: string[]): void {
  // Only rules with no match conditions can shadow: a conditional rule may decline.
  const unconditional: Route[] = [];
  for (const r of routes) {
    const shadower = unconditional.find(
      (e) => methodSubsumes(e.method, r.method) && segmentsSubsume(e.segments, r.segments),
    );
    // A hand-written rule intentionally overriding a generated openapi: route is
    // the documented pattern (design spec §4.4) — suppress that case only.
    const intendedOverride =
      r.id.startsWith("openapi:") && !shadower?.id.startsWith("openapi:");
    if (shadower && !intendedOverride) {
      const same = shadower.method === r.method && shadower.path === r.path;
      warnings.push(
        same
          ? `rule "${r.id}": unreachable — rule "${shadower.id}" already matches all "${r.method} ${r.path}"`
          : `rule "${r.id}": unreachable — earlier rule "${shadower.id}" (${shadower.method} ${shadower.path}) already matches every request it could match`,
      );
    }
    if (!r.match || r.match.length === 0) unconditional.push(r);
  }
}

export interface CompileProjectDirResult {
  /** null when the directory couldn't even be parsed into a project (errors
   *  explains why) — never a half-built ProjectConfig. */
  config: ProjectConfig | null;
  errors: string[];
  warnings: string[];
}

/**
 * Compiles exactly one project directory (`project.yaml` + its rule files +
 * its `openapi/` dir) into a ProjectConfig. Extracted out of compileMocks so
 * a single-project caller — the CLI (plan 19), which watches and recompiles
 * one directory at a time on file save — doesn't have to re-walk every other
 * project's directory just to get one project's config. One implementation,
 * two callers: compileMocks below, and `mirage dev`/`mirage validate`.
 */
export async function compileProjectDir(
  mocksDir: string,
  dirName: string,
  overlayFiles: Record<string, string> = {},
): Promise<CompileProjectDirResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dir = join(mocksDir, dirName);

  let rawProject: string;
  try {
    rawProject = readFileSync(join(dir, "project.yaml"), "utf8");
  } catch (e) {
    errors.push(isEnoent(e) ? `${dirName}/: missing project.yaml` : `${dirName}/project.yaml: unreadable: ${(e as Error).message}`);
    return { config: null, errors, warnings };
  }

  let project;
  try {
    project = projectYamlSchema.parse(parseYaml(rawProject));
  } catch (e) {
    errors.push(`${dirName}/project.yaml: ${fmtErr(e)}`);
    return { config: null, errors, warnings };
  }

  if (project.slug !== dirName) {
    errors.push(`${dirName}/project.yaml: slug "${project.slug}" does not match directory name "${dirName}"`);
    return { config: null, errors, warnings };
  }

  const routes: Route[] = [];
  const ruleFiles: Array<{ label: string; raw: string }> = [];
  for (const f of walkRuleFiles(dir)) {
    try {
      ruleFiles.push({ label: f, raw: readFileSync(f, "utf8") });
    } catch {
      errors.push(`${f}: unreadable`);
    }
  }
  for (const [rel, raw] of Object.entries(overlayFiles)) {
    if (rel.startsWith(dirName + "/")) ruleFiles.push({ label: rel, raw });
  }

  for (const { label, raw } of ruleFiles) {
    let rules: Rule[];
    try {
      rules = ruleFileSchema.parse(parseYaml(raw) ?? []);
    } catch (e) {
      errors.push(`${label}: ${fmtErr(e)}`);
      continue;
    }
    for (const rule of rules) {
      if (rule.request.path.startsWith("/__")) {
        errors.push(`${label}: rule "${rule.id}" uses reserved path prefix "/__"`);
        continue;
      }
      try {
        for (const resp of rule.response ? [rule.response] : rule.responses!.variants) {
          assertResponseValid(resp);
        }
      } catch (e) {
        if (e instanceof TemplateError) { errors.push(`${label}: rule "${rule.id}": ${e.message}`); continue; }
        throw e;
      }
      routes.push(toRoute(rule));
    }
  }

  let mergedDoc: unknown;
  const openapiDir = join(dir, "openapi");
  let oaFiles: string[] = [];
  try {
    oaFiles = readdirSync(openapiDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json"))
      .sort();
  } catch { /* no openapi/ dir */ }
  for (const f of oaFiles) {
    const full = join(openapiDir, f);
    try {
      const res = await expandOpenApi(full, { fakeFromSchema: project.fakeFromSchema });
      const bp = project.basePath;
      let kept = 0;
      for (const r of res.routes) {
        let route = r;
        if (bp) {
          // resolve.ts strips basePath BEFORE matching, so stored route paths must be basePath-relative.
          if (r.path === bp || r.path.startsWith(bp + "/")) {
            const rel = r.path.slice(bp.length) || "/";
            route = { ...r, path: rel, segments: compileSegments(rel) };
          } else {
            warnings.push(`${dirName}/openapi/${f}: generated route "${r.id}" path "${r.path}" is outside basePath "${bp}" and will not be reachable`);
            continue;
          }
        }
        if (route.path.startsWith("/__")) { errors.push(`${full}: generated route "${route.id}" hits reserved path "/__"`); continue; }
        routes.push(route); // AFTER hand-written -> first-match-wins => hand-written overrides
        kept++;
      }
      // Every path falling outside basePath used to be warnings-only, so an
      // OpenAPI import could contribute nothing and still ship.
      if (res.routes.length > 0 && kept === 0) {
        errors.push(
          `${full}: contributed no routes — every path is outside basePath "${bp}". ` +
            `OpenAPI paths must include the base path; do not put it in servers[].url only.`,
        );
      }
      for (const w of res.warnings) warnings.push(`${dirName}/openapi/${f}: ${w}`);
      mergedDoc = mergeOpenApiDocs(mergedDoc, res.mergedDoc, full, errors);
    } catch (e) {
      errors.push(`${full}: ${(e as Error).message}`);
    }
  }

  const seenIds = new Set<string>();
  for (const r of routes) {
    if (seenIds.has(r.id)) errors.push(`duplicate rule id "${r.id}" in project "${project.slug}"`);
    seenIds.add(r.id);
  }

  detectDeadRules(routes, warnings);

  const config: ProjectConfig = {
    name: project.name,
    slug: project.slug,
    basePath: project.basePath,
    defaults: {
      delayMs: project.defaults?.delayMs ?? 0,
      cors: project.defaults?.cors ?? true,
      notFound: project.defaults?.notFound ?? DEFAULT_NOT_FOUND,
    },
    routes,
    openApiDoc: mergedDoc,
    // Plan 07 / 11 / 17 / 13 / 18 / 22: carried through from project.yaml.
    upstream: project.upstream,
    faults: project.faults,
    variables: project.variables,
    defaultEnvironment: project.defaultEnvironment,
    contract: project.contract,
    docs: project.docs,
    drift: project.drift,
  };

  return { config, errors, warnings };
}

export async function compileMocks(
  mocksDir: string,
  commit = "dev",
  overlayFiles: Record<string, string> = {},
): Promise<CompileResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const projects: Record<string, ProjectConfig> = {};

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(mocksDir).filter((d) => {
      try { return statSync(join(mocksDir, d)).isDirectory(); } catch { return false; }
    });
  } catch {
    errors.push(`mocks directory not found: ${mocksDir}`);
    return { bundle: { builtAt: new Date().toISOString(), commit, warnings, projects }, errors, warnings };
  }

  for (const dirName of projectDirs) {
    const result = await compileProjectDir(mocksDir, dirName, overlayFiles);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.config) projects[result.config.slug] = result.config;
  }

  return {
    bundle: { builtAt: new Date().toISOString(), commit, warnings, projects },
    errors,
    warnings,
  };
}
