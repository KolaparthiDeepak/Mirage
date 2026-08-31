"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

type NavItem = { label: string; href: string; soon?: boolean };

const WORKSPACE: NavItem[] = [
  { label: "Projects", href: "/projects" },
  // TODO(phase-2): drop `soon` when /endpoints lands
  { label: "Endpoints", href: "/endpoints", soon: true },
  { label: "Traffic", href: "/traffic" },
];

function projectItems(slug: string): NavItem[] {
  return [
    { label: "Overview", href: `/p/${slug}` },
    { label: "Endpoints", href: `/p/${slug}/endpoints` },
    { label: "Cases", href: `/p/${slug}/cases` },
    // TODO(phase-3): drop `soon` when /p/<slug>/rules lands
    { label: "Rules", href: `/p/${slug}/rules`, soon: true },
    // TODO(phase-4): drop `soon` when /p/<slug>/scenarios lands
    { label: "Scenarios", href: `/p/${slug}/scenarios`, soon: true },
    { label: "Environments", href: `/p/${slug}/environments` },
    // TODO(phase-4): drop `soon` when /p/<slug>/variables lands
    { label: "Variables", href: `/p/${slug}/variables`, soon: true },
  ];
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const slug = pathname.match(/^\/p\/([^/]+)/)?.[1];

  function navLink(item: NavItem) {
    if (item.soon) {
      return (
        <span
          key={item.href}
          className={styles.navLinkSoon}
          aria-disabled="true"
          title="Coming soon"
        >
          {item.label}
        </span>
      );
    }
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
        aria-current={active ? "page" : undefined}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <nav className={[styles.sidebar, className].filter(Boolean).join(" ")}>
      <div className={styles.navGroup}>
        <div className={styles.navGroupLabel}>Workspace</div>
        {WORKSPACE.map(navLink)}
      </div>

      {slug ? (
        <div className={`${styles.navGroup} ${styles.navGroupGrow}`}>
          <div className={styles.navGroupLabel}>Project</div>
          {projectItems(slug).map(navLink)}
          <div className={styles.spacer} />
          {/* TODO(phase-5): drop `soon` when /p/<slug>/settings lands */}
          {navLink({ label: "Settings", href: `/p/${slug}/settings`, soon: true })}
        </div>
      ) : null}
    </nav>
  );
}
