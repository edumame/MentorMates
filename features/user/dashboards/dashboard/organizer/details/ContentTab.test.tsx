import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContentTab } from "./ContentTab";
import type { EventDetails, Lesson } from "@/lib/types";

const mockToast = jest.fn();
const mockInsert = jest.fn();
const mockFetchLessons = jest.fn();
const mockDeleteLessons = jest.fn();

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/markdown/custom-components", () => ({
  customMarkdownComponents: {},
}));
jest.mock("@/components/markdown/plugins", () => ({
  markdownRehypePlugins: [],
  markdownRemarkPlugins: [],
}));
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      // Return only the selected columns, as the database would.
      select: (columns: string) => ({
        eq: async (...args: unknown[]) => {
          const { data, error } = await mockFetchLessons(...args);
          const pick = (row: Record<string, unknown>) =>
            Object.fromEntries(columns.split(",").map((c) => [c, row[c]]));
          return { data: data?.map(pick) ?? null, error };
        },
      }),
      delete: () => ({ eq: () => mockDeleteLessons() }),
      insert: (payload: unknown) => {
        mockInsert(payload);
        return { select: () => Promise.resolve({ error: null }) };
      },
    }),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const lesson = (title: string): Lesson => ({
  id: `id-${title}`,
  title,
  cover_image_url: "",
  url: "https://example.com/lesson",
  description: "Description",
  duration_minutes: 5,
});

const baseEvent = (lessons: Lesson[]) =>
  ({
    event_id: "event-1",
    event_name: "Original name",
    paywall_content: "",
    event_lessons: lessons,
  }) as unknown as EventDetails;

let latestEvent: EventDetails | null;
let replaceEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
let showTab: (show: boolean) => void;

function Harness({ initial }: { initial: EventDetails }) {
  const [event, setEvent] = useState<EventDetails | null>(initial);
  const [tabVisible, setTabVisible] = useState(true);
  latestEvent = event;
  replaceEvent = setEvent;
  showTab = setTabVisible;
  return tabVisible && event ? <ContentTab event={event} setEvent={setEvent} /> : null;
}

/** Each call to fetch stays pending until the test resolves it. */
function deferUploads() {
  const uploads: Array<(url: string) => Promise<void>> = [];
  global.fetch = jest.fn(() => {
    const { promise, resolve } = deferred<Response>();
    uploads.push(async (url) => {
      await act(async () => {
        resolve({ ok: true, json: async () => ({ url }) } as Response);
      });
    });
    return promise;
  }) as unknown as typeof fetch;
  return uploads;
}

async function renderLoaded(lessons: Lesson[]) {
  mockFetchLessons.mockResolvedValue({ data: lessons, error: null });
  const view = render(<Harness initial={baseEvent(lessons)} />);
  await waitFor(() =>
    expect(screen.queryByText("Loading lessons...")).not.toBeInTheDocument(),
  );
  return view;
}

function startUpload(container: HTMLElement, row: number) {
  const inputs = container.querySelectorAll('input[type="file"]');
  fireEvent.change(inputs[row], {
    target: { files: [new File(["x"], "cover.png", { type: "image/png" })] },
  });
}

const titles = () => (latestEvent?.event_lessons || []).map((l) => l.title);
const covers = () => (latestEvent?.event_lessons || []).map((l) => l.cover_image_url);
const toastTitles = () => mockToast.mock.calls.map(([arg]) => arg.title);

function addUnsavedLesson(title: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add Lesson" }));
  const titleInput = screen.getAllByText("Title").at(-1)?.parentElement?.querySelector("input");
  fireEvent.change(titleInput!, { target: { value: title } });
}

