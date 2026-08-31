import type { ProjectVM } from "@/src/viewer/model";
import { ProjectCard } from "./ProjectCard";
import { ProjectListRow } from "./ProjectListRow";
import styles from "./projects.module.css";

export function ProjectGrid({
  projects,
  view,
}: {
  projects: ProjectVM[];
  view: "grid" | "list";
}) {
  if (view === "list") {
    return (
      <div className={styles.list}>
        {projects.map((p) => (
          <ProjectListRow key={p.slug} project={p} />
        ))}
      </div>
    );
  }
  return (
    <div className={styles.grid}>
      {projects.map((p) => (
        <ProjectCard key={p.slug} project={p} />
      ))}
    </div>
  );
}
