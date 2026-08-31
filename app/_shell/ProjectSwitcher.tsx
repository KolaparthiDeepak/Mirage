"use client";
import { usePathname, useRouter } from "next/navigation";
import { Dropdown } from "@/app/_ui";
import { useProject, useViewModel } from "@/app/_lib/view-model-context";
import styles from "./shell.module.css";

export function ProjectSwitcher() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { projects } = useViewModel();

  const slug = pathname.match(/^\/p\/([^/]+)/)?.[1] ?? "";
  const current = useProject(slug);

  function targetFor(next: string) {
    const rest = pathname.match(/^\/p\/[^/]+(\/.*)?$/)?.[1] ?? "";
    return `/p/${next}${rest}`;
  }

  return (
    <Dropdown
      trigger={
        <span className={styles.switcherTrigger}>
          {current?.name ?? "Select project"} <span aria-hidden="true">▾</span>
        </span>
      }
      items={projects.map((p) => ({
        label: p.name,
        onSelect: () => router.push(targetFor(p.slug)),
      }))}
    />
  );
}
