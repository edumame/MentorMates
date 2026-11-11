import { ApprovalStatus, EventVisibility } from "@/lib/types";
import {
  isWithdrawnVisibility,
  withdrawSubmissionUpdate,
} from "./approval-visibility";

describe("isWithdrawnVisibility", () => {
  it.each([EventVisibility.Archived, EventVisibility.Draft])(
    "treats %s as withdrawn",
    (visibility) => {
      expect(isWithdrawnVisibility(visibility)).toBe(true);
    },
  );

  it.each([
    EventVisibility.Private,
    EventVisibility.Public,
    EventVisibility.Test,
    EventVisibility.Demo,
    null,
    undefined,
  ])("does not treat %s as withdrawn", (visibility) => {
    expect(isWithdrawnVisibility(visibility)).toBe(false);
  });
});

describe("withdrawSubmissionUpdate", () => {
  it.each([EventVisibility.Archived, EventVisibility.Draft])(
    "clears a pending submission moving to %s",
    (visibility) => {
      expect(
        withdrawSubmissionUpdate(ApprovalStatus.Submitted, visibility),
      ).toEqual({ approval_status: ApprovalStatus.NotSubmitted });
    },
  );

  it("keeps a pending submission moving to private", () => {
    expect(
      withdrawSubmissionUpdate(
        ApprovalStatus.Submitted,
        EventVisibility.Private,
      ),
    ).toEqual({});
  });

  it.each([
    ApprovalStatus.Approved,
    ApprovalStatus.Rejected,
    ApprovalStatus.NotSubmitted,
    null,
    undefined,
  ])("leaves approval status %s alone", (approvalStatus) => {
    expect(
      withdrawSubmissionUpdate(approvalStatus, EventVisibility.Archived),
    ).toEqual({});
  });
});
