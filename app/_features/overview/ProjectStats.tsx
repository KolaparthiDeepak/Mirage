"use client";
import { useEffect, useState } from "react";
import type { ProjectVM } from "@/src/viewer/model";
import styles from "./overview.module.css";

interface Stats {
  total: number;
  matched: number;
  unmatched: number;
  statusClasses: Record<string, number>;
  p50DurationMs: number;
  p95DurationMs: number;
  topUnmatchedPaths: { path: string; count: number }[];
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.cell}>
      <div className={styles.cellValue}>{value}</div>
      <div className={styles.cellLabel}>{label}</div>
    </div>
  );
}

/** Numbers here are real, from src/store/*, or "—" while loading/absent — never
 *  fabricated (plan 05: "Numbers on this page must be real or absent"). */
export function ProjectStats({ project }: { project: ProjectVM }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.slug}/traffic/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project.slug]);

  const dash = "—";

  return (
    <div className={styles.stats}>
      <Cell value={String(project.endpoints.length)} label="Endpoints" />
      <Cell value={String(project.caseCount)} label="Cases" />
      <Cell value={stats ? String(stats.total) : dash} label="Requests" />
      <Cell
        value={stats && stats.total > 0 ? `${Math.round((stats.matched / stats.total) * 100)}%` : dash}
        label="Matched"
      />
      <Cell value={stats ? `${stats.p50DurationMs} ms` : dash} label="p50 duration" />
      <Cell value={stats ? `${stats.p95DurationMs} ms` : dash} label="p95 duration" />
      {stats && stats.topUnmatchedPaths.length > 0 && (
        <div className={styles.previewGroup}>
          <div className={styles.previewHead}>Top unmatched paths</div>
          <ul className={styles.previewCells}>
            {stats.topUnmatchedPaths.map((p) => (
              <li key={p.path}>
                {p.path} <span className={styles.cellLabel}>×{p.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
