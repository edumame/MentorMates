import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));

import { SubmitEventForm } from "./submit-form";

// jsdom has no ResizeObserver; the Radix checkbox on the Logistics step needs one.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Jest's sandbox keeps process.env.TZ from reaching the real clock, so simulate a
// Hong Kong browser: zoneless datetime-local strings parse as local time there.
const RealDate = Date;
class HongKongBrowserDate extends RealDate {
  constructor(...args: unknown[]) {
    const [value] = args;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      super(`${value}:00+08:00`);
    } else {
      super(...(args as []));
    }
  }
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function continueTo(heading: string) {
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await screen.findByRole("heading", { name: heading });
}

async function fillThroughLogistics(startDt: string, endDt: string) {
  render(<SubmitEventForm />);

  fill(/your name/i, "Ada Lovelace");
  fill(/^email/i, "ada@example.com");
  await continueTo("Your event");

  fill(/event name/i, "Sample Demo Day");
  fill(/link/i, "https://luma.com/sample-demo");
  await continueTo("Logistics");

  fill(/start \(PT\)/i, startDt);
  fill(/end \(PT\)/i, endDt);
  fill(/location/i, "Hong Kong");
}

async function submitAndReadBody(startDt: string, endDt: string) {
  await fillThroughLogistics(startDt, endDt);
  await continueTo("Review & submit");
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const [, init] = (global.fetch as jest.Mock).mock.calls[0];
  return JSON.parse(init.body as string) as {
    start_datetime: string;
    end_datetime: string;
  };
}

describe("SubmitEventForm times", () => {
  beforeEach(() => {
    global.Date = HongKongBrowserDate as DateConstructor;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it("stores times labelled PT as Pacific Standard Time", async () => {
    const body = await submitAndReadBody("2026-12-01T09:00", "2026-12-01T17:30");

    expect(body.start_datetime).toBe("2026-12-01T17:00:00.000Z");
    expect(body.end_datetime).toBe("2026-12-02T01:30:00.000Z");
  });

  it("stores times labelled PT as Pacific Daylight Time in summer", async () => {
    const body = await submitAndReadBody("2026-07-01T09:00", "2026-07-01T17:30");

    expect(body.start_datetime).toBe("2026-07-01T16:00:00.000Z");
    expect(body.end_datetime).toBe("2026-07-02T00:30:00.000Z");
  });

  it("shows the review times in PT", async () => {
    await fillThroughLogistics("2026-12-01T09:00", "2026-12-01T17:30");
    await continueTo("Review & submit");

    expect(screen.getByText("Dec 1, 2026, 9:00 AM PT")).toBeInTheDocument();
    expect(screen.getByText("Dec 1, 2026, 5:30 PM PT")).toBeInTheDocument();
  });

  it("shows a PT time that does not exist in the browser's zone", async () => {
    // Clocks skip 1:00-2:00 AM on this date in London but not in Pacific Time,
    // so a real browser there would shift the entered time when parsing it locally.
    await fillThroughLogistics("2026-03-29T01:30", "2026-03-29T01:45");
    await continueTo("Review & submit");

    expect(screen.getByText("Mar 29, 2026, 1:30 AM PT")).toBeInTheDocument();
  });

  it("rejects an end before the start", async () => {
    await fillThroughLogistics("2026-12-01T09:00", "2026-12-01T08:59");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText("End must be on or after start.")
    ).toBeInTheDocument();
  });
});
