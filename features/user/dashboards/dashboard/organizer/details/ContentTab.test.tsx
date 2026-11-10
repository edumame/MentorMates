import React, { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EventDetails, Lesson } from "@/lib/types";
import { ContentTab } from "./ContentTab";

const toast = jest.fn();
const lessonsEq = jest.fn();
const deleteEq = jest.fn();
const insert = jest.fn();
const rpc = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

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

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      select: () => ({ eq: (...args: unknown[]) => lessonsEq(...args) }),
      delete: () => ({ eq: (...args: unknown[]) => deleteEq(...args) }),
      insert: (...args: unknown[]) => insert(...args),
    }),
  },
}));

const savedLesson: Lesson = {
  title: "Saved lesson",
  cover_image_url: "https://example.com/cover.png",
  url: "https://example.com/lesson",
  description: "Saved description",
  duration_minutes: 10,
};

const baseEvent = {
  event_id: "event-1",
  paywall_content: "",
} as EventDetails;

// Mirrors the organizer dashboard: the parent owns the event and Radix unmounts
// ContentTab whenever another sub-tab is selected.
function Harness({ initialEvent }: { initialEvent: EventDetails }) {
  const [event, setEvent] = useState<EventDetails | null>(initialEvent);

  return (
    <Tabs defaultValue="content">
      <TabsList>
        <TabsTrigger value="content">Content tab</TabsTrigger>
        <TabsTrigger value="schedule">Schedule tab</TabsTrigger>
      </TabsList>
      <TabsContent value="content">
        <ContentTab event={event as EventDetails} setEvent={setEvent} />
      </TabsContent>
      <TabsContent value="schedule">
        <p>Schedule panel</p>
        <p data-testid="parent-lesson-count">
          {event?.event_lessons === undefined
            ? "not loaded"
            : event.event_lessons.length}
        </p>
      </TabsContent>
    </Tabs>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("ContentTab lessons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    lessonsEq.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: "Saved paywall", error: null });
    deleteEq.mockResolvedValue({ error: null });
    insert.mockReturnValue({
      select: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps unsaved lessons when switching sub-tabs and back", async () => {
    const user = userEvent.setup();
    render(
      <Harness initialEvent={{ ...baseEvent, event_lessons: [savedLesson] }} />
    );

    await user.click(await screen.findByRole("button", { name: "Add Lesson" }));
    const titleInputs = screen.getAllByRole("textbox").filter(
      (el) => (el as HTMLInputElement).value === ""
    );
    await user.type(titleInputs[1], "Unsaved draft");

    await user.click(screen.getByRole("tab", { name: "Schedule tab" }));
    expect(await screen.findByText("Schedule panel")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Content tab" }));

    expect(await screen.findByDisplayValue("Unsaved draft")).toBeInTheDocument();
    // Let any remount fetch settle: the draft must still be there afterwards.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByDisplayValue("Unsaved draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Saved lesson")).toBeInTheDocument();
  });

  it("does not refetch lessons the parent already loaded", async () => {
    render(
      <Harness initialEvent={{ ...baseEvent, event_lessons: [savedLesson] }} />
    );

    await screen.findByDisplayValue("Saved lesson");
    expect(lessonsEq).not.toHaveBeenCalled();
  });

  it("loads lessons when the parent has none and keeps edits made during the fetch", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ data: Lesson[]; error: null }>();
    lessonsEq.mockReturnValue(pending.promise);

    render(<Harness initialEvent={baseEvent} />);

    await user.type(
      screen.getByPlaceholderText("Add content (markdown supported)"),
      "Typed while loading"
    );

    await act(async () => {
      pending.resolve({ data: [savedLesson], error: null });
    });

    expect(await screen.findByDisplayValue("Saved lesson")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add content (markdown supported)")
    ).toHaveValue("Typed while loading");
  });

  it("does not let a late fetch overwrite lessons edited in the meantime", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ data: Lesson[]; error: null }>();
    lessonsEq.mockReturnValue(pending.promise);

    function RacingHarness() {
      const [event, setEvent] = useState<EventDetails | null>(baseEvent);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              setEvent((prev) =>
                prev ? { ...prev, event_lessons: [savedLesson] } : prev
              )
            }
          >
            Parent reload
          </button>
          <ContentTab event={event as EventDetails} setEvent={setEvent} />
        </>
      );
    }

    render(<RacingHarness />);
    await user.click(screen.getByRole("button", { name: "Parent reload" }));

    await act(async () => {
      pending.resolve({ data: [], error: null });
    });

    expect(screen.getByDisplayValue("Saved lesson")).toBeInTheDocument();
  });

  it("blocks saving and adding when lessons could not be loaded", async () => {
    const user = userEvent.setup();
    lessonsEq.mockResolvedValue({ data: null, error: { message: "boom" } });

    render(<Harness initialEvent={baseEvent} />);

    expect(
      await screen.findByText(/lessons could not be loaded/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/No lessons yet/)).not.toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save Lessons" });
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Lesson" })).toBeDisabled();

    await user.click(save);
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("retries a failed load on remount and re-enables saving", async () => {
    const user = userEvent.setup();
    lessonsEq.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    lessonsEq.mockResolvedValueOnce({ data: [savedLesson], error: null });

    render(<Harness initialEvent={baseEvent} />);
    await screen.findByText(/lessons could not be loaded/i);

    await user.click(screen.getByRole("tab", { name: "Schedule tab" }));
    await screen.findByText("Schedule panel");
    await user.click(screen.getByRole("tab", { name: "Content tab" }));

    expect(await screen.findByDisplayValue("Saved lesson")).toBeInTheDocument();
    expect(
      screen.queryByText(/lessons could not be loaded/i)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Lessons" })).toBeEnabled();
  });

  it("still allows deleting every lesson when the list loaded successfully", async () => {
    const user = userEvent.setup();
    render(
      <Harness initialEvent={{ ...baseEvent, event_lessons: [savedLesson] }} />
    );

    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Save Lessons" }));

    await waitFor(() => {
      expect(deleteEq).toHaveBeenCalledWith("event_id", "event-1");
    });
    expect(insert).not.toHaveBeenCalled();
  });

  describe("paywall content", () => {
    const paywallBox = () =>
      screen.getByPlaceholderText("Add content (markdown supported)");

    it("loads paywall content once when the parent has none", async () => {
      render(
        <Harness
          initialEvent={{ ...baseEvent, paywall_content: undefined, event_lessons: [] }}
        />
      );

      await waitFor(() => expect(paywallBox()).toHaveValue("Saved paywall"));
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("get_event_paywall_content", {
        p_event_id: "event-1",
      });
    });

    it("keeps unsaved paywall edits when switching sub-tabs and back", async () => {
      const user = userEvent.setup();
      render(
        <Harness
          initialEvent={{ ...baseEvent, paywall_content: undefined, event_lessons: [] }}
        />
      );
      await waitFor(() => expect(paywallBox()).toHaveValue("Saved paywall"));

      await user.clear(paywallBox());
      await user.type(paywallBox(), "Unsaved paywall");
      await user.click(screen.getByRole("tab", { name: "Schedule tab" }));
      await user.click(screen.getByRole("tab", { name: "Content tab" }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(paywallBox()).toHaveValue("Unsaved paywall");
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it("does not let a late paywall load overwrite text typed meanwhile", async () => {
      const user = userEvent.setup();
      const pending = deferred<{ data: string; error: null }>();
      rpc.mockReturnValue(pending.promise);
      render(
        <Harness
          initialEvent={{ ...baseEvent, paywall_content: undefined, event_lessons: [] }}
        />
      );

      await user.type(paywallBox(), "Typed first");
      await act(async () => {
        pending.resolve({ data: "Saved paywall", error: null });
      });

      expect(paywallBox()).toHaveValue("Typed first");
    });
  });
});
