import { getProjectFeedbackUrl } from "./feedback-url";

it("builds the canonical public link without query or hash", () => {
  expect(getProjectFeedbackUrl("abc", "https://mentormates.test")).toBe("https://mentormates.test/projects/public/abc");
});
