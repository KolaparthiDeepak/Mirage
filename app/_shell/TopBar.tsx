"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kbd } from "@/app/_ui";
import { getTheme, toggleTheme, type Theme } from "@/app/_lib/theme";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { GlobalSearch } from "./GlobalSearch";
import { AdminTokenModal } from "./AdminTokenModal";
import styles from "./shell.module.css";

export function TopBar({
  onMenuClick,
  onOpenPalette,
}: {
  onMenuClick?: () => void;
  onOpenPalette?: () => void;
}) {
  const pathname = usePathname();
  const inProject = pathname?.startsWith("/p/") ?? false;

  const [theme, setThemeState] = useState<Theme>("obsidian");
  useEffect(() => setThemeState(getTheme()), []);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        ☰
      </button>

      <Link href="/projects" className={styles.wordmark}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className={styles.wordmarkText}>Mirage</span>
      </Link>

      <div className={styles.topbarRight}>
        {inProject ? <ProjectSwitcher /> : null}
        <GlobalSearch />
        <button
          type="button"
          className={styles.paletteHint}
          aria-label="Open command palette"
          onClick={onOpenPalette}
        >
          <Kbd>⌘K</Kbd>
        </button>
        <span className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Running
        </span>
        <button
          type="button"
          aria-label="Set admin token"
          title="Set admin token — required to create, edit or delete mocks"
          className={styles.themeBtn}
          onClick={() => setTokenModalOpen(true)}
        >
          🔑
        </button>
        <button
          type="button"
          aria-label={theme === "paper" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "paper" ? "Switch to dark theme" : "Switch to light theme"}
          className={styles.themeBtn}
          onClick={() => {
            toggleTheme();
            setThemeState(getTheme());
          }}
        >
          {theme === "paper" ? "☀" : "☾"}
        </button>
      </div>
      <AdminTokenModal open={tokenModalOpen} onClose={() => setTokenModalOpen(false)} />
    </header>
  );
}
