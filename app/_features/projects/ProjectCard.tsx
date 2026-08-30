import Link from "next/link";
import type { ProjectVM } from "@/src/viewer/model";
import { CopyButton } from "@/app/_ui";
import { mockBaseUrl } from "@/app/_lib/mock-url";
import styles from "./projects.module.css";

export function CubeGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export function ProjectCard({ project }: { project: ProjectVM }) {
  const href = `/p/${project.slug}`;
  const baseUrl = mockBaseUrl(project.slug, project.basePath);
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.glyph}>
          <CubeGlyph />
        </span>
        <Link href={href} className={styles.cardName}>
          {project.name}
        </Link>
      </div>

      <div className={styles.cardServer}>
        <span className={styles.metaLabel}>Mock server</span>
        <Link href={href} className={styles.baseUrl}>
          {baseUrl}
        </Link>
      </div>

      <div className={styles.stats}>
        <span>
          <b>{project.endpoints.length}</b> endpoints
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <b>{project.caseCount}</b> cases
        </span>
      </div>

      <div className={styles.cardFoot}>
        <span className={styles.running}>
          <span className={styles.runningDot} aria-hidden="true" />
          Running
        </span>
      </div>

      <div className={styles.cardActions}>
        <Link href={href} className={styles.openLink}>
          Open
        </Link>
        <CopyButton text={baseUrl} label="Copy URL" />
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </div>
    </article>
  );
}
