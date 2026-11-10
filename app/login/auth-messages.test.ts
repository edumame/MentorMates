import { getNetworkErrorMessage, getPasswordResetErrorMessage, getSignUpErrorMessage, GENERIC_SIGN_UP_ERROR } from "./auth-messages";

describe("auth messages (PUB-016)", () => {
  it.each([
    [{ code: "user_already_exists" }, /already exists/],
    [{ code: "email_exists" }, /already exists/],
    [{ code: "over_email_send_rate_limit" }, /Too many attempts/],
    [{ status: 429 }, /Too many attempts/],
    [{ code: "weak_password" }, /stronger password/],
    [{ code: "email_address_invalid" }, /valid email/],
    [{ code: "something_new" }, new RegExp(GENERIC_SIGN_UP_ERROR.replace(/\./g, "\\."))],
    [null, /couldn't create your account/],
  ])("maps sign-up error %p", (error, expected) => {
    expect(getSignUpErrorMessage(error)).toMatch(expected);
  });

  it("maps reset errors without echoing raw provider text", () => {
    expect(getPasswordResetErrorMessage({ code: "over_request_rate_limit" })).toMatch(/Too many/);
    expect(getPasswordResetErrorMessage({ message: "internal db detail" })).not.toMatch(/internal db/);
  });

  it("only includes setup hints in development", () => {
    expect(getNetworkErrorMessage("production")).not.toMatch(/env\.local/);
    expect(getNetworkErrorMessage("test")).not.toMatch(/env\.local/);
    expect(getNetworkErrorMessage("development")).toMatch(/env\.local/);
  });
});
