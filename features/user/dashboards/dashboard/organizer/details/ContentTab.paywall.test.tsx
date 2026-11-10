import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { EventDetails } from "@/lib/types";
import { ContentTab } from "./ContentTab";

const rpc = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => {
      const q = {
        select: () => q,
        eq: async () => ({ data: [{ title: "Lesson 1" }], error: null }),
      };
      return q;
    },
  },
}));
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }: { children: string }) => <>{children}</> }));
jest.mock("@/components/markdown/custom-components", () => ({ customMarkdownComponents: {} }));
jest.mock("@/components/markdown/plugins", () => ({ markdownRehypePlugins: [], markdownRemarkPlugins: [] }));

function Harness() {
  const [event, setEvent] = useState<EventDetails | null>({ event_id: "event-1", event_name: "E", event_date: "", location: "" } as EventDetails);
  return event ? <ContentTab event={event} setEvent={setEvent} /> : null;
}

// PUB-002: paywall content is not on the dashboard's event row; the editor
// loads it through the members-only RPC and keeps it alongside lessons.
it("loads paywall content through get_event_paywall_content", async () => {
  rpc.mockResolvedValue({ data: "MEMBERS ONLY", error: null });
  render(<Harness />);
  await waitFor(() => expect(screen.getByDisplayValue("MEMBERS ONLY")).toBeInTheDocument());
  expect(rpc).toHaveBeenCalledWith("get_event_paywall_content", { p_event_id: "event-1" });
});
