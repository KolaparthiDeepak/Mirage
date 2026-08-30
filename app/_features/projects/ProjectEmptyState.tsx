import { Button, EmptyState, Tooltip } from "@/app/_ui";
import { CubeGlyph } from "./ProjectCard";
import styles from "./projects.module.css";

export function ProjectEmptyState() {
  return (
    <div className={styles.emptyWrap}>
      <EmptyState
        icon={<CubeGlyph />}
        title="Your API workspace is empty"
        body="Create your first mock server and start simulating APIs."
        action={
          <Tooltip label="Preview — coming soon">
            <Button variant="primary" disabled>
              Create project
            </Button>
          </Tooltip>
        }
      />
      <p className={styles.importHint}>or import an API specification</p>
    </div>
  );
}
