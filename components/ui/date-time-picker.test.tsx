import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { DateTimePicker } from "./date-time-picker";

// Radix positioning is irrelevant here; render the popover body inline.
jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const INSTANT = "2026-11-05T05:00:00.000Z";

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const browserDay = (instant: string) => {
  const date = new Date(instant);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const zoneDay = (instant: string, zone: string) =>
  formatInTimeZone(new Date(instant), zone, "yyyy-MM-dd");

// Jest cannot change the process timezone from inside a test, so pick the
// display zone from the process zone. These two zones are 25 hours apart and
// are never on the same date, so at least one disagrees with the browser.
const disagreeingZone = (instant: string) => {
  const zone = ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find(
    (candidate) => zoneDay(instant, candidate) !== browserDay(instant)
  );
  if (!zone) throw new Error("expected a zone on a different date");
  return zone;
};

function ControlledPicker({
  initialValue,
  timezone,
  onChange,
}: {
  initialValue: string;
  timezone: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  return (
    <DateTimePicker
      value={value}
      timezone={timezone}
      showTimezone={false}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const renderPicker = (timezone: string, initialValue = INSTANT) => {
  const onChange = jest.fn();
  const { container } = render(
    <ControlledPicker initialValue={initialValue} timezone={timezone} onChange={onChange} />
  );
  return {
    onChange,
    summary: () => container.querySelector<HTMLInputElement>('input[type="text"]')?.value,
    highlightedDays: () =>
      Array.from(container.querySelectorAll("button.bg-blue-500")).map((button) => button.textContent),
  };
};

const changeTime = (time: string) =>
  fireEvent.change(screen.getByLabelText("Time"), { target: { value: time } });

const clickDay = (day: number) => {
  const [button] = screen
    .getAllByRole("button", { name: String(day) })
    .filter((candidate) => !(candidate as HTMLButtonElement).disabled);
  fireEvent.click(button);
};

describe("DateTimePicker", () => {
  it("keeps the displayed day when the time is edited in a non-browser timezone", () => {
    const zone = disagreeingZone(INSTANT);
    const { onChange } = renderPicker(zone);

    changeTime("15:00");

    expect(onChange).toHaveBeenLastCalledWith(
      fromZonedTime(`${zoneDay(INSTANT, zone)} 15:00`, zone).toISOString()
    );
  });

  it("keeps the displayed day across repeated time edits", () => {
    const zone = disagreeingZone(INSTANT);
    const { onChange } = renderPicker(zone);

    changeTime("15:00");
    changeTime("16:30");

    expect(onChange).toHaveBeenLastCalledWith(
      fromZonedTime(`${zoneDay(INSTANT, zone)} 16:30`, zone).toISOString()
    );
  });

  it("keeps the displayed day when the time is edited in the browser timezone", () => {
    const { onChange } = renderPicker(browserZone);

    changeTime("15:00");

    expect(onChange).toHaveBeenLastCalledWith(
      fromZonedTime(`${browserDay(INSTANT)} 15:00`, browserZone).toISOString()
    );
  });

  it("highlights the day shown in the display timezone", () => {
    const zone = disagreeingZone(INSTANT);
    const { highlightedDays } = renderPicker(zone);

    expect(highlightedDays()).toEqual([String(Number(zoneDay(INSTANT, zone).slice(-2)))]);
  });

  it("applies a later time edit to the day picked on the calendar", () => {
    const zone = disagreeingZone(INSTANT);
    const { onChange } = renderPicker(zone);

    clickDay(12);
    changeTime("15:00");

    expect(onChange).toHaveBeenLastCalledWith(
      fromZonedTime("2026-11-12 15:00", zone).toISOString()
    );
  });

  it.each([
    ["a non-browser timezone", () => disagreeingZone(INSTANT)],
    ["the browser timezone", () => browserZone],
  ])("leaves the date and time alone when the selected day is re-clicked in %s", (_label, getZone) => {
    const zone = getZone();
    const { onChange, summary } = renderPicker(zone);
    const before = summary();

    clickDay(Number(zoneDay(INSTANT, zone).slice(-2)));

    expect(onChange).toHaveBeenLastCalledWith(INSTANT);
    expect(summary()).toBe(before);
  });

  it("does not move the day again after re-clicking the selected day", () => {
    const zone = disagreeingZone(INSTANT);
    const { onChange } = renderPicker(zone);

    clickDay(Number(zoneDay(INSTANT, zone).slice(-2)));
    changeTime("15:00");

    expect(onChange).toHaveBeenLastCalledWith(
      fromZonedTime(`${zoneDay(INSTANT, zone)} 15:00`, zone).toISOString()
    );
  });
});
