import { describe, expect, it } from "vitest";
import { GET } from "../../../app/api/openapi/route";

describe("GET /api/openapi", () => {
  it("returns an OpenAPI document for the implemented API routes", async () => {
    const response = await GET();
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths["/api/health"].get.responses["200"]).toBeDefined();
    expect(
      document.paths["/api/profiles/setup"].post.requestBody,
    ).toBeDefined();
    expect(document.paths["/api/recipes/{id}/like"].post).toBeDefined();
    expect(
      document.paths["/api/map/regions/{region_code}/recipes"].get,
    ).toBeDefined();
    expect(Object.keys(document.paths).sort()).toEqual(
      [
        "/api/analyze",
        "/api/chat",
        "/api/health",
        "/api/home",
        "/api/map/regions",
        "/api/map/regions/{region_code}/recipes",
        "/api/profiles/{id}",
        "/api/profiles/me",
        "/api/profiles/me/recipes",
        "/api/profiles/me/saved",
        "/api/profiles/setup",
        "/api/recipes",
        "/api/steps/images",
        "/api/recipes/{id}",
        "/api/recipes/{id}/like",
        "/api/recipes/{id}/save",
        "/api/search/recipes",
        "/api/sensory/vectorize",
        "/api/stt",
        "/api/uploads/sign",
      ].sort(),
    );
  });
});
