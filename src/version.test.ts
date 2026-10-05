import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";

describe("APP_VERSION", () => {
  it("exports a non-empty semantic version string", () => {
    expect(typeof APP_VERSION).toBe("string");
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
