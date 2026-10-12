import { createRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ProjectFieldEntriesSection,
  type ProjectFieldEntriesSectionHandle,
} from "./ProjectFieldEntriesSection";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: "" } })),
      })),
    },
  },
}));

const FIELD = {
  id: "11111111-1111-1111-1111-111111111111",
  event_id: "22222222-2222-2222-2222-222222222222",
  key: "submission_log",
  label: "Submission Log",
  description: null,
  placeholder: "What did you contribute?",
  field_type: "long_text",
  required: false,
  is_active: true,
  sort_order: 0,
  options: [],
  allows_multiple_entries: true,
};

function mockFetchSequence() {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (!init || init.method === undefined || init.method === "GET") {
      return {
        ok: true,
        json: async () => ({
          fields: [FIELD],
          entries: [],
          viewerUserId: "user-1",
        }),
      } as Response;
    }
    const body = JSON.parse(String(init.body));
    return {
      ok: true,
      status: 201,
      json: async () => ({
        entry: {
          id: "entry-1",
          project_id: "project-1",
          event_submission_field_id: body.fieldId,
          submitter_user_id: "user-1",
          content: body.content ?? "",
          attachments: body.attachments ?? [],
          submitter_display_name: "Alex",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      }),
    } as unknown as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("ProjectFieldEntriesSection flushPendingEntries", () => {
  it("submits a typed-but-not-added draft when flushed", async () => {
    const fetchMock = mockFetchSequence();
    const ref = createRef<ProjectFieldEntriesSectionHandle>();

    render(
      <ProjectFieldEntriesSection
        ref={ref}
        projectId="project-1"
        canContribute
      />,
    );

    const textarea = await screen.findByPlaceholderText(
      "What did you contribute?",
    );
    await userEvent.type(textarea, "I built the API");

    let flushed = false;
    await act(async () => {
      flushed = await ref.current!.flushPendingEntries();
    });

    expect(flushed).toBe(true);
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String((postCall![1] as RequestInit).body))).toEqual({
      fieldId: FIELD.id,
      content: "I built the API",
    });

    await waitFor(() => {
      expect(screen.getByText("I built the API")).toBeInTheDocument();
    });
  });

  it("resolves true with no POST when there is nothing pending", async () => {
    const fetchMock = mockFetchSequence();
    const ref = createRef<ProjectFieldEntriesSectionHandle>();

    render(
      <ProjectFieldEntriesSection
        ref={ref}
        projectId="project-1"
        canContribute
      />,
    );

    await screen.findByPlaceholderText("What did you contribute?");

    let flushed = false;
    await act(async () => {
      flushed = await ref.current!.flushPendingEntries();
    });
    expect(flushed).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("returns false when saving a pending draft fails", async () => {
    const fetchMock = mockFetchSequence();
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        fields: [FIELD],
        entries: [],
        viewerUserId: "user-1",
      }),
    }) as Response);

    const ref = createRef<ProjectFieldEntriesSectionHandle>();
    render(
      <ProjectFieldEntriesSection
        ref={ref}
        projectId="project-1"
        canContribute
      />,
    );

    const textarea = await screen.findByPlaceholderText(
      "What did you contribute?",
    );
    await userEvent.type(textarea, "This will fail");

    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Nope" }),
    }) as unknown as Response);

    let flushed = true;
    await act(async () => {
      flushed = await ref.current!.flushPendingEntries();
    });
    expect(flushed).toBe(false);
  });
});
