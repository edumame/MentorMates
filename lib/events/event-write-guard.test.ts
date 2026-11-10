import {
  ADMIN_ONLY_VISIBILITY_ERROR,
  ARCHIVED_READ_ONLY_ERROR,
  MODERATION_FIELDS_ERROR,
  PUBLIC_REQUIRES_APPROVAL_ERROR,
  checkArchivedEventChildWrite,
  checkEventUpdate,
} from "./event-write-guard";

const draft = { visibility: "draft", approval_status: "not_submitted", featured: false };

describe("checkEventUpdate (XL-001)", () => {
  it("allows ordinary edits", () => {
    expect(checkEventUpdate({ isAdmin: false, current: draft, patch: { event_name: "x" } })).toEqual({ ok: true });
  });

  it.each(["not_submitted", "submitted", "rejected", null])(
    "refuses making an event public when approval_status=%p",
    (approval_status) => {
      expect(
        checkEventUpdate({ isAdmin: false, current: { ...draft, approval_status }, patch: { visibility: "public" } })
      ).toEqual({ ok: false, status: 403, error: PUBLIC_REQUIRES_APPROVAL_ERROR });
    }
  );

  it("allows publishing an approved event", () => {
    expect(
      checkEventUpdate({ isAdmin: false, current: { ...draft, approval_status: "approved" }, patch: { visibility: "public" } })
    ).toEqual({ ok: true });
  });

  it("allows keeping an already-public event public (trigger only blocks the transition)", () => {
    expect(
      checkEventUpdate({
        isAdmin: false,
        current: { visibility: "public", approval_status: "not_submitted" },
        patch: { visibility: "public", event_name: "x" },
      })
    ).toEqual({ ok: true });
  });

  it("allows demoting to draft/private", () => {
    expect(
      checkEventUpdate({ isAdmin: false, current: { visibility: "public", approval_status: "approved" }, patch: { visibility: "private" } })
    ).toEqual({ ok: true });
  });

  it.each(["demo", "test"])("refuses visibility=%s for non-admins, allows admins", (visibility) => {
    expect(checkEventUpdate({ isAdmin: false, current: draft, patch: { visibility } })).toEqual({
      ok: false,
      status: 403,
      error: ADMIN_ONLY_VISIBILITY_ERROR,
    });
    expect(checkEventUpdate({ isAdmin: false, current: { ...draft, visibility: "archived" }, patch: { visibility } })).toMatchObject({ ok: false, status: 403 });
    expect(checkEventUpdate({ isAdmin: true, current: draft, patch: { visibility } })).toEqual({ ok: true });
  });

  it("allows keeping an existing demo visibility on other edits", () => {
    expect(checkEventUpdate({ isAdmin: false, current: { ...draft, visibility: "demo" }, patch: { visibility: "demo", event_name: "x" } })).toEqual({ ok: true });
  });

  it("refuses moderation-field changes for non-admins", () => {
    expect(checkEventUpdate({ isAdmin: false, current: draft, patch: { featured: true } })).toEqual({
      ok: false,
      status: 403,
      error: MODERATION_FIELDS_ERROR,
    });
    expect(checkEventUpdate({ isAdmin: false, current: draft, patch: { approval_status: "approved" } })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("allows writing unchanged moderation values", () => {
    expect(checkEventUpdate({ isAdmin: false, current: draft, patch: { featured: false, approval_status: "not_submitted" } })).toEqual({ ok: true });
  });

  describe("archived events", () => {
    const archived = { visibility: "archived", approval_status: "not_submitted", featured: false };

    it("refuses any field edit", () => {
      expect(checkEventUpdate({ isAdmin: false, current: archived, patch: { event_name: "x" } })).toEqual({
        ok: false,
        status: 409,
        error: ARCHIVED_READ_ONLY_ERROR,
      });
    });

    it("refuses rename + republish together", () => {
      expect(
        checkEventUpdate({ isAdmin: false, current: archived, patch: { event_name: "x", visibility: "public" } })
      ).toMatchObject({ ok: false, status: 409 });
    });

    it("allows unarchive to private", () => {
      expect(checkEventUpdate({ isAdmin: false, current: archived, patch: { visibility: "private" } })).toEqual({ ok: true });
    });

    it("still applies the approval rule when unarchiving to public", () => {
      expect(checkEventUpdate({ isAdmin: false, current: archived, patch: { visibility: "public" } })).toEqual({
        ok: false,
        status: 403,
        error: PUBLIC_REQUIRES_APPROVAL_ERROR,
      });
    });

    it("lets admins edit archived events", () => {
      expect(checkEventUpdate({ isAdmin: true, current: archived, patch: { event_name: "x", visibility: "public", featured: true } })).toEqual({ ok: true });
    });
  });
});

describe("checkArchivedEventChildWrite", () => {
  it("refuses child writes on archived events for non-admins", () => {
    expect(checkArchivedEventChildWrite({ isAdmin: false, visibility: "archived" })).toEqual({
      ok: false,
      status: 409,
      error: ARCHIVED_READ_ONLY_ERROR,
    });
  });
  it.each(["draft", "private", "public", null, undefined])("allows visibility=%p", (visibility) => {
    expect(checkArchivedEventChildWrite({ isAdmin: false, visibility })).toEqual({ ok: true });
  });
  it("allows admins", () => {
    expect(checkArchivedEventChildWrite({ isAdmin: true, visibility: "archived" })).toEqual({ ok: true });
  });
});
