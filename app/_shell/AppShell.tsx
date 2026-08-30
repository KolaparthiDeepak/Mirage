"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Drawer } from "@/app/_ui";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import styles from "./shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className={styles.shell}>
      <TopBar onMenuClick={() => setNavOpen(true)} />
      <Sidebar className={styles.sidebarDocked} />
      <main className={styles.main}>{children}</main>

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left">
        <Sidebar />
      </Drawer>
    </div>
  );
}
