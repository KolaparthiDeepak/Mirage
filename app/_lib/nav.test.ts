import { describe, it, expect } from "vitest";
import { projectHref, endpointHref, caseHref } from "./nav";

describe("nav href builders", () => {
  it("projectHref leaves the slug untouched", () => {
    expect(projectHref("card-block-lost")).toBe("/p/card-block-lost");
  });

  it("endpointHref encodes a key with a space and slashes", () => {
    expect(endpointHref("card-block-lost", "POST /x/GET_CARD/v1")).toBe(
      "/p/card-block-lost/endpoints?e=POST%20%2Fx%2FGET_CARD%2Fv1",
    );
  });

  it("caseHref encodes both the key and the case id", () => {
    expect(caseHref("card-block-lost", "POST /x/GET_CARD/v1", "locate happy")).toBe(
      "/p/card-block-lost/endpoints?e=POST%20%2Fx%2FGET_CARD%2Fv1&c=locate%20happy",
    );
  });
});
