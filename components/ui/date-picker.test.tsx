import { render, screen } from "@testing-library/react";
import { DatePicker } from "./date-picker";

const shown = () =>
  (screen.getByPlaceholderText("mm/dd/yyyy") as HTMLInputElement).value;

describe("DatePicker", () => {
  // Run under a zone west of UTC too: `TZ=America/Los_Angeles npx jest date-picker`.
  it("shows a date-only value as that calendar day", () => {
    render(<DatePicker value="2026-06-15" />);
    expect(shown()).toBe("06/15/2026");
  });

  it("shows a date and time value as local time", () => {
    render(<DatePicker value="2026-06-15T23:30" />);
    expect(shown()).toBe("06/15/2026");
  });

  it("follows a value that changes after mount", () => {
    const { rerender } = render(<DatePicker value="2026-01-15" />);
    rerender(<DatePicker value="2026-06-15" />);
    expect(shown()).toBe("06/15/2026");
  });

  it("shows a date that arrives after an empty mount", () => {
    const { rerender } = render(<DatePicker value="" />);
    expect(shown()).toBe("");
    rerender(<DatePicker value="2026-06-15" />);
    expect(shown()).toBe("06/15/2026");
  });

  it("clears when the value is removed", () => {
    const { rerender } = render(<DatePicker value="2026-06-15" />);
    rerender(<DatePicker value="" />);
    expect(shown()).toBe("");
  });
});
