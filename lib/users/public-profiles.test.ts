import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  fetchTeamProfilesByEmails,
  fetchPublicProfilesByIds,
} from "./public-profiles";

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

function mockServiceResult(result: { data: unknown; error: unknown }) {
  const select = jest.fn().mockReturnThis();
  const inFilter = jest.fn().mockResolvedValue(result);
  mockCreateServiceClient.mockReturnValue({
    from: () => ({ select, in: inFilter }),
  });
  return { select, inFilter };
}

describe("public profile reads", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  describe("fetchPublicProfilesByIds", () => {
    it("selects display-safe columns only and keys rows by uid", async () => {
      const profile = {
        uid: "u1",
        display_name: "Judy",
        bio: null,
        avatar_url: null,
        affiliation: "ACME",
      };
      const { select, inFilter } = mockServiceResult({
        data: [profile],
        error: null,
      });

      const profiles = await fetchPublicProfilesByIds(["u1"]);

      expect(select).toHaveBeenCalledWith(
        "uid, display_name, bio, avatar_url, affiliation"
      );
      expect(inFilter).toHaveBeenCalledWith("uid", ["u1"]);
      expect(profiles.get("u1")).toEqual(profile);
    });

    it("skips the query when there are no ids", async () => {
      await expect(fetchPublicProfilesByIds([])).resolves.toEqual(new Map());
      expect(mockCreateServiceClient).not.toHaveBeenCalled();
    });

    it("returns nothing when the query fails", async () => {
      mockServiceResult({ data: null, error: new Error("boom") });
      await expect(fetchPublicProfilesByIds(["u1"])).resolves.toEqual(
        new Map()
      );
    });

    it("returns nothing when the service key is missing", async () => {
      mockCreateServiceClient.mockImplementation(() => {
        throw new Error("supabaseKey is required.");
      });
      await expect(fetchPublicProfilesByIds(["u1"])).resolves.toEqual(
        new Map()
      );
    });
  });

  describe("fetchTeamProfilesByEmails", () => {
    it("normalizes the lookup and result, nulling blank fields", async () => {
      const { inFilter } = mockServiceResult({
        data: [
          {
            email: "Lead@Example.com",
            display_name: "  Lea Lead ",
            avatar_url: " https://cdn.example.com/lea.png ",
            affiliation: " State U ",
          },
          {
            email: "blank@example.com",
            display_name: "   ",
            avatar_url: "",
            affiliation: null,
          },
          {
            email: null,
            display_name: "No Email",
            avatar_url: null,
            affiliation: null,
          },
        ],
        error: null,
      });

      const profiles = await fetchTeamProfilesByEmails([
        "LEAD@example.com",
        "lead@example.com",
        null,
        "",
        "blank@example.com",
      ]);

      expect(inFilter).toHaveBeenCalledWith("email", [
        "lead@example.com",
        "blank@example.com",
      ]);
      expect(profiles).toEqual({
        "lead@example.com": {
          display_name: "Lea Lead",
          avatar_url: "https://cdn.example.com/lea.png",
          affiliation: "State U",
        },
        "blank@example.com": {
          display_name: null,
          avatar_url: null,
          affiliation: null,
        },
      });
    });

    it("skips the query when there are no emails", async () => {
      await expect(fetchTeamProfilesByEmails([null])).resolves.toEqual({});
      expect(mockCreateServiceClient).not.toHaveBeenCalled();
    });

    it("returns nothing when the query fails", async () => {
      mockServiceResult({ data: null, error: new Error("boom") });
      await expect(fetchTeamProfilesByEmails(["a@b.co"])).resolves.toEqual({});
    });
  });
});
