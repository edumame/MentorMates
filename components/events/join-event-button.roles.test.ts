jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("next/navigation", () => ({ useRouter: jest.fn(), usePathname: jest.fn(), useSearchParams: jest.fn() }));

import { getSelfJoinableRoles } from "./join-event-button";
import { EventRole } from "@/lib/types";

// MENT-017 / ORG-013: organizer is never self-joinable; staff roles need a password.
describe("getSelfJoinableRoles", () => {
  it("offers only Participant when no role password is configured", () => {
    expect(getSelfJoinableRoles({})).toEqual([EventRole.Participant]);
  });

  it("offers Mentor/Judge only when the event has a password for them", () => {
    expect(getSelfJoinableRoles({ [EventRole.Judge]: true })).toEqual([EventRole.Participant, EventRole.Judge]);
    expect(getSelfJoinableRoles({ [EventRole.Mentor]: true, [EventRole.Judge]: true })).toEqual([
      EventRole.Participant,
      EventRole.Judge,
      EventRole.Mentor,
    ]);
  });

  it("never offers Organizer, even if a legacy organizer password row exists", () => {
    expect(getSelfJoinableRoles({ [EventRole.Organizer]: true })).not.toContain(EventRole.Organizer);
  });
});
