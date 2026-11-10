import { isApprovedApprovalStatus, isHttpUrl, isUnreviewedApprovalStatus, safeExternalHref } from "./approval";

describe("approval helpers (PUB-001)", () => {
  it("treats only 'approved' as approved", () => {
    expect(isApprovedApprovalStatus("approved")).toBe(true);
    for (const s of ["not_submitted", "submitted", "rejected", null, undefined]) {
      expect(isApprovedApprovalStatus(s)).toBe(false);
    }
  });

  it("flags submitted/rejected as unreviewed", () => {
    expect(isUnreviewedApprovalStatus("submitted")).toBe(true);
    expect(isUnreviewedApprovalStatus("rejected")).toBe(true);
    expect(isUnreviewedApprovalStatus("approved")).toBe(false);
    expect(isUnreviewedApprovalStatus(null)).toBe(false);
  });

  it.each(["https://a.example/x", "http://a.example", " https://a.example "])("accepts %p", (url) => {
    expect(isHttpUrl(url)).toBe(true);
    expect(safeExternalHref(url)).toBe(url.trim());
  });

  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "ftp://a", "", null, "not a url"])(
    "rejects %p",
    (url) => {
      expect(isHttpUrl(url)).toBe(false);
      expect(safeExternalHref(url)).toBeUndefined();
    }
  );
});
