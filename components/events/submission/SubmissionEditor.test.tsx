import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SubmissionEditor } from "./SubmissionEditor";
import {
  createLockedStarterSubmissionFields,
  createMLHSubmissionTemplateFields,
  createSubmissionTemplateFields,
  type SubmissionField,
} from "./types";

const techStack: SubmissionField = {
  id: "tech_stack",
  label: "Tech stack",
  type: "text",
  required: false,
  placeholder: "",
};

const oldFetch = global.fetch;
const fetchMock = jest.fn();

beforeAll(() => {
  HTMLElement.prototype.scrollTo = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  global.fetch = fetchMock;
});

afterAll(() => {
  global.fetch = oldFetch;
});

async function chat(fields: SubmissionField[], patchFields: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      reply: "Done",
      patch: { submission_fields: patchFields },
    }),
  });
  const onChange = jest.fn();
  render(<SubmissionEditor fields={fields} onChange={onChange} />);
  fireEvent.change(screen.getByPlaceholderText("Ask me to modify the form..."), {
    target: { value: "Add a question about tech stack" },
  });
  fireEvent.submit(
    screen.getByPlaceholderText("Ask me to modify the form...").closest("form")!,
  );
  await screen.findByText("Done");
  return onChange;
}

describe("SubmissionEditor AI chat patches", () => {
  it("restores the locked fields when the list was empty", async () => {
    const onChange = await chat([], [techStack]);

    expect(onChange).toHaveBeenCalledWith([
      ...createLockedStarterSubmissionFields(),
      techStack,
    ]);
  });

  it("sends the locked definitions to the model when the list is empty", async () => {
    await chat([], [techStack]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event.submission_fields).toEqual(
      createLockedStarterSubmissionFields(),
    );
  });

  it("restores a locked field the patch omitted", async () => {
    const fields = createSubmissionTemplateFields();
    const onChange = await chat(
      fields,
      fields.filter((field) => field.id !== "project_description"),
    );

    expect(onChange).toHaveBeenCalledWith(fields);
  });

  it("reverts changes the patch made to a locked field", async () => {
    const fields = createSubmissionTemplateFields();
    const onChange = await chat(
      fields,
      fields.map((field) =>
        field.id === "project_name"
          ? { ...field, label: "Team name", required: false }
          : field,
      ),
    );

    expect(onChange).toHaveBeenCalledWith(fields);
  });

  it("keeps the MLH locked labels and order", async () => {
    const fields = createMLHSubmissionTemplateFields();
    const onChange = await chat(
      fields,
      fields.filter((field) => field.id !== "project_description"),
    );

    expect(onChange).toHaveBeenCalledWith(fields);
  });

  it("keeps the MLH order when the patch removes a field ahead of a locked one", async () => {
    const fields = createMLHSubmissionTemplateFields();
    const remaining = fields.filter((field) => field.id !== "project_url");
    const onChange = await chat(fields, remaining);

    expect(onChange).toHaveBeenCalledWith(remaining);
  });

  it("leaves the form alone and says so when the patch has an invalid field", async () => {
    const fields = createSubmissionTemplateFields();
    const onChange = await chat(fields, [
      ...fields,
      { id: "budget", label: "Budget", type: "number" },
    ]);

    await waitFor(() =>
      expect(screen.getByText(/your form was not changed/i)).toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
