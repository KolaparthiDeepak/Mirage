"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Drawer } from "@/app/_ui";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import styles from "./shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setNavOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={styles.shell}>
      <TopBar
        onMenuClick={() => setNavOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <Sidebar className={styles.sidebarDocked} />
      <main className={styles.main}>{children}</main>

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left">
        <Sidebar />
      </Drawer>

      {/* Suspense: CommandPalette reads useSearchParams; keeps static pages prerenderable. */}
      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </Suspense>
    </div>
  );
}
