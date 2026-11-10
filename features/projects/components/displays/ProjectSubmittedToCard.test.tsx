import { render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { ProjectSubmittedToCard, SUBMITTED_TO_EVENT_COLUMNS } from "./ProjectSubmittedToCard";

const base = { event_id: "ev-1", event_name: "QA Free Hack", location: "Online" };

describe("ProjectSubmittedToCard (NEW-001)", () => {
  it("never shows placeholder copy or a Paid badge for a free event", () => {
    render(<ProjectSubmittedToCard event={{ ...base, paid: false }} />);
    const card = screen.getByTestId("project-submitted-to");
    expect(card).not.toHaveTextContent(/lorem ipsum/i);
    expect(card).not.toHaveTextContent("Paid event");
    expect(card).toHaveTextContent("QA Free Hack");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/events/ev-1/overview");
  });

  it("shows the Paid badge only for paid events", () => {
    render(<ProjectSubmittedToCard event={{ ...base, paid: true }} />);
    expect(screen.getByText("Paid event")).toBeInTheDocument();
  });

  it("renders the real event types and blurb", () => {
    render(
      <ProjectSubmittedToCard
        event={{ ...base, event_type: ["Hackathon", "Workshop"], event_blurb: "  A weekend build.  " }}
      />
    );
    const card = screen.getByTestId("project-submitted-to");
    expect(within(card).getByText("Hackathon")).toBeInTheDocument();
    expect(within(card).getByText("Workshop")).toBeInTheDocument();
    expect(within(card).getByText("A weekend build.")).toBeInTheDocument();
  });

  it("does not invent a Hackathon badge when the event has no type", () => {
    render(<ProjectSubmittedToCard event={{ ...base, event_type: [] }} />);
    expect(screen.queryByText("Hackathon")).not.toBeInTheDocument();
  });

  it("falls back to Online and a gradient when location/cover are missing", () => {
    render(<ProjectSubmittedToCard event={{ event_id: "ev-2", event_name: "QA", location: null }} />);
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("reads the badge/blurb columns", () => {
    expect(SUBMITTED_TO_EVENT_COLUMNS).toEqual(expect.stringContaining("event_type"));
    expect(SUBMITTED_TO_EVENT_COLUMNS).toEqual(expect.stringContaining("paid"));
    expect(SUBMITTED_TO_EVENT_COLUMNS).toEqual(expect.stringContaining("event_blurb"));
  });

  test.each(["app/projects/[id]/page.tsx", "app/projects/public/[id]/page.tsx"])(
    "%s renders the shared card and no placeholder copy",
    (route) => {
      const source = fs.readFileSync(path.join(process.cwd(), route), "utf8");
      expect(source).toContain("<ProjectSubmittedToCard event={eventDetails} />");
      expect(source).toContain("SUBMITTED_TO_EVENT_COLUMNS");
      expect(source).not.toMatch(/lorem ipsum/i);
      expect(source).not.toContain(">\n                                    Paid event");
    }
  );
});

test("Sessions timeline stays private-route only, with the documented parity exception", () => {
  const read = (route: string) => fs.readFileSync(path.join(process.cwd(), route), "utf8");
  const privateRoute = read("app/projects/[id]/page.tsx");
  expect(privateRoute).toContain("<ProjectTimeline projectId={project.id} />");
  expect(privateRoute).toContain("parity exception");
  expect(read("app/projects/public/[id]/page.tsx")).not.toContain("ProjectTimeline");
});
