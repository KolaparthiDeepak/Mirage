"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kbd } from "@/app/_ui";
import { toggleTheme } from "@/app/_lib/theme";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { GlobalSearch } from "./GlobalSearch";
import styles from "./shell.module.css";

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const inProject = pathname?.startsWith("/p/") ?? false;

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
        <Kbd>⌘K</Kbd>
        <span className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Running
        </span>
        <button
          type="button"
          aria-label="Toggle theme"
          className={styles.themeBtn}
          onClick={() => toggleTheme()}
        >
          ☀
        </button>
      </div>
    </header>
  );
}
