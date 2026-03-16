import {
  getEventApprovalRequestEmailTemplate,
  EventApprovalRequestEmailData,
} from "../event-approval-request";

const sampleData: EventApprovalRequestEmailData = {
  eventName: "TreeHacks 2025",
  organizerName: "Jane Doe",
  organizerEmail: "jane@example.com",
  eventDate: "2025-02-27",
  location: "Stanford University",
  eventId: "abc-123-def",
};

describe("getEventApprovalRequestEmailTemplate", () => {
  it("returns subject flagged as IMPORTANT with event name", () => {
    const result = getEventApprovalRequestEmailTemplate(sampleData);
    expect(result.subject).toContain("[IMPORTANT]");
    expect(result.subject).toContain("Approve");
    expect(result.subject).toContain("TreeHacks 2025");
  });

  it("includes event details in the HTML body", () => {
    const result = getEventApprovalRequestEmailTemplate(sampleData);
    expect(result.html).toContain("TreeHacks 2025");
    expect(result.html).toContain("Jane Doe");
    expect(result.html).toContain("jane@example.com");
    expect(result.html).toContain("2025-02-27");
    expect(result.html).toContain("Stanford University");
  });

  it("includes a link to the event page", () => {
    const result = getEventApprovalRequestEmailTemplate(sampleData);
    expect(result.html).toContain(`/events/abc-123-def/overview`);
  });

  it("includes a link to the admin dashboard", () => {
    const result = getEventApprovalRequestEmailTemplate(sampleData);
    expect(result.html).toContain("/admin");
  });

  it("includes an approval urgency warning", () => {
    const result = getEventApprovalRequestEmailTemplate(sampleData);
    expect(result.html).toContain("requires your approval");
  });
});
