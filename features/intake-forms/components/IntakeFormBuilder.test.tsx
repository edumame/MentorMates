import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { IntakeFormBuilder } from "@/features/intake-forms/components/IntakeFormBuilder";
import type { IntakeFormSchema } from "@/features/intake-forms/types";

jest.mock("@/lib/hooks/use-toast", () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});

jest.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@dnd-kit/react/sortable", () => ({
  isSortable: () => false,
  useSortable: () => ({
    ref: jest.fn(),
    handleRef: jest.fn(),
    isDragSource: false,
    isDropTarget: false,
  }),
}));

const SOURCE_KEY = "attending_abc123";

function buildSchema(dependentFieldKey = SOURCE_KEY): IntakeFormSchema {
  return {
    title: "Form",
    fields: [
      {
        id: "abc123-source",
        key: SOURCE_KEY,
        type: "short_text",
        label: "Attending",
        required: false,
        showIf: null,
      },
      {
        id: "def456-dependent",
        key: "dietary_def456",
        type: "short_text",
        label: "Dietary needs",
        required: true,
        showIf: { fieldKey: dependentFieldKey, equals: "Yes" },
      },
    ],
  };
}

function mockFetch(schema: IntakeFormSchema) {
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => (init?.method === "PUT" ? {} : { schema }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function renderBuilder(schema: IntakeFormSchema) {
  const fetchMock = mockFetch(schema);
  render(<IntakeFormBuilder eventId="event-1" />);
  await screen.findByDisplayValue("Attending");
  return fetchMock;
}

async function saveDraftAndGetSchema(fetchMock: ReturnType<typeof mockFetch>) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  });

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")
    ).toBe(true);
  });

  const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
  return JSON.parse(String(putCall?.[1]?.body)).schema as IntakeFormSchema;
}

describe("IntakeFormBuilder show-if references", () => {
  it("keeps a question's key and its dependants when the label is edited", async () => {
    const fetchMock = await renderBuilder(buildSchema());

    fireEvent.change(screen.getByDisplayValue("Attending"), {
      target: { value: "Attending in person" },
    });

    const saved = await saveDraftAndGetSchema(fetchMock);

    expect(saved.fields[0].label).toBe("Attending in person");
    expect(saved.fields[0].key).toBe(SOURCE_KEY);
    expect(saved.fields[1].showIf).toEqual({
      fieldKey: SOURCE_KEY,
      equals: "Yes",
    });
  });

  it("clears show-if rules that reference a deleted question", async () => {
    const fetchMock = await renderBuilder(buildSchema());

    const sourceCard = screen
      .getByDisplayValue("Attending")
      .closest(".rounded-xl") as HTMLElement;
    const deleteButton = sourceCard
      .querySelector(".lucide-trash-2")
      ?.closest("button") as HTMLButtonElement;
    fireEvent.click(deleteButton);

    const saved = await saveDraftAndGetSchema(fetchMock);

    expect(saved.fields.map((field) => field.key)).toEqual(["dietary_def456"]);
    expect(saved.fields[0].showIf).toBeNull();
  });

  it("leaves unrelated show-if rules alone when a question is deleted", async () => {
    const schema = buildSchema();
    schema.fields.push({
      id: "ghi789-unrelated",
      key: "unrelated_ghi789",
      type: "short_text",
      label: "Unrelated",
      required: false,
      showIf: null,
    });
    const fetchMock = await renderBuilder(schema);

    const unrelatedCard = screen
      .getByDisplayValue("Unrelated")
      .closest(".rounded-xl") as HTMLElement;
    fireEvent.click(
      unrelatedCard
        .querySelector(".lucide-trash-2")
        ?.closest("button") as HTMLButtonElement
    );

    const saved = await saveDraftAndGetSchema(fetchMock);

    expect(saved.fields[1].showIf).toEqual({
      fieldKey: SOURCE_KEY,
      equals: "Yes",
    });
  });

  it("does not offer a value input for a rule whose source no longer exists", async () => {
    await renderBuilder(buildSchema("old_label_abc123"));

    fireEvent.click(screen.getByDisplayValue("Dietary needs"));

    expect(await screen.findByText("Show this question only if")).toBeInTheDocument();
    expect(screen.queryByText("Value equals")).not.toBeInTheDocument();
  });
});
