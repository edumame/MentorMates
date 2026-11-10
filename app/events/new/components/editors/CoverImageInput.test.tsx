import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CoverImageInput } from "./CoverImageInput";
import {
  INITIAL_WIZARD_EVENT,
  type WizardEventData,
} from "@/lib/types/wizard";

const createObjectURL = jest.fn(() => "blob:cover-preview");
const revokeObjectURL = jest.fn();

beforeAll(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});
beforeEach(() => jest.clearAllMocks());

let latest: WizardEventData;
function Harness({ initial }: { initial?: Partial<WizardEventData> }) {
  const [event, setEvent] = useState<WizardEventData>({
    ...INITIAL_WIZARD_EVENT,
    ...initial,
  });
  latest = event;
  return (
    <CoverImageInput
      event={event}
      update={(fields) => setEvent((prev) => ({ ...prev, ...fields }))}
    />
  );
}

const pick = (file: File) =>
  fireEvent.change(screen.getByTestId("cover-image-file-input"), {
    target: { files: [file] },
  });
const image = (name = "cover.png", size = 1024, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });

it("stores a picked image and shows a local preview", () => {
  render(<Harness />);
  expect(screen.queryByAltText("Cover image preview")).not.toBeInTheDocument();

  const file = image();
  pick(file);

  expect(latest.cover_image_file).toBe(file);
  expect(latest.cover_image_url).toBe("");
  expect(screen.getByAltText("Cover image preview")).toHaveAttribute(
    "src",
    "blob:cover-preview"
  );
  expect(screen.getByRole("button", { name: /replace image/i })).toBeInTheDocument();
});

it("picking a file clears a previously typed URL", () => {
  render(<Harness initial={{ cover_image_url: "https://x.test/a.png" }} />);
  pick(image());
  expect(latest.cover_image_url).toBe("");
  expect(screen.getByLabelText("Cover image URL")).toHaveValue("");
});

it("typing a URL clears a picked file and previews the URL", () => {
  render(<Harness />);
  pick(image());
  fireEvent.change(screen.getByLabelText("Cover image URL"), {
    target: { value: "https://x.test/b.png" },
  });
  expect(latest.cover_image_file).toBeUndefined();
  expect(screen.getByAltText("Cover image preview")).toHaveAttribute(
    "src",
    "https://x.test/b.png"
  );
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:cover-preview");
});

it.each([
  ["a non-image file", image("doc.pdf", 10, "application/pdf"), "Please upload an image file."],
  ["an image over 5MB", image("big.png", 5 * 1024 * 1024 + 1), "Image must be under 5MB."],
])("rejects %s with an inline error and keeps state unchanged", (_, file, message) => {
  render(<Harness initial={{ cover_image_url: "https://x.test/keep.png" }} />);
  pick(file);
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(latest.cover_image_file).toBeUndefined();
  expect(latest.cover_image_url).toBe("https://x.test/keep.png");
});

it("clears the error after a valid pick", () => {
  render(<Harness />);
  pick(image("doc.txt", 10, "text/plain"));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  pick(image());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("remove clears both the file and the URL", () => {
  render(<Harness />);
  pick(image());
  fireEvent.click(screen.getByRole("button", { name: "Remove cover image" }));
  expect(latest.cover_image_file).toBeUndefined();
  expect(latest.cover_image_url).toBe("");
  expect(screen.queryByAltText("Cover image preview")).not.toBeInTheDocument();
});
