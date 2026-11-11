/** @jest-environment node */
import { renderToString } from "react-dom/server";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({ useAuth: jest.fn() }));

it.each([
  { isLoading: true, isAuthenticated: false },
  { isLoading: true, isAuthenticated: true },
  { isLoading: false, isAuthenticated: true },
])("preserves default hiding for %j but keeps explicit public presentation", (auth) => {
  (useAuth as jest.Mock).mockReturnValue(auth);
  expect(renderToString(<Footer />)).toBe("");
  const html = renderToString(<Footer publicPresentation />);
  expect(html).toContain("<footer");
  expect(html).toContain("Join our newsletter");
});

it("renders the default footer for a resolved anonymous session", () => {
  (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isAuthenticated: false });
  expect(renderToString(<Footer />)).toContain("<footer");
});

// Image rendering is unrelated to footer visibility and auth SSR.
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
