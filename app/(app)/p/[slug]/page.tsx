"use client";
import { use } from "react";
import Link from "next/link";
import { useProject } from "@/app/_lib/view-model-context";
import { Badge, CopyButton, MethodPill, StatusCode, EmptyState } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { mockPath, mockBaseUrl } from "@/app/_lib/mock-url";
import { ProjectStats } from "@/app/_features/overview/ProjectStats";
import { sampleTraffic } from "@/app/_features/traffic/sample-traffic";
import styles from "@/app/_features/overview/overview.module.css";

const DESCRIPTION = "Mock API — response selection driven by the request.";

export default function ProjectOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;
  const traffic = sampleTraffic(project).slice(0, 5);

  return (
    <>
      <PageHeader
        title={project.name}
        description={DESCRIPTION}
        actions={
          <CopyButton
            text={() => mockBaseUrl(project.slug, project.basePath)}
            label="Copy base URL"
          />
        }
      />

      <div className={styles.statusLine}>
        <Badge tone="success">Running</Badge>
        <span className={styles.mono}>{mockPath(project.slug, project.basePath)}</span>
        <Link className={styles.publicLink} href={`/p/${slug}/public`}>
          Public URL &amp; docs →
        </Link>
      </div>

      <ProjectStats project={project} />

      <section className={styles.traffic}>
        <div className={styles.trafficHead}>
          <h2 className={styles.h2}>Recent traffic</h2>
          <PreviewBadge />
        </div>
        {traffic.length === 0 ? (
          <EmptyState
            title="No traffic yet"
            body="Requests to this mock API will appear here."
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Path</th>
                <th scope="col">Status</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {traffic.map((e) => (
                <tr key={e.id}>
                  <td>
                    <MethodPill method={e.method} />
                  </td>
                  <td className={styles.mono}>{e.path}</td>
                  <td>
                    <StatusCode code={e.status} />
                  </td>
                  <td>{e.ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
