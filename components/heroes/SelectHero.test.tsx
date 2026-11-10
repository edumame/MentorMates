import { fireEvent, render, screen } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null }, error: null }) } } }));

import { SelectHero } from "./SelectHero";

it("sends mentors/judges to the real login page, not the missing /mentor/login (MENT-020)", () => {
  render(<SelectHero />);
  fireEvent.click(screen.getByRole("button", { name: /Mentor\/ Judge/ }));
  expect(push).toHaveBeenCalledWith("/login?returnUrl=%2Fevents");
});
