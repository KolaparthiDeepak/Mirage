import { Button, EmptyState } from "@/app/_ui";
import { CubeGlyph } from "./ProjectCard";
import styles from "./projects.module.css";

export function ProjectEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className={styles.emptyWrap}>
      <EmptyState
        icon={<CubeGlyph />}
        title="Your API workspace is empty"
        body="Create your first mock server and start simulating APIs."
        action={
          <Button variant="primary" onClick={onCreate}>
            Create project
          </Button>
        }
      />
      <p className={styles.importHint}>or import an API specification</p>
    </div>
  );
}
