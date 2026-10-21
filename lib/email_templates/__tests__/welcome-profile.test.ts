import { getWelcomeProfileEmailTemplate } from "../welcome-profile";

test("escapes display names and URL attribute contents", () => {
  const { html } = getWelcomeProfileEmailTemplate('<img src=x onerror="alert(1)">', 'https://example.com/profile/a?x="&y=1');
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
  expect(html).toContain('href="https://example.com/profile/a?x=&quot;&amp;y=1"');
});

test("uses a greeting fallback", () => {
  expect(getWelcomeProfileEmailTemplate(" ", "https://example.com/profile/a").html).toContain("MentorMates, there!");
});
