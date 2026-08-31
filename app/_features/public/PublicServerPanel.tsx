"use client";
import { CopyButton } from "@/app/_ui";
import { mockPath, mockBaseUrl } from "@/app/_lib/mock-url";
import { useProjectConfig } from "@/app/_lib/project-config-context";
import styles from "./public.module.css";

export function PublicServerPanel({
  slug,
  basePath,
  hasOpenApi,
}: {
  slug: string;
  basePath?: string;
  hasOpenApi: boolean;
}) {
  const config = useProjectConfig(slug);
  const specUrl = `/m/${slug}/__spec`;

  return (
    <div className={styles.panel}>
      <div className={styles.field}>
        <span className={styles.label}>Base URL</span>
        <div className={styles.value}>
          <code className={styles.code}>{mockPath(slug, basePath)}</code>
          <CopyButton text={() => mockBaseUrl(slug, basePath)} label="Copy base URL" />
        </div>
      </div>

      {config ? (
        <p className={styles.server}>
          CORS {config.defaults.cors ? "enabled" : "disabled"} · {config.defaults.delayMs} ms
          default delay
        </p>
      ) : null}

      {hasOpenApi ? (
        <div className={styles.field}>
          <span className={styles.label}>OpenAPI spec</span>
          <div className={styles.value}>
            <a className={styles.code} href={specUrl} target="_blank" rel="noreferrer">
              {specUrl}
            </a>
            <CopyButton
              text={() => `${window.location.origin}${specUrl}`}
              label="Copy spec URL"
            />
          </div>
        </div>
      ) : null}

      <figure className={styles.qr}>
        <div className={styles.qrBox}>QR</div>
        <figcaption className={styles.qrCaption}>Scan for the base URL</figcaption>
      </figure>
    </div>
  );
}
