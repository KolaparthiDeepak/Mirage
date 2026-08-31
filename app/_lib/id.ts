// app/_lib/id.ts — one id helper for client-only preview state (envs, variables,
// scenario steps, rule drafts). Not cryptographic; just needs to be unique per call.
export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
