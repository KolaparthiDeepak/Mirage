"use client";
import { use, useState } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { commandCode } from "@/app/_lib/endpoint-label";
import { Select } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { RuleList } from "@/app/_features/rules/RuleList";
import { RuleBuilder } from "@/app/_features/rules/RuleBuilder";
import styles from "@/app/_features/rules/rules.module.css";

export default function RulesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;
  const [key, setKey] = useState(project.endpoints[0]?.key ?? "");
  const selected =
    project.endpoints.find((e) => e.key === key) ?? project.endpoints[0];

  return (
    <>
      <PageHeader title="Rules" description="Per-endpoint response selection." />

      {selected ? (
        <>
          <label className={styles.field}>
            <span className={styles.label}>Endpoint</span>
            <Select value={selected.key} onChange={(e) => setKey(e.target.value)}>
              {project.endpoints.map((e) => (
                <option key={e.key} value={e.key}>
                  {commandCode(e.path)}
                </option>
              ))}
            </Select>
          </label>

          <RuleList endpoint={selected} />
          <hr className={styles.divider} />
          <RuleBuilder key={selected.key} slug={slug} endpoint={selected} />
        </>
      ) : (
        <p className={styles.explainer}>This project has no endpoints.</p>
      )}
    </>
  );
}
