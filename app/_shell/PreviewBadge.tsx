"use client";
import { Badge, Tooltip } from "@/app/_ui";

export function PreviewBadge() {
  return (
    <Tooltip label="Local only — not saved to the backend">
      <Badge tone="warning">Preview</Badge>
    </Tooltip>
  );
}
