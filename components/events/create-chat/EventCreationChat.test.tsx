import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CHAT_STORAGE_KEY, EventCreationChat } from "./EventCreationChat";
import { applyDraftPatch, emptyDraft, type EventDraft } from "@/lib/events/chat-draft";

// react-markdown is ESM-only; the repo's tests stub it like this.
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
jest.mock("@/components/markdown/plugins", () => ({ markdownRehypePlugins: [], markdownRemarkPlugins: [] }));
jest.mock("@/components/markdown/custom-components", () => ({ customMarkdownComponents: {} }));

let params = new URLSearchParams();
const push = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push }),
}));

const LA = "America/Los_Angeles";
const fetchMock = jest.fn();
const realFetch = global.fetch;

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

const BUILD_NEXT_TEXT =
  "BUILD NEXT@Stanford - Physical AI on Campus Hackathon. Friday Nov 6, 3:30-5:30 PM PT, Stanford University. Approval required.";

function buildNext(over: Partial<EventDraft> = {}): EventDraft {
  return {
    ...applyDraftPatch(emptyDraft(LA), {
      event_name: "BUILD NEXT@Stanford - Physical AI on Campus Hackathon",
      start: "2026-11-06T15:30",
      end: "2026-11-06T17:30",
      timezone: LA,
      location: "Stanford University, Stanford, CA",
      event_blurb: "Build a physical AI product in an afternoon.",
      hosts: "Plug and Play, VLight",
      require_participant_approval: true,
      slug: "build-next-stanford",
    }),
    ...over,
  };
}

/** The draft card the organiser sees (it is drawn once for phones and once for desktops). */
const card = () => screen.getAllByRole("region", { name: "Event draft" })[0];

function composer() {
  return screen.getByRole("textbox", { name: "Message" });
}

