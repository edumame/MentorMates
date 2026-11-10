import { avatarObjectPath } from "./avatar-upload";

describe("avatarObjectPath", () => {
  it("derives the extension from the MIME type, not the file name", () => {
    expect(avatarObjectPath("uid-1", { type: "image/jpeg", size: 10 }, 42)).toEqual({ path: "avatars/uid-1-42.jpg" });
  });
  it.each(["image/svg+xml", "text/html", "", "application/octet-stream"])("rejects %p", (type) => {
    expect(avatarObjectPath("uid-1", { type, size: 10 })).toHaveProperty("error");
  });
  it("rejects files over 5MB", () => {
    expect(avatarObjectPath("uid-1", { type: "image/png", size: 5 * 1024 * 1024 + 1 })).toHaveProperty("error");
  });
});
