/**
 * @jest-environment node
 */

import { deflateSync } from "zlib";
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { POST } from "./route";

const mockCreateCompletion = jest.fn();
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreateCompletion } },
  })),
}));

// Jest loads CommonJS with module.parent set, so the entry point's debug block
// stays dormant here. The production bundle has no module.parent, which makes
// the entry point throw on import. Reproduce that so a route that goes back to
// importing it fails this suite.
jest.mock("pdf-parse", () => {
  throw new Error(
    "ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'"
  );
});

/** Builds a valid PDF whose page content is a Flate-compressed stream. */
function buildPdf(pageContent: string): Buffer {
  const stream = deflateSync(Buffer.from(pageContent, "latin1"));
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R " +
        "/Resources << /Font << /F1 5 0 R >> >> >>"
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`
      ),
      stream,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];

  let pdf = Buffer.from("%PDF-1.4\n");
  const offsets = objects.map((body, index) => {
    const offset = pdf.length;
    pdf = Buffer.concat([
      pdf,
      Buffer.from(`${index + 1} 0 obj\n`),
      body,
      Buffer.from("\nendobj\n"),
    ]);
    return offset;
  });

  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(pdf.length),
    "%%EOF",
    "",
  ].join("\n");

  return Buffer.concat([pdf, Buffer.from(xref)]);
}

function uploadRequest(content: Buffer, name = "rubric.pdf") {
  const formData = new FormData();
  formData.append(
    "file",
    new File([new Uint8Array(content)], name, { type: "application/pdf" })
  );
  return new NextRequest("http://localhost/api/events/ai-chat/parse-file", {
    method: "POST",
    body: formData,
  });
}

function mockAiResponse(body: unknown) {
  mockCreateCompletion.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(body) } }],
  });
}

const TEXT_PDF_CONTENT = "BT /F1 12 Tf 72 720 Td (Innovation rubric) Tj ET";
const PARSE_FAILURE_ERROR =
  "Failed to parse PDF. The file may be image-only or corrupted.";

describe("POST /api/events/ai-chat/parse-file", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    mockCreateSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "organizer-1" } },
          error: null,
        }),
      },
    });
    mockAiResponse({
      tracks: { "track-1": { name: "Main Track", criteria: [] } },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("sends the extracted text of a compressed PDF to the AI", async () => {
    const response = await POST(uploadRequest(buildPdf(TEXT_PDF_CONTENT)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      config: { tracks: { "track-1": { name: "Main Track" } } },
    });
    const { messages } = mockCreateCompletion.mock.calls[0][0];
    expect(messages[1].content).toContain("Innovation rubric");
    expect(messages[1].content).not.toContain("endobj");
  });

  it("rejects a corrupted PDF without sending its bytes to the AI", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(
      uploadRequest(
        Buffer.from("%PDF-1.4 this is readable but it is not a real PDF file")
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: PARSE_FAILURE_ERROR,
      success: false,
    });
    expect(mockCreateCompletion).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "PDF parse error:",
      expect.anything()
    );
  });

  it("rejects a PDF with no extractable text", async () => {
    const response = await POST(uploadRequest(buildPdf("q Q")));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: PARSE_FAILURE_ERROR,
      success: false,
    });
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty tracks object", {}],
    ["a tracks array", []],
  ])("does not report success when the AI returns %s", async (_label, tracks) => {
    mockAiResponse({ tracks });

    const response = await POST(uploadRequest(buildPdf(TEXT_PDF_CONTENT)));

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Could not extract tracks from the document. Try a clearer format.",
    });
  });
});
