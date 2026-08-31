"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Modal, MethodPill, StatusCode, useToast } from "@/app/_ui";
import { useProject, useViewModel } from "@/app/_lib/view-model-context";
import { searchViewModel } from "@/app/_lib/search";
import { commandCode } from "@/app/_lib/endpoint-label";
import { toggleTheme } from "@/app/_lib/theme";
import { mockBaseUrl } from "@/app/_lib/mock-url";
import styles from "./shell.module.css";

interface Command {
  id: string;
  label: string;
  hint?: string;
  preview?: boolean;
  run: () => void;
}

interface Row {
  key: string;
  label?: string;
  content?: ReactNode;
  preview?: boolean;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const model = useViewModel();
  const toast = useToast();

  const slug = pathname.match(/^\/p\/([^/]+)/)?.[1] ?? "";
  const project = useProject(slug);
  const caseId = searchParams?.get("c") ?? null;

  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlightIndex(0);
    }
  }, [open]);
  useEffect(() => setHighlightIndex(0), [query]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: "theme", label: "Toggle theme", run: toggleTheme },
      { id: "go-projects", label: "Go to Projects", run: () => router.push("/projects") },
      {
        id: "go-endpoints",
        label: "Go to Endpoints (all)",
        preview: true,
        run: () => toast("Preview — the cross-project endpoints page is coming soon"),
      },
      {
        id: "go-traffic",
        label: "Go to Traffic",
        preview: true,
        run: () => toast("Preview — traffic is coming soon"),
      },
    ];

    if (project) {
      const s = project.slug;
      list.push(
        {
          id: "copy-url",
          label: "Copy mock base URL",
          run: () => {
            navigator.clipboard?.writeText(mockBaseUrl(s, project.basePath));
            toast("Mock base URL copied");
          },
        },
        { id: "go-overview", label: "Open Overview", run: () => router.push(`/p/${s}`) },
        { id: "go-eps", label: "Open Endpoints", run: () => router.push(`/p/${s}/endpoints`) },
        { id: "go-cases", label: "Open Cases", run: () => router.push(`/p/${s}/cases`) },
        {
          id: "new-ep",
          label: "New endpoint",
          preview: true,
          run: () => toast("Preview — add endpoints via the repo"),
        },
        {
          id: "new-case",
          label: "New case",
          preview: true,
          run: () => toast("Preview — cases are defined in the repo"),
        },
      );

      if (caseId) {
        const found = project.endpoints
          .flatMap((endpoint) => endpoint.cases.map((c) => ({ endpoint, case: c })))
          .find((x) => x.case.id === caseId);
        if (found) {
          list.push(
            {
              id: "run-case",
              label: "Run selected case",
              preview: true,
              run: () => toast("Focus the workspace and press ⌘↵ to run"),
            },
            {
              id: "copy-curl",
              label: "Copy cURL for selected case",
              run: () => {
                const resolved = found.case.request.curl
                  .split("$ORIGIN")
                  .join(window.location.origin);
                navigator.clipboard?.writeText(resolved);
                toast("cURL copied");
              },
            },
          );
        }
      }
    }
    return list;
  }, [router, toast, project, caseId]);

  const q = query.trim().toLowerCase();

  const commandRows = useMemo<Row[]>(() => {
    const matched = q === "" ? commands : commands.filter((c) => c.label.toLowerCase().includes(q));
    return matched.map((c) => ({
      key: c.id,
      label: c.label,
      preview: c.preview,
      run: () => {
        c.run();
        onClose();
      },
    }));
  }, [commands, q, onClose]);

  const resultRows = useMemo<Row[]>(() => {
    if (query.trim() === "") return [];
    const r = searchViewModel(model, query);
    const rows: Row[] = [];
    for (const p of r.projects) {
      const href = `/p/${p.slug}`;
      rows.push({
        key: `p:${p.slug}`,
        content: (
          <span>
            {p.name} <span className={styles.searchMuted}>/{p.slug}</span>
          </span>
        ),
        run: () => {
          router.push(href);
          onClose();
        },
      });
    }
    for (const { project: p, endpoint } of r.endpoints) {
      const href = `/p/${p.slug}/endpoints?e=${encodeURIComponent(endpoint.key)}`;
      rows.push({
        key: `e:${p.slug}:${endpoint.key}`,
        content: (
          <>
            <MethodPill method={endpoint.method} />
            <span>{commandCode(endpoint.path)}</span>
          </>
        ),
        run: () => {
          router.push(href);
          onClose();
        },
      });
    }
    for (const { project: p, endpoint, case: c } of r.cases) {
      const href = `/p/${p.slug}/endpoints?e=${encodeURIComponent(endpoint.key)}&c=${encodeURIComponent(c.id)}`;
      rows.push({
        key: `c:${p.slug}:${endpoint.key}:${c.id}`,
        content: (
          <>
            <StatusCode code={c.expected.status} />
            <span>{c.label}</span>
          </>
        ),
        run: () => {
          router.push(href);
          onClose();
        },
      });
    }
    return rows;
  }, [model, query, router, onClose]);

  const rows = useMemo(() => [...commandRows, ...resultRows], [commandRows, resultRows]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[highlightIndex]?.run();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Command palette">
      <div className={styles.palette} onKeyDown={onKeyDown}>
        <input
          autoFocus
          aria-label="Command or search"
          className={styles.paletteInput}
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.paletteList}>
          {rows.map((row, i) => (
            <Fragment key={row.key}>
              {i === commandRows.length && resultRows.length > 0 && (
                <div className={styles.searchGroupLabel}>Results</div>
              )}
              <button
                type="button"
                className={
                  i === highlightIndex
                    ? `${styles.searchRow} ${styles.searchRowActive}`
                    : styles.searchRow
                }
                onMouseEnter={() => setHighlightIndex(i)}
                onClick={() => row.run()}
              >
                {row.label ? <span>{row.label}</span> : row.content}
                {row.preview && <Badge tone="warning">Preview</Badge>}
              </button>
            </Fragment>
          ))}
          {rows.length === 0 && <div className={styles.searchEmpty}>No matches</div>}
        </div>
      </div>
    </Modal>
  );
}
