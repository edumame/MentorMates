/**
 * #778 — quick smoke that the showFieldsSettings prop hides the
 * SubmissionFieldsSettings configuration block. The full SubmissionsTab is
 * heavy (real-time subscriptions, supabase, table sorting); we just stub it
 * down to verify the conditional renders correctly.
 */

import { render, screen } from "@testing-library/react";

jest.mock("./SubmissionFieldsSettings", () => ({
  SubmissionFieldsSettings: () => (
    <div data-testid="submission-fields-settings">FIELDS</div>
  ),
}));

// Stub the heavy dependencies inside SubmissionsTab.
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }),
    removeChannel: () => {},
  },
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: () => {} }),
}));

// Import after mocks.
import { SubmissionsTab } from "./index";

describe("SubmissionsTab — showFieldsSettings prop (#778)", () => {
  it("renders SubmissionFieldsSettings by default (back-compat)", () => {
    render(<SubmissionsTab eventId="event-1" />);
    expect(screen.getByTestId("submission-fields-settings")).toBeInTheDocument();
  });

  it("omits SubmissionFieldsSettings when showFieldsSettings={false}", () => {
    render(<SubmissionsTab eventId="event-1" showFieldsSettings={false} />);
    expect(
      screen.queryByTestId("submission-fields-settings")
    ).not.toBeInTheDocument();
  });
});
