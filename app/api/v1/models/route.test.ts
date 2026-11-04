/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/model-api/auth", () => ({ authenticateModelKey: jest.fn() }));
import { authenticateModelKey } from "@/lib/model-api/auth";
import { ModelApiError } from "@/lib/model-api/http";
import { GET } from "./route";

it("lists only registered models after API key authentication", async () => {
  (authenticateModelKey as jest.Mock).mockResolvedValue({ userId: "owner" });
  const response = await GET(new Request("https://example.com/api/v1/models"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ models: expect.arrayContaining([{ id: "jev-latest", provider: "typesafe", capability: "systemone" }]) });
});
it("requires an API key even when the caller has a browser session", async () => {
  (authenticateModelKey as jest.Mock).mockRejectedValue(new ModelApiError(401, "invalid_api_key", "Invalid"));
  expect((await GET(new Request("https://example.com/api/v1/models"))).status).toBe(401);
});
