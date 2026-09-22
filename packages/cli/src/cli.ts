#!/usr/bin/env node
// Plan 19 — the `mirage` CLI entry point. `dev` and `validate` are fully
// implemented (no network, no auth — the two commands the plan itself calls
// out as highest-value and lowest-risk). `push`/`pull`/`tail`/`trace`/
// `flow run` need a running hosted deployment and a token (plan 14's
// stopgap, MIRAGE_ADMIN_TOKEN) to mean anything; they're recognised by name
// but not yet implemented — see the plan-19 commit message for the full
// scoping rationale.
import { fileURLToPath } from "node:url";
import { runValidate } from "./validate";
import { startDevServer } from "./dev-server";

export function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const NOT_YET_IMPLEMENTED = new Set(["push", "pull", "tail", "trace"]);

export interface DevOptions {
  mocksDir: string;
  port: number;
  watch: boolean;
}

/** Pulled out of the `dev` branch below so it's testable without actually
 *  starting a server (which would run until killed). */
export function resolveDevOptions(rest: string[]): DevOptions {
  const { positional, flags } = parseFlags(rest);
  return {
    mocksDir: positional[0] ?? "mocks",
    port: typeof flags.port === "string" ? Number(flags.port) : 3100,
    watch: flags["no-watch"] !== true, // --no-watch to disable; on by default
  };
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { positional } = parseFlags(rest);

  if (command === "dev") {
    const { mocksDir, port, watch } = resolveDevOptions(rest);
    const server = await startDevServer(mocksDir, { port, watch });
    console.log(`[mirage dev] serving ${mocksDir} at ${server.url}/m/<slug>/... (watch: ${watch ? "on" : "off"})`);
    await new Promise(() => {}); // run until the process is killed (Ctrl-C)
    return 0;
  }

  if (command === "validate") {
    const mocksDir = positional[0] ?? "mocks";
    const result = await runValidate(mocksDir);
    for (const w of result.warnings) console.warn(`warning: ${w}`);
    for (const e of result.errors) console.error(`error: ${e}`);
    if (result.ok) {
      console.log(`${result.projectCount} project(s) compiled cleanly${result.warnings.length > 0 ? ` (${result.warnings.length} warning(s))` : ""}`);
      return 0;
    }
    console.error(`${result.errors.length} error(s)`);
    return 1;
  }

  if (command === "flow" && positional[0] === "run") {
    console.error("mirage flow run: not yet implemented — needs plan 19's push/pull groundwork against a hosted project first");
    return 1;
  }

  if (command && NOT_YET_IMPLEMENTED.has(command)) {
    console.error(`mirage ${command}: not yet implemented`);
    return 1;
  }

  console.error(
    [
      "Usage: mirage <command> [options]",
      "",
      "  dev [dir] [--port 3100] [--no-watch]   serve mocks/** locally, hot reload",
      "  validate [dir]                          compile and report errors, exit non-zero",
      "",
      "Not yet implemented: push, pull, tail, trace, flow run",
    ].join("\n"),
  );
  return command ? 1 : 0;
}

// Only run when this file is the actual entry point (bin/mirage.mjs runs it
// via `node --import tsx/esm src/cli.ts`) — never when cli.test.ts imports
// `main` to test it directly.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
