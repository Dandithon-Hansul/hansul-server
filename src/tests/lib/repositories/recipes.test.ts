import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { searchRecipes } from "@/lib/repositories/recipes";

it("제목, 지역, 전승자 이름을 함께 검색하고 공개·발행 조건을 적용한다", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json([]));
  const client = createClient("https://test.supabase.co", "test-key", {
    global: { fetch },
  });

  await searchRecipes(client, { q: "전승자", regionCode: "47110", limit: 5 });

  const params = new URL(String(fetch.mock.calls[0][0])).searchParams;
  expect(params.get("select")).toContain("transmitter:profiles!transmitter_id(display_name)");
  expect(params.get("select")).toContain("transmitter_match:profiles!transmitter_id()");
  expect(params.get("transmitter_match.display_name")).toBe("ilike.%전승자%");
  expect(params.get("or")).toBe(
    "(title.ilike.%전승자%,region.ilike.%전승자%,transmitter_match.not.is.null)",
  );
  expect(params.get("status")).toBe("eq.published");
  expect(params.get("visibility")).toBe("eq.public");
  expect(params.get("region_code")).toBe("eq.47110");
  expect(params.get("limit")).toBe("5");
});
