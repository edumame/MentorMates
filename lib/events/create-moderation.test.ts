import { resolveCreateModeration } from "./create-moderation";
import { ApprovalStatus, EventVisibility } from "@/lib/types";

describe("resolveCreateModeration (ORG-002 round 2)", () => {
  it.each([EventVisibility.Draft, EventVisibility.Private])("keeps %s for non-admins, unapproved and unfeatured", (visibility) => {
    expect(
      resolveCreateModeration({ isAdmin: false, visibility, approvalStatus: ApprovalStatus.Approved, featured: true })
    ).toEqual({ visibility, approval_status: "not_submitted", featured: false, publicRequestDeferred: false });
  });

  it("turns a non-admin public request into private + not_submitted", () => {
    expect(
      resolveCreateModeration({ isAdmin: false, visibility: EventVisibility.Public, approvalStatus: ApprovalStatus.Approved })
    ).toEqual({ visibility: "private", approval_status: "not_submitted", featured: false, publicRequestDeferred: true });
  });

  it.each([EventVisibility.Archived, undefined])("never lets non-admins create %p as anything but draft/private", (visibility) => {
    const result = resolveCreateModeration({ isAdmin: false, visibility });
    expect(["draft", "private"]).toContain(result.visibility);
  });

  it("lets admins create public, approved, featured events", () => {
    expect(
      resolveCreateModeration({ isAdmin: true, visibility: EventVisibility.Public, approvalStatus: ApprovalStatus.Approved, featured: true })
    ).toEqual({ visibility: "public", approval_status: "approved", featured: true, publicRequestDeferred: false });
  });
});
