"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/app/_ui";
import type { ProjectVM } from "@/src/viewer/model";
import type { ProjectConfigLite } from "@/app/_lib/project-config-context";
import { GeneralTab } from "./GeneralTab";
import { ServerTab } from "./ServerTab";
import { ImportExportTab } from "./ImportExportTab";
import { DangerZoneTab } from "./DangerZoneTab";
import styles from "./settings.module.css";

const TABS = [
  { id: "general", label: "General" },
  { id: "access", label: "Access" },
  { id: "server", label: "Server" },
  { id: "import-export", label: "Import / Export" },
  { id: "danger", label: "Danger Zone" },
];

export function SettingsTabs({
  slug,
  project,
  config,
}: {
  slug: string;
  project: ProjectVM;
  config: ProjectConfigLite;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(
    useSearchParams().get("tab") ?? "general",
  );

  return (
    <>
      <Tabs
        tabs={TABS}
        active={active}
        onChange={(id) => {
          setActive(id);
          router.replace(`${pathname}?tab=${id}`, { scroll: false });
        }}
      />
      {active === "general" && (
        <GeneralTab slug={slug} project={project} config={config} />
      )}
      {active === "access" && (
        <div className={styles.tabPanel}>
          <p className={styles.note}>
            Access control is configured in the repository, not here.
          </p>
        </div>
      )}
      {active === "server" && (
        <ServerTab slug={slug} project={project} config={config} />
      )}
      {active === "import-export" && <ImportExportTab project={project} />}
      {active === "danger" && <DangerZoneTab slug={slug} />}
    </>
  );
}
