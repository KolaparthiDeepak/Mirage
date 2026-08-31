"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Input, MethodPill, StatusCode } from "@/app/_ui";
import { useViewModel } from "@/app/_lib/view-model-context";
import { useDebounced } from "@/app/_lib/use-debounced";
import { searchViewModel } from "@/app/_lib/search";
import { commandCode } from "@/app/_lib/endpoint-label";
import { projectHref, endpointHref, caseHref } from "@/app/_lib/nav";
import styles from "./shell.module.css";

function Cube() {
  return (
    <svg
      width="14"
      height="14"
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
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const model = useViewModel();
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const [rawQuery, setRawQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const q = useDebounced(rawQuery, 120);
  const results = useMemo(() => searchViewModel(model, q), [model, q]);

  // Grouped rows, each group tagged with its start offset in the flattened list.
  const groups = useMemo(() => {
    const raw = [
      {
        label: "Projects",
        items: results.projects.map((project) => ({
          href: projectHref(project.slug),
          node: (
            <>
              <Cube />
              <span>{project.name}</span>
              <span className={styles.searchMuted}>/{project.slug}</span>
            </>
          ),
        })),
      },
      {
        label: "Endpoints",
        items: results.endpoints.map(({ project, endpoint }) => ({
          href: endpointHref(project.slug, endpoint.key),
          node: (
            <>
              <MethodPill method={endpoint.method} />
              <span>{commandCode(endpoint.path)}</span>
              <span className={styles.searchMuted}>{project.name}</span>
            </>
          ),
        })),
      },
      {
        label: "Cases",
        items: results.cases.map(({ project, endpoint, case: c }) => ({
          href: caseHref(project.slug, endpoint.key, c.id),
          node: (
            <>
              <StatusCode code={c.expected.status} />
              <span>{c.label}</span>
              <span className={styles.searchMuted}>{commandCode(endpoint.path)}</span>
            </>
          ),
        })),
      },
    ];

    let start = 0;
    const out: { label: string; start: number; items: { href: string; node: ReactNode }[] }[] = [];
    for (const g of raw) {
      if (g.items.length === 0) continue;
      out.push({ ...g, start });
      start += g.items.length;
    }
    return out;
  }, [results]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setHighlightIndex(0), [q]);
  // Keep the highlight in range when the result set shrinks (M-12).
  useEffect(() => {
    setHighlightIndex((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  const panelOpen = focused && q.trim() !== "";

  // Dismiss on outside pointerdown rather than on blur, so Tab can move into the
  // result rows without collapsing the panel (I-4).
  useEffect(() => {
    if (!panelOpen) return;
    function onDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [panelOpen]);

  function blurInput() {
    wrapRef.current?.querySelector("input")?.blur();
  }

  function go(href: string) {
    router.push(href);
    setRawQuery("");
    setExpanded(false);
    blurInput();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const target = flat[highlightIndex];
      if (target) go(target.href);
    } else if (e.key === "Escape") {
      setRawQuery("");
      setExpanded(false);
      setFocused(false);
      blurInput();
    }
  }

  const activeRowId = flat.length > 0 ? `${listId}-${highlightIndex}` : undefined;

  return (
    <div
      ref={wrapRef}
      className={styles.search}
      data-expanded={expanded ? "true" : undefined}
    >
      <button
        type="button"
        className={styles.searchToggle}
        aria-label="Open search"
        onClick={() => {
          setExpanded(true);
          wrapRef.current?.querySelector("input")?.focus();
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>

      <Input
        role="combobox"
        aria-label="Search Mirage"
        aria-expanded={panelOpen}
        aria-controls={listId}
        aria-activedescendant={activeRowId}
        placeholder="Search projects, endpoints, cases…"
        value={rawQuery}
        onChange={(e) => setRawQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={onKeyDown}
      />

      {panelOpen && (
        <div className={styles.searchPanel} role="listbox" id={listId}>
          {flat.length === 0 ? (
            <div className={styles.searchEmpty}>No matches</div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className={styles.searchGroupLabel}>{group.label}</div>
                {group.items.map((item, j) => {
                  const i = group.start + j;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      role="option"
                      id={`${listId}-${i}`}
                      aria-selected={i === highlightIndex}
                      className={
                        i === highlightIndex
                          ? `${styles.searchRow} ${styles.searchRowActive}`
                          : styles.searchRow
                      }
                      onMouseEnter={() => setHighlightIndex(i)}
                      onClick={() => go(item.href)}
                    >
                      {item.node}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
