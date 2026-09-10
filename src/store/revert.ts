// Plan 15 — compute the project state that undoes one config event. Pure: the
// caller persists the result via saveProject with a new `revert` event, so
// history stays append-only and a revert-of-a-revert is coherent.
import type { ConfigEvent, StoredProject, StoredRule } from "./types";
import type { Rule } from "../compile/schema";

/** Canonical JSON — keys sorted at every depth — for a change-detection
 *  comparison that doesn't care about property order. */
function stable(x: unknown): string {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(canon(x));
}

export interface RevertResult {
  project: StoredProject;
  /** When set, the target changed since the event — the caller must confirm
   *  (force) before applying. */
  conflict?: string;
}

export function revertEvent(project: StoredProject, event: ConfigEvent, force = false): RevertResult {
  const rules = project.rules.map((r) => ({ ...r }));
  const findRule = (id: string) => rules.find((r) => r.ruleId === id);

  switch (event.kind) {
    case "rule.create": {
      const cur = event.targetId ? findRule(event.targetId) : undefined;
      if (!cur) return { project, conflict: `rule "${event.targetId}" no longer exists — nothing to undo` };
      if (!force && stable(cur.definition) !== stable(event.after)) {
        return { project, conflict: `rule "${event.targetId}" changed since it was created` };
      }
      return { project: { ...project, rules: rules.filter((r) => r.ruleId !== event.targetId) } };
    }

    case "rule.delete": {
      if (event.targetId && findRule(event.targetId)) {
        return { project, conflict: `a rule "${event.targetId}" already exists` };
      }
      const before = event.before as (Rule & { position?: number }) | null;
      if (!before) return { project, conflict: "deleted rule has no recorded state" };
      const { position, ...definition } = before;
      const restored: StoredRule = {
        ruleId: definition.id,
        position: position ?? rules.length,
        definition: definition as Rule,
      };
      return { project: { ...project, rules: [...rules, restored] } };
    }

    case "rule.update": {
      const cur = event.targetId ? findRule(event.targetId) : undefined;
      if (!cur) return { project, conflict: `rule "${event.targetId}" no longer exists` };
      if (!force && stable(cur.definition) !== stable(event.after)) {
        return { project, conflict: `rule "${event.targetId}" changed since this edit` };
      }
      cur.definition = event.before as Rule;
      return { project: { ...project, rules } };
    }

    case "rule.reorder": {
      const currentOrder = [...rules].sort((a, b) => a.position - b.position).map((r) => r.ruleId);
      if (!force && stable(currentOrder) !== stable(event.after)) {
        return { project, conflict: "the rule order changed since this reorder" };
      }
      const target = event.before as string[];
      const byId = new Map(rules.map((r) => [r.ruleId, r]));
      if (!target.every((id) => byId.has(id)) || target.length !== rules.length) {
        return { project, conflict: "the recorded order references rules that no longer exist" };
      }
      return { project: { ...project, rules: target.map((id, position) => ({ ...byId.get(id)!, position })) } };
    }

    case "project.update": {
      const before = event.before as Partial<StoredProject> | null;
      if (!before) return { project, conflict: "no recorded project state" };
      return {
        project: {
          ...project,
          name: before.name ?? project.name,
          basePath: before.basePath,
          defaults: (before.defaults as StoredProject["defaults"]) ?? project.defaults,
          upstream: before.upstream,
          faults: before.faults,
          contract: before.contract,
          defaultEnvironment: before.defaultEnvironment,
          // secrets are stored as "***" in the event — keep the live values
          variables: project.variables,
        },
      };
    }

    default:
      return { project, conflict: `events of kind "${event.kind}" cannot be reverted` };
  }
}
