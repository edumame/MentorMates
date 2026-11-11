import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrganizerEditOverview } from "./organizer-edit-overview";

// BasicInfoTab stays real here: the bug lives in how it registers its save
// handler with the parent, which a stub would hide.
const mockReplace = jest.fn();
const mockEventUpdate = jest.fn();
const mockStorageUpload = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: jest.fn(),
    push: jest.fn(),
  }),
  usePathname: () => "/events/sample/overview",
  useSearchParams: () => mockSearchParams,
}));
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/markdown/plugins", () => ({
  markdownRemarkPlugins: [],
  markdownRehypePlugins: [],
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/participants",
  () => ({ ParticipantsTab: () => null }),
);
jest.mock("@/features/user/dashboards/dashboard/organizer/teams", () => ({
  OrganizerTeamsTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/access", () => ({
  AccessTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/tracks", () => ({
  EventTracksContainer: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/submissions", () => ({
  SubmissionsTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/scores", () => ({
  ScoresTab: () => null,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/pricing/PricingTab",
  () => ({ PricingTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/notifications/EmailDashboard",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock("@/features/user/dashboards/dashboard/organizer/email", () => ({
  EmailTab: () => null,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/import/ProjectImportButton",
  () => ({ ProjectImport: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/submissions/SubmissionFieldsSettings",
  () => ({ SubmissionFieldsSettings: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ContentTab",
  () => ({ ContentTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ScheduleTab",
  () => ({ ScheduleTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ResourcesTab",
  () => ({ ResourcesTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/RulesTab",
  () => ({ RulesTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/FAQTab",
  () => ({ FAQTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/registration",
  () => ({ IntakeResponsesTab: () => null }),
);
jest.mock("@/components/events/event-card", () => ({ EventCard: () => null }));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/api-keys/ApiKeysTab",
  () => ({ ApiKeysTab: () => null }),
);
jest.mock("@/features/intake-forms/components/IntakeFormBuilder", () => ({
  IntakeFormBuilder: () => null,
}));
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    storage: {
      from: () => ({
        upload: async (...args: unknown[]) => {
          mockStorageUpload(...args);
          return { error: null };
        },
        getPublicUrl: () => ({
          data: { publicUrl: "https://cdn.test/new-cover.png" },
        }),
      }),
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        update: (values: unknown) => {
          mockEventUpdate(values);
          return query;
        },
        single: async () => ({
          data: {
            event_id: "sample",
            event_name: "Sample",
            event_tracks: [],
            visibility: "public",
            approval_status: "approved",
          },
        }),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({ count: 0, error: null }).then(resolve),
      };
      return query;
    },
  },
}));

const flushEffects = () => act(async () => {});

async function openBasicsTab() {
  mockSearchParams = new URLSearchParams();
  const view = render(<OrganizerEditOverview eventId="sample" />);
  await screen.findByRole("tab", { name: "Forms" });
  await flushEffects();

  mockSearchParams = new URLSearchParams({ tab: "overview", subtab: "basics" });
  view.rerender(<OrganizerEditOverview eventId="sample" />);
  await flushEffects();
  return view;
}

async function pickCoverImage() {
  const realCreateElement = document.createElement.bind(document);
  let input: HTMLInputElement | undefined;
  const createElement = jest
    .spyOn(document, "createElement")
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = realCreateElement(tagName, options);
      if (tagName === "input") {
        input = element as HTMLInputElement;
        input.click = () => {};
      }
      return element;
    });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  createElement.mockRestore();

  // Uploads sniff magic bytes (ORG-022), so the file needs a real PNG header.
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const file = new File([pngHeader], "cover.png", { type: "image/png" });
  await act(async () => {
    input!.onchange?.({ target: { files: [file] } } as unknown as Event);
  });
  return file;
}

const updateEventButton = () =>
  screen.getByRole("button", { name: "Update Event" });

beforeEach(() => {
  mockReplace.mockClear();
  mockEventUpdate.mockClear();
  mockStorageUpload.mockClear();
  localStorage.clear();
  URL.createObjectURL = jest.fn(() => "blob:cover-preview");
});

it("enables Update Event as soon as the Basics tab has mounted", async () => {
  await openBasicsTab();
  await waitFor(() => expect(updateEventButton()).toBeEnabled());
});

it("saves a new cover image without any other field being edited", async () => {
  await openBasicsTab();
  const file = await pickCoverImage();
  expect(screen.getByAltText("Cover preview")).toBeInTheDocument();
  expect(updateEventButton()).toBeEnabled();

  fireEvent.click(updateEventButton());

  await waitFor(() => expect(mockEventUpdate).toHaveBeenCalledTimes(1));
  expect(mockStorageUpload).toHaveBeenCalledWith(
    expect.any(String),
    file,
    expect.objectContaining({ contentType: "image/png" }),
  );
  expect(mockEventUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      cover_image_url: "https://cdn.test/new-cover.png",
    }),
  );
});
