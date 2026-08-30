"use client";
import { useState, type ReactNode } from "react";
import { Drawer } from "@/app/_ui";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import styles from "./shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

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
