// Plan 19 — @mirage/engine: the pure, dependency-free resolver the hosted
// service runs, packaged so it can run anywhere else too (a consumer's own
// test suite, `mirage dev`, or a future edge runtime). See README.md for
// what is deliberately NOT in this package and why.
export { resolve, stripBasePath, buildResponse } from "../../../src/engine/resolve";
export { parseRequest } from "../../../src/engine/request";
export { serveMock, type ServeOutcome } from "./serve";

export type {
  HttpMethod,
  ParsedRequest,
  Segment,
  Operator,
  MatchCondition,
  MockResponse,
  Route,
  ProjectConfig,
  ResolveResult,
  TemplateContext,
  UpstreamConfig,
  ContractConfig,
  DocsConfig,
  DriftConfig,
  ProjectVariable,
} from "../../../src/engine/types";
