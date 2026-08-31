"use client";
import { Input, Select, Tabs } from "@/app/_ui";
import styles from "./endpoints.module.css";

export function EndpointToolbar({
  query,
  onQuery,
  method,
  onMethod,
  methods,
  view,
  onView,
  viewTabsId,
}: {
  query: string;
  onQuery: (v: string) => void;
  method: string;
  onMethod: (v: string) => void;
  methods: string[];
  view: "all" | "grouped";
  onView: (v: "all" | "grouped") => void;
  /** Shared with `tabPanelProps` in the page so the tabs control the list panel. */
  viewTabsId?: string;
}) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.search}>
        <Input
          aria-label="Search endpoints"
          placeholder="Search endpoints"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </span>
      <Select
        aria-label="Filter by method"
        value={method}
        onChange={(e) => onMethod(e.target.value)}
      >
        <option value="all">All methods</option>
        {methods.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "grouped", label: "Grouped" },
        ]}
        active={view}
        onChange={(id) => onView(id as "all" | "grouped")}
        idBase={viewTabsId}
      />
    </div>
  );
}
