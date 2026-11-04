/** @jest-environment node */
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("redirected");
  }),
}));
jest.mock("./developer-console", () => ({
  __esModule: true,
  default: () => null,
}));
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { redirect } from "next/navigation";
import DeveloperPage from "./page";

it.each([null, { id: "anonymous", is_anonymous: true }])(
  "redirects visitors without an account to login with the return URL",
  async (user) => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    });
    await expect(DeveloperPage()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/login?returnUrl=%2Fdevelopers");
  },
);
