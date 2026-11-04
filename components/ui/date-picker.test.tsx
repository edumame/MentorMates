/** @jest-environment ./jest.pacific-time-environment.cjs */
import { fireEvent, render, screen } from "@testing-library/react";
import { DatePicker } from "./date-picker";

function field() {
  return screen.getByPlaceholderText("mm/dd/yyyy") as HTMLInputElement;
}

describe("DatePicker west of UTC", () => {
  it("runs in a negative UTC offset", () => {
    expect(new Date(2026, 10, 4).getTimezoneOffset()).toBeGreaterThan(0);
  });

  it("shows the stored calendar day for a date-only value", () => {
    render(<DatePicker value="2026-11-04" />);

    expect(field().value).toBe("11/04/2026");
  });

  it("keeps the first of a month and of a year on the stored day", () => {
    const { rerender } = render(<DatePicker value="2026-11-01" />);
    expect(field().value).toBe("11/01/2026");

    rerender(<DatePicker value="2027-01-01" />);
    expect(field().value).toBe("01/01/2027");
  });

  it("shows the stored day for a value the picker itself wrote", () => {
    render(<DatePicker value="2026-11-04T00:00" />);

    expect(field().value).toBe("11/04/2026");
  });

  it("follows value changes while mounted", () => {
    const { rerender } = render(<DatePicker value="2026-11-04" />);

    rerender(<DatePicker value="2026-12-25" />);
    expect(field().value).toBe("12/25/2026");

    rerender(<DatePicker value="" />);
    expect(field().value).toBe("");
  });

  it("leaves the field empty for an unparseable value", () => {
    render(<DatePicker value="not a date" />);

    expect(field().value).toBe("");
  });

  it("opens the calendar on the stored month with the stored day selected", () => {
    render(<DatePicker value="2026-11-01" />);

    fireEvent.click(field());

    expect(screen.getByText("November 2026")).toBeInTheDocument();
    expect(screen.queryByText("October 2026")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "1" })[0]).toHaveClass(
      "bg-blue-500"
    );
  });

  it("reports the clicked day and shows it once the parent updates value", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DatePicker value="2026-11-04" onChange={onChange} />
    );

    fireEvent.click(field());
    // Index 0 is the first of the two months shown side by side.
    fireEvent.click(screen.getAllByRole("button", { name: "15" })[0]);

    expect(onChange).toHaveBeenCalledWith("2026-11-15T00:00");

    rerender(
      <DatePicker value={onChange.mock.calls[0][0]} onChange={onChange} />
    );
    expect(field().value).toBe("11/15/2026");
  });
});
