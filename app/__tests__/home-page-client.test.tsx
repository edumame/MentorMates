import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, render, screen, waitFor } from "@testing-library/react";
import { HomePageClient } from "../HomePageClient";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import posthog from "posthog-js";

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("posthog-js", () => ({ identify: jest.fn() }));
jest.mock("@/components/heroes/AuthHero", () => ({ AuthHero: () => <main>Member dashboard</main> }));
jest.mock("@/components/layout/SidebarLayout", () => ({ SidebarLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/components/utils/ServiceWorkerRegistration", () => ({ ServiceWorkerRegistration: () => null }));

it("keeps landing visible until login, syncs the profile once, and restores landing on logout", async () => {
  const select = jest.fn().mockResolvedValue({ error: null });
  const upsert = jest.fn().mockReturnValue({ select });
  (supabase.from as jest.Mock).mockReturnValue({ upsert });
  (useAuth as jest.Mock).mockReturnValue({ session: null, isLoading: true });
  const content = <HomePageClient><h1>Landing</h1></HomePageClient>;
  const { rerender } = render(content);
  expect(screen.getByRole("heading", { name: "Landing" })).toBeInTheDocument();
  expect(supabase.from).not.toHaveBeenCalled();

  const session = { user: { id: "member", email: "member@example.com", user_metadata: { full_name: "Member" } } };
  (useAuth as jest.Mock).mockReturnValue({ session, isLoading: false });
  rerender(<HomePageClient><h1>Landing</h1></HomePageClient>);
  expect(screen.getByText("Member dashboard")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Landing" })).not.toBeInTheDocument();
  await waitFor(() => expect(posthog.identify).toHaveBeenCalledWith("member", { email: "member@example.com", display_name: "Member" }));
  expect(supabase.from).toHaveBeenCalledWith("user_profiles");
  expect(upsert).toHaveBeenCalledWith({ uid: "member", email: "member@example.com", display_name: "Member" }, { onConflict: "email" });

  (useAuth as jest.Mock).mockReturnValue({ session: { ...session }, isLoading: false });
  rerender(<HomePageClient><h1>Landing</h1></HomePageClient>);
  expect(upsert).toHaveBeenCalledTimes(1);
  (useAuth as jest.Mock).mockReturnValue({ session: null, isLoading: false });
  rerender(<HomePageClient><h1>Landing</h1></HomePageClient>);
  expect(screen.getByRole("heading", { name: "Landing" })).toBeInTheDocument();
});


it("hydrates server landing HTML with a cached client session without recoverable errors", async () => {
  const select = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock).mockReturnValue({ upsert: jest.fn().mockReturnValue({ select }) });
  const content = <HomePageClient><h1>Landing</h1></HomePageClient>;
  (useAuth as jest.Mock).mockReturnValue({ session: null, isLoading: true });
  const container = document.createElement("div");
  container.innerHTML = renderToString(content);
  document.body.appendChild(container);
  expect(container.textContent).toBe("Landing");
  (useAuth as jest.Mock).mockReturnValue({
    session: { user: { id: "cached", email: "cached@example.com", user_metadata: { full_name: "Cached" } } },
    isLoading: true,
  });
  const onRecoverableError = jest.fn();
  let root!: ReturnType<typeof hydrateRoot>;
  try {
    await act(async () => { root = hydrateRoot(container, content, { onRecoverableError }); });
    expect(container.textContent).toBe("Member dashboard");
    expect(onRecoverableError).not.toHaveBeenCalled();
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});
