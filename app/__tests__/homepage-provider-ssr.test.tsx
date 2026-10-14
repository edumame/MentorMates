/** @jest-environment node */
import { renderToString } from "react-dom/server";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { AuthContextProvider } from "@/features/user/authentication/auth/AuthContext";
import HomePage from "../page";

jest.mock("next/navigation", () => ({ usePathname: jest.fn(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("posthog-js", () => ({ identify: jest.fn() }));
jest.mock("@/components/heroes/LandingHero", () => ({ LandingHero: () => <h1>MentorMates landing</h1> }));
jest.mock("@/components/heroes/AuthHero", () => ({ AuthHero: () => <main>Member dashboard</main> }));
jest.mock("@/components/layout/SidebarLayout", () => ({ SidebarLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/components/utils/ServiceWorkerRegistration", () => ({ ServiceWorkerRegistration: () => null }));

it("includes landing and footer in initial HTML through both real auth providers", () => {
  (usePathname as jest.Mock).mockReturnValue("/");
  const html = renderToString(<AuthContextProvider><AuthProvider><HomePage /></AuthProvider></AuthContextProvider>);
  expect(html).toContain("<h1>MentorMates landing</h1>");
  expect(html).toContain("<footer");
  expect(html).toContain("Join our newsletter");
  expect(html).toContain('href="/privacy"');
});

it("does not render protected content before client authentication", () => {
  (usePathname as jest.Mock).mockReturnValue("/dashboard");
  expect(renderToString(<AuthProvider><main>Private content</main></AuthProvider>)).toBe("");
});

// Image rendering is unrelated to footer visibility and auth SSR.
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
