import { render, screen, waitFor } from "@testing-library/react";
import { GalleryContent } from "./gallery-content";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const MEMBER_URL = "/api/projects?eventId=event-1";
const PUBLIC_URL = "/api/projects?eventId=event-1&public=true";

const project = {
  id: "project-1",
  project_name: "Booth demo",
  project_description: "Description",
  lead_name: "Project lead",
  event_id: "event-1",
  track_ids: [],
  created_at: "2026-01-01T00:00:00Z",
  submitted: true,
  teammates: [],
};

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const mockFetch = (responses: Record<string, Response>) => {
  const fetchMock = jest.fn(async (url: string) => {
    const response = responses[url];
    if (!response) throw new Error(`Unexpected fetch: ${url}`);
    return response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const renderGallery = () =>
  render(<GalleryContent eventId="event-1" slug="demo" hasJoined={false} />);

describe("GalleryContent project loading", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("shows submitted projects to a logged-out visitor of a public event", async () => {
    const fetchMock = mockFetch({
      [MEMBER_URL]: jsonResponse(401, { error: "Unauthorized" }),
      [PUBLIC_URL]: jsonResponse(200, { projects: [project] }),
    });

    renderGallery();

    // The card shows the name on both its cover and its body.
    expect((await screen.findAllByText("Booth demo")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(PUBLIC_URL);
    expect(screen.queryByText("No project yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a signed-in visitor on the member view", async () => {
    const fetchMock = mockFetch({
      [MEMBER_URL]: jsonResponse(200, { projects: [project] }),
    });

    renderGallery();

    // The card shows the name on both its cover and its body.
    expect((await screen.findAllByText("Booth demo")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(MEMBER_URL);
  });

  it("does not switch a signed-in visitor to the public view when the member view fails", async () => {
    const fetchMock = mockFetch({
      [MEMBER_URL]: jsonResponse(500, { error: "Failed to fetch projects" }),
    });

    renderGallery();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows an error, not the empty board, to a logged-out visitor of a private event", async () => {
    mockFetch({
      [MEMBER_URL]: jsonResponse(401, { error: "Unauthorized" }),
      [PUBLIC_URL]: jsonResponse(404, { error: "Event not found" }),
    });

    renderGallery();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /may be private or unavailable/i
    );
    expect(screen.queryByText("No project yet")).not.toBeInTheDocument();
  });

  it("shows an error, not the empty board, when the network request fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));

    renderGallery();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No project yet")).not.toBeInTheDocument();
  });

  it("keeps the empty board when an event genuinely has no projects", async () => {
    mockFetch({
      [MEMBER_URL]: jsonResponse(401, { error: "Unauthorized" }),
      [PUBLIC_URL]: jsonResponse(200, { projects: [] }),
    });

    renderGallery();

    expect(await screen.findByText("No project yet")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });
});
