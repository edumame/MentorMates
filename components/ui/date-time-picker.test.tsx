process.env.TZ = "America/Los_Angeles";

import { fireEvent, render, screen } from "@testing-library/react";
import { DateTimePicker } from "./date-time-picker";

// ORG-015: the Edit Event picker shares the wizard's conversion rules.
describe("DateTimePicker DST handling", () => {
  function openPicker(onChange: jest.Mock) {
    render(
      <DateTimePicker value="2026-03-08T18:00:00.000Z" timezone="America/Los_Angeles" showTimezone={false} onChange={onChange} />
    );
    fireEvent.click(screen.getByPlaceholderText("Select date and time"));
    return document.querySelector('input[type="time"]') as HTMLInputElement;
  }

  it("rejects a time inside the spring-forward gap without emitting a value", () => {
    const onChange = jest.fn();
    const input = openPicker(onChange);
    fireEvent.change(input, { target: { value: "02:30" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/does not exist/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("emits the UTC instant for a valid local time", () => {
    const onChange = jest.fn();
    const input = openPicker(onChange);
    fireEvent.change(input, { target: { value: "09:15" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-03-08T16:15:00.000Z");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
