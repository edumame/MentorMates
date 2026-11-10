import { getProjectInvitationEmailTemplate } from "../project-invitation";

function render(expiresInDays?: number) {
  return getProjectInvitationEmailTemplate(
    "Rocket",
    "project-1",
    "Lead",
    undefined,
    "token-1",
    expiresInDays
  ).html;
}

test("states the expiry and how to recover from it", () => {
  const html = render(7);
  expect(html).toContain("expires in 7 days");
  expect(html).toContain("send a new one");
});

test("uses the singular for a one-day expiry", () => {
  expect(render(1)).toContain("expires in 1 day.");
});

test("makes no expiry claim when none is given", () => {
  expect(render()).not.toMatch(/expires/i);
});
