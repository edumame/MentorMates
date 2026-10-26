import { render, screen } from "@testing-library/react";
import ProjectTimeline from "./ProjectTimeline";
import { supabase } from "@/lib/supabase";
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));
const row = { id: "meeting", name: "Team session", status: "completed", started_at: null, ended_at: null, created_at: null, score: 75, can_view_details: false };
beforeEach(() => jest.clearAllMocks());
it("loads only the sanitized RPC and shows metadata without transcript links for project readers", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [row], error: null });
  render(<ProjectTimeline projectId="project" />);
  expect(await screen.findByText("Team session")).toBeInTheDocument();
  expect(supabase.rpc).toHaveBeenCalledWith("project_meeting_timeline", { p_project_id: "project" });
  expect(screen.queryByRole("link", { name: "View" })).not.toBeInTheDocument();
});
it.each([["completed", "/learn/meeting"], ["upcoming", "/call/meeting"]])("retains authorized %s links", async (status, href) => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ ...row, status, can_view_details: true }], error: null });
  render(<ProjectTimeline projectId="project" />);
  expect(await screen.findByRole("link", { name: "View" })).toHaveAttribute("href", href);
});
it("keeps processing links disabled even for full-detail readers", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ ...row, status: "processing", can_view_details: true }], error: null });
  render(<ProjectTimeline projectId="project" />);
  await screen.findByText("Team session"); expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("distinguishes failed authorization/network lookup from empty history", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: "private error" } });
  render(<ProjectTimeline projectId="project" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load sessions");
  expect(screen.queryByText("No sessions for this project yet.")).not.toBeInTheDocument();
  spy.mockRestore();
});
it("preserves genuine empty state", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });
  render(<ProjectTimeline projectId="project" />);
  expect(await screen.findByText("No sessions for this project yet.")).toBeInTheDocument();
});
