import { render, screen, waitFor } from "@testing-library/react";

jest.mock("@/features/projects/components/displays/ProjectBoard/ProjectBoard", () => ({
  __esModule: true,
  default: ({ projectList }: { projectList: Array<{ project_name: string }> }) => (
    <ul>
      {projectList.map((p) => (
        <li key={p.project_name}>{p.project_name}</li>
      ))}
    </ul>
  ),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));

import { GalleryContent, galleryProjectsUrl } from "./gallery-content";

describe("galleryProjectsUrl (NEW-005)", () => {
  it("uses the public listing for signed-out viewers", () => {
    expect(galleryProjectsUrl("ev-1", false)).toBe("/api/projects?eventId=ev-1&public=true");
  });
  it("uses the authenticated listing for signed-in viewers", () => {
    expect(galleryProjectsUrl("ev-1", true)).toBe("/api/projects?eventId=ev-1");
  });
  it("encodes the event id", () => {
    expect(galleryProjectsUrl("a&b", false)).toBe("/api/projects?eventId=a%26b&public=true");
  });
});

describe("GalleryContent", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch(response: { ok: boolean; body?: unknown }) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: response.ok,
      json: async () => response.body,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("lists projects for a signed-out visitor via public=true", async () => {
    const fetchMock = mockFetch({ ok: true, body: { projects: [{ project_name: "QA Gallery Project" }] } });
    render(<GalleryContent eventId="ev-1" slug="ev" hasJoined={false} isSignedIn={false} />);
    expect(await screen.findByText("QA Gallery Project")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects?eventId=ev-1&public=true");
  });

  it("uses the authenticated listing for a signed-in member", async () => {
    const fetchMock = mockFetch({ ok: true, body: { projects: [] } });
    render(<GalleryContent eventId="ev-1" slug="ev" hasJoined isSignedIn userRole="participant" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects?eventId=ev-1"));
  });

  it("shows an empty gallery (no crash) when the listing fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({ ok: false });
    render(<GalleryContent eventId="ev-1" slug="ev" hasJoined={false} isSignedIn={false} />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
