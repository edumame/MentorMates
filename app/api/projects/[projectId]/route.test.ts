/** @jest-environment node */
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { POST } from "../submit/route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
import { saveProjectSubmission } from "@/lib/projects/submission-service";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/lib/projects/access", () => ({ getProjectEditAccess: jest.fn() }));
jest.mock("@/lib/projects/submission-service", () => ({
  ...jest.requireActual("@/lib/projects/submission-service"),
  saveProjectSubmission: jest.fn(),
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const request = (body: unknown) =>
  new NextRequest("https://example.test/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "lead@example.test" } },
        error: null,
      }),
    },
  } as never);
  jest.mocked(getProjectEditAccess).mockResolvedValue({
    access: { canEdit: true },
    error: null,
    status: 200,
  } as never);
  jest
    .mocked(saveProjectSubmission)
    .mockResolvedValue({ status: 200, project: {} } as never);
});

// saveProjectSubmission refuses an event change without a known acting user.
it("PATCH passes the acting user to the save", async () => {
  await PATCH(request({ event_id: eventId }), {
    params: Promise.resolve({ projectId }),
  });

  expect(saveProjectSubmission).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ actorUserId: "user-1" }),
  );
});

it("submit passes the acting user to the save", async () => {
  await POST(request({ project_id: projectId, event_id: eventId }));

  expect(saveProjectSubmission).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ actorUserId: "user-1" }),
  );
});
