import Link from "next/link";
import type { ProjectVM } from "@/src/viewer/model";
import { CopyButton } from "@/app/_ui";
import { mockBaseUrl } from "@/app/_lib/mock-url";
import { CubeGlyph } from "./ProjectCard";
import styles from "./projects.module.css";

export function ProjectListRow({ project }: { project: ProjectVM }) {
  const href = `/p/${project.slug}`;
  const baseUrl = mockBaseUrl(project.slug, project.basePath);
  return (
    <article className={styles.row}>
      <span className={styles.glyph}>
        <CubeGlyph />
      </span>
      <Link href={href} className={styles.rowName}>
        {project.name}
      </Link>
      <Link href={href} className={styles.baseUrl}>
        {baseUrl}
      </Link>
      <span className={styles.rowStats}>
        <b>{project.endpoints.length}</b> endpoints · <b>{project.caseCount}</b> cases
      </span>
      <span className={styles.running}>
        <span className={styles.runningDot} aria-hidden="true" />
        Running
      </span>
      <CopyButton text={baseUrl} label="Copy URL" />
    </article>
  );
}
