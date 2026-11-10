import { loginRedirectFor } from "./login-redirect";

it("builds a login URL that the login page's returnUrl handling understands", () => {
  expect(loginRedirectFor("/call/abc")).toBe("/login?returnUrl=%2Fcall%2Fabc");
  expect(new URL(loginRedirectFor("/chat/x?y=1"), "http://h").searchParams.get("returnUrl")).toBe("/chat/x?y=1");
});