describe("ContentTab lesson image uploads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteLessons.mockResolvedValue({ error: null });
    latestEvent = null;
  });

  it("keeps an edit made to another lesson while an upload runs", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One"), lesson("Two")]);

    startUpload(container, 0);
    fireEvent.change(screen.getByDisplayValue("Two"), { target: { value: "Edited" } });
    await uploads[0]("https://cdn/one.png");

    expect(titles()).toEqual(["One", "Edited"]);
    expect(covers()).toEqual(["https://cdn/one.png", ""]);
  });

  it("keeps exclusive content typed while an upload runs", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One")]);

    startUpload(container, 0);
    fireEvent.change(screen.getByPlaceholderText("Add content (markdown supported)"), {
      target: { value: "Members only" },
    });
    await uploads[0]("https://cdn/one.png");

    expect(latestEvent?.paywall_content).toBe("Members only");
    expect(covers()).toEqual(["https://cdn/one.png"]);
  });

  it("keeps both URLs when two uploads overlap, in either finish order", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One"), lesson("Two")]);

    startUpload(container, 0);
    startUpload(container, 1);
    await uploads[1]("https://cdn/two.png");
    await uploads[0]("https://cdn/one.png");

    expect(covers()).toEqual(["https://cdn/one.png", "https://cdn/two.png"]);
  });

  it("does not resurrect a removed lesson or give its image to the next one", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One"), lesson("Two")]);

    startUpload(container, 0);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await uploads[0]("https://cdn/one.png");

    expect(titles()).toEqual(["Two"]);
    expect(covers()).toEqual([""]);
    expect(toastTitles()).toEqual(["Image not added"]);
  });

  it("follows the lesson when an earlier lesson is removed mid-upload", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One"), lesson("Two")]);

    startUpload(container, 1);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    // The busy state moves with the lesson rather than staying on its old row.
    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled();
    await uploads[0]("https://cdn/two.png");

    expect(titles()).toEqual(["Two"]);
    expect(covers()).toEqual(["https://cdn/two.png"]);
    expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
  });

  it("tracks unsaved lessons, which have no database id, by their client id", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("Saved")]);
    addUnsavedLesson("New A");
    addUnsavedLesson("New B");

    startUpload(container, 1);
    startUpload(container, 2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await uploads[1]("https://cdn/b.png");
    await uploads[0]("https://cdn/a.png");

    expect(titles()).toEqual(["New A", "New B"]);
    expect(covers()).toEqual(["https://cdn/a.png", "https://cdn/b.png"]);
    expect(toastTitles()).toEqual(["Success", "Success"]);
  });

  it("lands on a saved lesson when ContentTab remounts and reloads mid-upload", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One"), lesson("Two")]);

    startUpload(container, 1);
    act(() => showTab(false));
    act(() => showTab(true));
    await waitFor(() =>
      expect(screen.queryByText("Loading lessons...")).not.toBeInTheDocument(),
    );
    expect(mockFetchLessons).toHaveBeenCalledTimes(2);
    await uploads[0]("https://cdn/two.png");

    expect(covers()).toEqual(["", "https://cdn/two.png"]);
    expect(toastTitles()).toEqual(["Success"]);
  });

  it("does not report success when a reload dropped the unsaved lesson", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("Saved")]);
    addUnsavedLesson("New");

    startUpload(container, 1);
    act(() => showTab(false));
    act(() => showTab(true));
    await waitFor(() => expect(titles()).toEqual(["Saved"]));
    await uploads[0]("https://cdn/new.png");

    expect(covers()).toEqual([""]);
    expect(toastTitles()).toEqual(["Image not added"]);
  });

  it("does not report success when a save's refetch replaced the lesson's id", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One")]);

    startUpload(container, 0);
    act(() =>
      replaceEvent(
        (prev) =>
          prev && { ...prev, event_lessons: [{ ...lesson("One"), id: "reinserted" }] },
      ),
    );
    await uploads[0]("https://cdn/one.png");

    expect(covers()).toEqual([""]);
    expect(toastTitles()).toEqual(["Image not added"]);
  });

  it("blocks uploads while lessons save, because saving replaces their ids", async () => {
    await renderLoaded([lesson("One")]);
    const finishDelete = deferred<{ error: null }>();
    mockDeleteLessons.mockReturnValueOnce(finishDelete.promise);
    const upload = screen.getByRole("button", { name: "Upload" });

    act(() =>
      replaceEvent(
        (prev) =>
          prev && {
            ...prev,
            event_lessons: [{ ...lesson("One"), cover_image_url: "https://cdn/x.png" }],
          },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Lessons" }));
    expect(upload).toBeDisabled();

    await act(async () => {
      finishDelete.resolve({ error: null });
    });
    await waitFor(() => expect(upload).toBeEnabled());
  });

  it("keeps other tabs' edits when the upload finishes after ContentTab unmounts", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One")]);

    startUpload(container, 0);
    act(() => showTab(false));
    act(() =>
      replaceEvent((prev) => prev && { ...prev, event_name: "Renamed in Basics" }),
    );
    await uploads[0]("https://cdn/one.png");

    expect(latestEvent?.event_name).toBe("Renamed in Basics");
    expect(covers()).toEqual(["https://cdn/one.png"]);
  });

  it("clears the busy state and leaves the lesson alone when an upload fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { container } = await renderLoaded([lesson("One")]);

    startUpload(container, 0);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled(),
    );
    expect(covers()).toEqual([""]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("blocks Save Lessons until the upload lands, and never persists either lesson id", async () => {
    const uploads = deferUploads();
    const { container } = await renderLoaded([lesson("One")]);
    const save = screen.getByRole("button", { name: "Save Lessons" });

    startUpload(container, 0);
    expect(save).toBeDisabled();

    await uploads[0]("https://cdn/one.png");
    expect(save).toBeEnabled();

    fireEvent.click(save);
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert.mock.calls[0][0]).toEqual([
      {
        event_id: "event-1",
        title: "One",
        cover_image_url: "https://cdn/one.png",
        url: "https://example.com/lesson",
        description: "Description",
        duration_minutes: 5,
      },
    ]);
  });
});

describe("ContentTab lesson fetch on mount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteLessons.mockResolvedValue({ error: null });
    latestEvent = null;
  });

  it("keeps exclusive content typed before the fetch resolves", async () => {
    const pending = deferred<{ data: Lesson[]; error: null }>();
    mockFetchLessons.mockReturnValue(pending.promise);
    render(<Harness initial={baseEvent([])} />);

    fireEvent.change(screen.getByPlaceholderText("Add content (markdown supported)"), {
      target: { value: "Typed early" },
    });
    await act(async () => {
      pending.resolve({ data: [lesson("Fetched")], error: null });
    });

    expect(latestEvent?.paywall_content).toBe("Typed early");
    expect(titles()).toEqual(["Fetched"]);
  });

  it("does not start an upload the pending fetch would discard", async () => {
    const pending = deferred<{ data: Lesson[]; error: null }>();
    mockFetchLessons.mockReturnValue(pending.promise);
    render(<Harness initial={baseEvent([lesson("One")])} />);

    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();

    await act(async () => {
      pending.resolve({ data: [lesson("One")], error: null });
    });
    expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
  });

  it("ignores a fetch that resolves after the event changed", async () => {
    const pending = deferred<{ data: Lesson[]; error: null }>();
    mockFetchLessons.mockReturnValueOnce(pending.promise);
    mockFetchLessons.mockResolvedValue({ data: [lesson("Second event")], error: null });
    render(<Harness initial={baseEvent([])} />);

    await act(async () => {
      replaceEvent((prev) => prev && { ...prev, event_id: "event-2" });
    });
    await act(async () => {
      pending.resolve({ data: [lesson("First event")], error: null });
    });

    expect(latestEvent?.event_id).toBe("event-2");
    expect(titles()).toEqual(["Second event"]);
  });
});
