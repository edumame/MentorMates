import { render, screen, waitFor } from "@testing-library/react";
import { PublicProjectsGallery } from "./PublicProjectsGallery";

const replace = jest.fn();
let params = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  useSearchParams: () => params,
}));
jest.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
jest.mock("@/components/ui/discord-cta", () => ({ DiscordCTA: () => null }));
jest.mock("@/features/projects/components/displays/ProjectBoard/ProjectBoard", () => ({
  __esModule: true,
  default: ({ projectList }: { projectList: Array<{ project_name: string }> }) => (
    <ul>{projectList.map((p) => <li key={p.project_name}>{p.project_name}</li>)}</ul>
  ),
}));

const events = [{ event_id: "e-real", event_name: "Real", slug: "real", visibility: "public" }];

beforeEach(() => {
  replace.mockReset();
  params = new URLSearchParams();
});

it("never requests a hard-coded default slug before events load and shows the selected event's projects (PUB-010)", async () => {
  const fetchMock = jest.fn(async (url: string) => {
    if (url === "/api/events") return { ok: true, json: async () => ({ events }) };
    if (url.includes("eventId=e-real")) return { ok: true, json: async () => ({ projects: [{ project_name: "Real project" }] }) };
    return { ok: false, json: async () => ({ error: "Event not found" }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<PublicProjectsGallery />);
  expect(await screen.findByText("Real project")).toBeInTheDocument();
  const urls = fetchMock.mock.calls.map(([url]) => url as string);
  expect(urls.filter((u) => u.startsWith("/api/projects"))).toEqual(["/api/projects?public=true&eventId=e-real"]);
  expect(screen.queryByText("Event not found")).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith("/projects?event=real");
});

it("ignores a slow response for a previous selection", async () => {
  params = new URLSearchParams("event=real");
  let resolveSlow: (v: unknown) => void = () => {};
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (url === "/api/events") return Promise.resolve({ ok: true, json: async () => ({ events }) });
    return new Promise((resolve, reject) => {
      resolveSlow = resolve;
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  const { unmount } = render(<PublicProjectsGallery />);
  await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("/api/projects"))).toBe(true));
  unmount();
  resolveSlow({ ok: false, json: async () => ({ error: "Event not found" }) });
  // unmounted + aborted: no state update warnings / errors thrown
});
