// Plan 18 — a shareable, read-only page per project: every endpoint, every
// case, a working curl. Built almost entirely from parts that already exist
// (buildViewModel, match-summary, synthesizeRequest's curl output).
//
// Off by default (docs.enabled) — publishing a project's endpoint shapes is
// an opt-in, never a side effect of creating the project. Absent/disabled ->
// 404 for anyone, same as a project that doesn't exist; the docs route
// carries no authorisation concept of its own.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import bundleJson from "@/mocks.generated.json";
import type { CompiledBundle } from "@/src/compile/compile";
import { withStoreProjects } from "@/src/store/merge-into-bundle";
import { buildViewModel } from "@/src/viewer/model";
import { matchSummary } from "@/app/_lib/match-summary";
import { mockBaseUrl, mockPath } from "@/app/_lib/mock-url";
import { CopyButton, MethodPill, StatusCode } from "@/app/_ui";
import styles from "./docs.module.css";

// A store-native project's docs toggle must take effect without a redeploy,
// same reasoning as app/(app)/layout.tsx.
export const dynamic = "force-dynamic";

export default async function DocsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await withStoreProjects(bundleJson as unknown as CompiledBundle);
  const config = bundle.projects[slug];
  if (!config || !config.docs?.enabled) notFound();

  const model = buildViewModel(bundle);
  const project = model.projects.find((p) => p.slug === slug)!;

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const baseUrl = mockBaseUrl(project.slug, project.basePath, origin);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{project.name}</h1>
        {config.docs.description ? <p className={styles.description}>{config.docs.description}</p> : null}
        <div className={styles.baseUrlRow}>
          <code className={styles.mono}>{mockPath(project.slug, project.basePath)}</code>
          <CopyButton text={baseUrl} label="Copy base URL" />
        </div>
        {config.openApiDoc != null ? (
          <a className={styles.specLink} href={`/m/${slug}/__spec`} target="_blank" rel="noreferrer">
            OpenAPI spec ↗
          </a>
        ) : null}
      </header>

      <main>
        {project.endpoints.map((ep) => (
          <section key={ep.key} className={styles.endpoint}>
            <h2 className={styles.endpointHead}>
              <MethodPill method={ep.method} />
              <code className={styles.mono}>{ep.path}</code>
            </h2>
            {ep.summary ? <p className={styles.summary}>{ep.summary}</p> : null}

            <ul className={styles.cases}>
              {ep.cases.map((c) => {
                const curl = c.request.curl.split("$ORIGIN").join(origin);
                return (
                  <li key={c.id} className={styles.case}>
                    <div className={styles.caseHead}>
                      <span className={styles.caseLabel}>{c.label}</span>
                      <StatusCode code={c.expected.status} />
                    </div>
                    <p className={styles.matchSummary}>{matchSummary(c.match)}</p>
                    <div className={styles.curlBlock}>
                      <pre className={styles.pre}>{curl}</pre>
                      <CopyButton text={curl} label="Copy curl" />
                    </div>
                    {c.expected.body != null ? (
                      <pre className={styles.pre}>{JSON.stringify(c.expected.body, null, 2)}</pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>

      <footer className={styles.footer}>
        {model.build.commit ? `build ${model.build.commit}` : "dev build"}
        {model.build.builtAt ? ` · ${model.build.builtAt}` : ""}
      </footer>
    </div>
  );
}
