// Plan 19 — `mirage validate`: compile the mocks directory and report every
// error/warning, exit non-zero on any error. The file-workflow equivalent of
// the hosted build gate — meant for a pre-commit hook or CI, so the repo path
// stays first-class even for a team that has moved most projects to the store.
//
// Depends on the main app's compiler directly (yaml/zod/swagger-parser),
// not on @mirage/engine — see packages/engine/README.md for why the compiler
// isn't in the "zero dependency" resolver package.
import { compileMocks } from "../../../src/compile/compile";

export interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  projectCount: number;
}

export async function runValidate(mocksDir: string): Promise<ValidateResult> {
  const result = await compileMocks(mocksDir, "validate");
  return {
    ok: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
    projectCount: Object.keys(result.bundle.projects).length,
  };
}
