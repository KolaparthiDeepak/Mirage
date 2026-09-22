// Plan 24 — /__mock/ready: deployment gating. Fails (503) only when config
// resolution actually depends on something that can be down — the store —
// and that thing is unreachable. In bundle mode (the default) or files mode,
// config is either a build-time constant or a local file read, neither of
// which the store can take down, so this is unconditionally ready — "the
// store is unreachable" is a category error when nothing here needs it.
import { configSource, getRuntimeStore } from "@/src/store/runtime-source";

export async function GET(): Promise<Response> {
  const source = configSource();
  if (source !== "store") {
    return Response.json({ ready: true, configSource: source });
  }

  try {
    const store = await getRuntimeStore();
    // Cheapest real round-trip that proves the store answers: a lookup for a
    // slug that will not exist. A miss (null) still means it answered —
    // only a thrown error means "unreachable".
    await store.getConfigVersion("__mirage_ready_check__");
    return Response.json({ ready: true, configSource: source });
  } catch (e) {
    return Response.json({ ready: false, configSource: source, error: (e as Error).message }, { status: 503 });
  }
}
