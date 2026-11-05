import { render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CertificatePage from "./page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useSearchParams: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

jest.mock("@/features/projects/components/displays/ProjectShareSection", () => ({
  buildShareCaption: () => "",
}));

const baseProject = {
  id: "project-1",
  project_name: "Rocket",
  lead_name: "Lea Lead",
  lead_email: "lead@example.com",
  teammates: ["mate@example.com"],
  event_id: "event-1",
  submitted: true,
};

function mockProject(project: Record<string, unknown>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ project }),
  });
}

function mockViewer(email: string | null) {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: email ? { email } : null },
  });
}

function setPersonParam(email: string | null) {
  (useSearchParams as jest.Mock).mockReturnValue(
    new URLSearchParams(email ? { p: email } : {})
  );
}

describe("CertificatePage recipient name", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockImplementation(() => {
      const query = {
        select: () => query,
        eq: () => query,
        // RLS gives logged-out viewers no user_profiles rows.
        in: async () => ({ data: [], error: null }),
        single: async () => ({
          data: { event_name: "Hack", event_date: null, location: null },
        }),
      };
      return query;
    });
    mockViewer(null);
    setPersonParam(null);
  });

  it("uses the API's display name on a shared teammate link", async () => {
    setPersonParam("mate@example.com");
    mockProject({
      ...baseProject,
      team_profiles: {
        "mate@example.com": {
          display_name: "Mia Mate",
          avatar_url: null,
          affiliation: null,
        },
      },
    });

    render(<CertificatePage />);

    expect(await screen.findByText("Mia Mate")).toBeInTheDocument();
  });

  it("falls back to lead_name on a shared lead link", async () => {
    setPersonParam("lead@example.com");
    mockProject(baseProject);

    render(<CertificatePage />);

    expect(await screen.findByText("Lea Lead")).toBeInTheDocument();
  });

  it("falls back to lead_name for the signed-in lead", async () => {
    mockViewer("lead@example.com");
    mockProject({ ...baseProject, team_profiles: {} });

    render(<CertificatePage />);

    expect(await screen.findByText("Lea Lead")).toBeInTheDocument();
  });

  it("prefers the profile name over lead_name for the lead", async () => {
    setPersonParam("lead@example.com");
    mockProject({
      ...baseProject,
      team_profiles: {
        "lead@example.com": {
          display_name: "Profile Name",
          avatar_url: null,
          affiliation: null,
        },
      },
    });

    render(<CertificatePage />);

    expect(await screen.findByText("Profile Name")).toBeInTheDocument();
  });

  it("falls back to the email prefix for an unnamed teammate", async () => {
    setPersonParam("mate@example.com");
    mockProject({ ...baseProject, lead_name: "" });

    render(<CertificatePage />);

    expect(await screen.findByText("mate")).toBeInTheDocument();
  });
});
