import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePendingAvatar } from "./use-pending-avatar";

/** Two file inputs, like the profile page (header camera + modal). */
function Harness({ validate, onSave }: { validate: (f: File) => string | null; onSave: (f: File) => void }) {
  const { file, preview, select, clear } = usePendingAvatar(validate);
  return (
    <div>
      <input data-testid="header" type="file" onChange={select} />
      <input data-testid="modal" type="file" onChange={select} />
      <span data-testid="preview">{preview ?? "none"}</span>
      <button onClick={() => file && onSave(file)}>Save image</button>
      <button onClick={clear}>Cancel</button>
    </div>
  );
}

const png = () => new File(["x"], "a.png", { type: "image/png" });

function pick(testId: string, file: File) {
  const input = screen.getByTestId(testId) as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("usePendingAvatar (NEW-002)", () => {
  it("saves the file picked in the modal input, not the first input on the page", async () => {
    const onSave = jest.fn();
    render(<Harness validate={() => null} onSave={onSave} />);
    const file = png();
    pick("modal", file);
    await waitFor(() => expect(screen.getByTestId("preview")).not.toHaveTextContent("none"));
    fireEvent.click(screen.getByText("Save image"));
    expect(onSave).toHaveBeenCalledWith(file);
  });

  it("keeps the most recent pick when both inputs are used", async () => {
    const onSave = jest.fn();
    render(<Harness validate={() => null} onSave={onSave} />);
    const first = png();
    const second = new File(["y"], "b.webp", { type: "image/webp" });
    pick("header", first);
    pick("modal", second);
    await waitFor(() => expect(screen.getByTestId("preview")).not.toHaveTextContent("none"));
    fireEvent.click(screen.getByText("Save image"));
    expect(onSave).toHaveBeenCalledWith(second);
  });

  it("ignores files that fail validation", async () => {
    const onSave = jest.fn();
    const validate = jest.fn(() => "Unsupported");
    render(<Harness validate={validate} onSave={onSave} />);
    pick("modal", new File(["x"], "a.svg", { type: "image/svg+xml" }));
    expect(validate).toHaveBeenCalled();
    await act(async () => {});
    expect(screen.getByTestId("preview")).toHaveTextContent("none");
    fireEvent.click(screen.getByText("Save image"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("clears the pending file on cancel", async () => {
    const onSave = jest.fn();
    render(<Harness validate={() => null} onSave={onSave} />);
    pick("modal", png());
    await waitFor(() => expect(screen.getByTestId("preview")).not.toHaveTextContent("none"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByTestId("preview")).toHaveTextContent("none");
    fireEvent.click(screen.getByText("Save image"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is dismissed without a file", () => {
    const onSave = jest.fn();
    render(<Harness validate={() => null} onSave={onSave} />);
    const input = screen.getByTestId("modal") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [], configurable: true });
    fireEvent.change(input);
    fireEvent.click(screen.getByText("Save image"));
    expect(onSave).not.toHaveBeenCalled();
  });
});
