"use client";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Drawer, useToast } from "@/app/_ui";
import { useShortcuts } from "@/app/_lib/shortcuts";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import styles from "./shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const toast = useToast();

  useEffect(() => {
    setNavOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // mod+enter (execute) and mod+shift+c (copy cURL) are handled locally in RequestBuilder / EndpointWorkspace.
  const shortcutMap = useMemo(
    () => ({
      "mod+k": () => setPaletteOpen((o) => !o),
      "mod+p": openPalette, // opens the palette (Switch project lives there); acceptable
      "mod+e": () => toast("Preview — add endpoints via the repo"),
      "mod+s": () => toast("Preview — cases are defined in the repo"),
      esc: () => {
        setNavOpen(false);
        setPaletteOpen(false);
      },
    }),
    [toast, openPalette],
  );
  useShortcuts(shortcutMap);

  return (
    <div className={styles.shell}>
      <TopBar onMenuClick={() => setNavOpen(true)} onOpenPalette={openPalette} />
      <Sidebar className={styles.sidebarDocked} />
      <main className={styles.main}>{children}</main>

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} side="left">
        <Sidebar />
      </Drawer>

      {/* Suspense: CommandPalette reads useSearchParams; keeps static pages prerenderable. */}
      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onClose={closePalette} />
      </Suspense>
    </div>
  );
}
