"use client";
import { useMemo, useState } from "react";
import { useViewModel } from "@/app/_lib/view-model-context";
import { useDebounced } from "@/app/_lib/use-debounced";
import { Button, Select, Tabs } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { ProjectGrid } from "@/app/_features/projects/ProjectGrid";
import { ProjectEmptyState } from "@/app/_features/projects/ProjectEmptyState";
import { CreateProjectModal } from "@/app/_features/projects/CreateProjectModal";
import styles from "@/app/_features/projects/projects.module.css";

type Sort = "name" | "cases" | "endpoints";

export default function ProjectsPage() {
  const { projects } = useViewModel();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<Sort>("name");
  const [createOpen, setCreateOpen] = useState(false);
  const query = useDebounced(q, 150).trim().toLowerCase();

  const header = (
    <PageHeader
      title="Your mock APIs"
      description="Create, organize and run isolated mock APIs for development and testing."
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New Project
        </Button>
      }
    />
  );
  const createModal = (
    <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
  );

  const visible = useMemo(() => {
    const filtered = query
      ? projects.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.slug.toLowerCase().includes(query),
        )
      : projects;
    const out = [...filtered];
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "cases") out.sort((a, b) => b.caseCount - a.caseCount);
    else if (sort === "endpoints")
      out.sort((a, b) => b.endpoints.length - a.endpoints.length);
    return out;
  }, [projects, query, sort]);

  if (projects.length === 0) {
    return (
      <>
        {header}
        {createModal}
        <ProjectEmptyState onCreate={() => setCreateOpen(true)} />
      </>
    );
  }

  return (
    <>
      {header}
      {createModal}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search projects"
          aria-label="Search projects"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Tabs
          tabs={[
            { id: "grid", label: "Grid" },
            { id: "list", label: "List" },
          ]}
          active={view}
          onChange={(id) => setView(id as "grid" | "list")}
        />
        <Select
          aria-label="Sort projects"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          <option value="name">Name</option>
          <option value="cases">Cases</option>
          <option value="endpoints">Endpoints</option>
        </Select>
      </div>
      {visible.length === 0 ? (
        <p className={styles.noMatch}>No projects match your search.</p>
      ) : (
        <ProjectGrid projects={visible} view={view} />
      )}
    </>
  );
}