async function type(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(composer(), { key: "Enter" });
  });
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  params = new URLSearchParams();
  window.sessionStorage.clear();
  global.fetch = fetchMock;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe("EventCreationChat", () => {
  it("drafts from pasted text with Enter, then shows the draft and the next question", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ reply: "Drafted it.\n\nIs there a cap on how many people can join?", draft: buildNext() })
    );
    render(<EventCreationChat />);

    // Shift+Enter is a new line, not a send.
    fireEvent.change(composer(), { target: { value: "line one" } });
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    await type(BUILD_NEXT_TEXT);

    expect(fetchMock).toHaveBeenCalledWith("/api/events/chat-draft", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: "user", content: BUILD_NEXT_TEXT }]);
    expect(body.context).toBeNull();

    expect(await screen.findByText(/Is there a cap/)).toBeInTheDocument();
    const draft = within(card());
    expect(draft.getByText("BUILD NEXT@Stanford - Physical AI on Campus Hackathon")).toBeInTheDocument();
    expect(draft.getByText("build-next-stanford")).toBeInTheDocument();
    expect(draft.getByText("Fri, Nov 6, 3:30 PM")).toBeInTheDocument();
    expect(draft.getByText("Approval required")).toBeInTheDocument();
    expect(composer()).toHaveValue("");
  });

  it("sends follow-up edits with the current draft and history", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ reply: "Drafted it.", draft: buildNext() }))
      .mockResolvedValueOnce(
        json({ reply: "Moved it to 4 PM.", draft: buildNext({ start: "2026-11-06T16:00", end: "2026-11-06T18:00" }) })
      );
    render(<EventCreationChat />);
    await type(BUILD_NEXT_TEXT);
    await screen.findByText("Drafted it.");
    await type("make it 4pm");

    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(second.messages).toEqual([
      { role: "user", content: BUILD_NEXT_TEXT },
      { role: "assistant", content: "Drafted it." },
      { role: "user", content: "make it 4pm" },
    ]);
    expect(second.draft.start).toBe("2026-11-06T15:30");
    expect(await within(card()).findByText("Fri, Nov 6, 4:00 PM")).toBeInTheDocument();
  });

  it("creates the event through POST /api/events and lands on its dashboard", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ reply: "Ready.", draft: buildNext() }))
      .mockResolvedValueOnce(json({ event: { event_id: "e1", slug: "build-next-stanford" } }, 201));
    render(<EventCreationChat />);
    await type(BUILD_NEXT_TEXT);
    await screen.findByText("Ready.");
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull();

    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Create event" }));
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/events");
    const payload = JSON.parse(init.body);
    expect(payload.event).toMatchObject({
      event_name: "BUILD NEXT@Stanford - Physical AI on Campus Hackathon",
      event_date: "2026-11-06T23:30:00.000Z",
      slug: "build-next-stanford",
      require_participant_approval: true,
      organizer_affiliation: "Plug and Play, VLight",
      visibility: "draft",
    });
    expect(push).toHaveBeenCalledWith("/events/build-next-stanford/overview");
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("keeps Create off until the required fields are there", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ reply: "When is it?", draft: applyDraftPatch(emptyDraft(LA), { event_name: "Spring Hack" }) })
    );
    render(<EventCreationChat />);
    await type("Spring Hack");
    await screen.findByText("When is it?");
    expect(within(card()).getByRole("button", { name: "Create event" })).toBeDisabled();
    expect(within(card()).getByText("Needs date and time, location")).toBeInTheDocument();
  });

  it("edits the slug inline by clicking the URL", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ reply: "Ready.", draft: buildNext() }))
      .mockResolvedValueOnce(json({ event: { event_id: "e1", slug: "build-next" } }, 201));
    render(<EventCreationChat />);
    await type(BUILD_NEXT_TEXT);
    await screen.findByText("Ready.");

    fireEvent.click(within(card()).getByRole("button", { name: "Edit URL slug" }));
    const input = within(card()).getByRole("textbox", { name: "URL slug" });
    fireEvent.change(input, { target: { value: "Build Next" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(within(card()).getByText("build-next")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Create event" }));
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).event.slug).toBe("build-next");
  });

  it("says when the URL is taken", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ reply: "Ready.", draft: buildNext() }))
      .mockResolvedValueOnce(json({ error: "Event slug already exists. Please try a different slug." }, 400));
    render(<EventCreationChat />);
    await type(BUILD_NEXT_TEXT);
    await screen.findByText("Ready.");
    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Create event" }));
    });
    expect(within(card()).getByRole("alert")).toHaveTextContent("slug already exists");
    expect(screen.getByText(/That URL is taken/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("imports a non-Luma link through the existing scraper once, then drafts from it", async () => {
    let finish: ((r: Response) => void) | undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)))
      .mockResolvedValueOnce(json({ reply: "Imported.", draft: buildNext() }));
    render(<EventCreationChat />);

    fireEvent.change(composer(), { target: { value: "https://stormhacks.devpost.com" } });
    act(() => {
      fireEvent.keyDown(composer(), { key: "Enter" });
      fireEvent.keyDown(composer(), { key: "Enter" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/scrape");
    expect(await screen.findByText(/Reading that page/)).toBeInTheDocument();

    await act(async () => {
      finish!(json({ success: true, data: { event_name: "StormHacks" } }));
    });
    await screen.findByText("Imported.");
    const draftCall = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(draftCall.context).toBe(JSON.stringify({ event_name: "StormHacks" }));
  });

  it("sends a Luma link straight to the chat (the server reads Luma)", async () => {
    fetchMock.mockResolvedValueOnce(json({ reply: "Imported.", draft: buildNext() }));
    render(<EventCreationChat />);
    await type("https://luma.com/buildnext");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/events/chat-draft");
  });

  it("tells the organiser to paste text when an import fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false, error: "This event hostname is not enabled for import" }, 400));
    render(<EventCreationChat />);
    await type("https://example.com/my-hack");
    expect(
      await screen.findByText("This event hostname is not enabled for import. Paste the event text here and I'll draft it from that.")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prefills a shared ?url= without spending an import", () => {
    params = new URLSearchParams("url=https://event.devpost.com");
    render(<EventCreationChat />);
    expect(composer()).toHaveValue("https://event.devpost.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows server errors in the chat and keeps going", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "The assistant is not configured on this server." }, 503))
      .mockResolvedValueOnce(json({ reply: "Drafted it.", draft: buildNext() }));
    render(<EventCreationChat />);
    await type("hello");
    expect(await screen.findByText("The assistant is not configured on this server.")).toBeInTheDocument();
    await type("BUILD NEXT");
    // The error note is not sent back as conversation.
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toEqual([
      { role: "user", content: "hello" },
      { role: "user", content: "BUILD NEXT" },
    ]);
  });

  it("restores an unfinished chat after a reload and can start over", async () => {
    window.sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ lines: [{ id: "a", role: "assistant", content: "Earlier reply." }], draft: buildNext() })
    );
    render(<EventCreationChat />);
    expect(await screen.findByText("Earlier reply.")).toBeInTheDocument();
    expect(within(card()).getByText("build-next-stanford")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(screen.queryByText("Earlier reply.")).not.toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Event draft" })).not.toBeInTheDocument();
  });
});
