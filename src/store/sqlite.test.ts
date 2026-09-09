import { SqliteStore } from "./sqlite";
import { runStoreConformanceSuite } from "./conformance";

// In-memory: no file, no cleanup, fresh per test-file run — the SQLite driver
// is fully testable with no external service, which is the point of plan 02
// pulling it forward from plan 20 into here.
runStoreConformanceSuite("sqlite", () => new SqliteStore(":memory:"));
