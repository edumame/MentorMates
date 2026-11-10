import { isSafeWebUrl, webUrlSchema } from "./profile-links";

describe("profile links (MENT-011)", () => {
  it.each(["https://github.com/x", "http://example.test/a?b=1"])("accepts %s", (url) => {
    expect(isSafeWebUrl(url)).toBe(true);
    expect(webUrlSchema().safeParse(url).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,hi", "https://user:pw@example.test", "ftp://x.test", "nope"])("rejects %s", (url) => {
    expect(isSafeWebUrl(url)).toBe(false);
    expect(webUrlSchema().safeParse(url).success).toBe(false);
  });
});
