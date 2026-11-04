/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { useNotificationData } from "./NotificationPopoverContent";

const SESSION = { user: { id: "user-1" } };

// Shaped like the generated user_profiles Row: it has no phone_number column.
const PROFILE_ROW = {
  uid: "user-1",
  display_name: "Dev",
  affiliation: "ACME",
  links: { linkedin: "https://linkedin.com/in/me" },
};

let profileRow: Record<string, unknown> | null = PROFILE_ROW;
let phoneRows: { phone_number: string }[] | null = [];
let phoneError: { message: string } | null = null;
const fromMock = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: SESSION } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: (table: string) => fromMock(table),
  },
}));

function chain(result: () => unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.limit = jest.fn(() => Promise.resolve(result()));
  builder.single = jest.fn(() => Promise.resolve(result()));
  return builder;
}

describe("useNotificationData", () => {
  beforeEach(() => {
    profileRow = PROFILE_ROW;
    phoneRows = [];
    phoneError = null;
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) =>
      table === "user_phone_numbers"
        ? chain(() => ({ data: phoneRows, error: phoneError }))
        : chain(() => ({ data: profileRow, error: null }))
    );
  });

  it("clears the warning when the phone lives in user_phone_numbers", async () => {
    phoneRows = [{ phone_number: "+1 555 0100" }];

    const { result } = renderHook(() => useNotificationData());

    await waitFor(() => {
      expect(result.current.userProfile).not.toBeNull();
    });
    expect(result.current.needsProfileCompletion).toBe(false);
    expect(result.current.missingProfileFields).toEqual([]);
    expect(fromMock).toHaveBeenCalledWith("user_phone_numbers");
  });

  it("still lists the phone number when the user has none saved", async () => {
    const { result } = renderHook(() => useNotificationData());

    await waitFor(() => {
      expect(result.current.missingProfileFields).toEqual(["phone number"]);
    });
    expect(result.current.needsProfileCompletion).toBe(true);
  });

  it("keeps the warning when the phone lookup fails", async () => {
    phoneRows = null;
    phoneError = { message: "boom" };

    const { result } = renderHook(() => useNotificationData());

    await waitFor(() => {
      expect(result.current.missingProfileFields).toEqual(["phone number"]);
    });
  });

  it("reports every field when the profile row is missing", async () => {
    profileRow = null;
    phoneRows = [{ phone_number: "+1 555 0100" }];

    const { result } = renderHook(() => useNotificationData());

    await waitFor(() => {
      expect(fromMock).toHaveBeenCalledWith("user_profiles");
      expect(result.current.session).not.toBeNull();
    });
    expect(result.current.needsProfileCompletion).toBe(true);
    expect(result.current.missingProfileFields).toEqual([
      "affiliation",
      "phone number",
      "LinkedIn",
    ]);
  });
});
