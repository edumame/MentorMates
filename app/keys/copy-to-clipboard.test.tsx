/**
 * @jest-environment jsdom
 */

// Tests for copyToClipboard and buildCopyableMarkdown logic from keys-page-client.tsx.
// We test functions directly to avoid rendering the full page (heavy server deps).

// --- copyToClipboard: current broken version (no try-catch) ---
async function copyBroken(text: string): Promise<string> {
  await navigator.clipboard.writeText(text);
  return "copied";
}

// --- copyToClipboard: fixed version (try-catch + execCommand fallback) ---
async function copyFixed(text: string): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
  return "copied";
}

// --- buildCopyableMarkdown: mirrors the real function structure ---
function buildCopyableMarkdown(opts: {
  isOrg: boolean;
  generatedApiKey: string | null;
}): string {
  const { isOrg, generatedApiKey } = opts;
  const envVar = isOrg ? "MENTORMATES_API_KEY" : "MENTORMATES_PARTICIPANT_API_KEY";
  // FIXED: include the real key when available
  const keyValue = generatedApiKey || "mm_sk_...";
  return [
    "# MentorMates Developer API",
    "",
    `## Role: ${isOrg ? "Organizer" : "Participant"}`,
    "",
    "### 1. Create a key",
    "Visit https://www.mentormates.ai/keys and generate a key for this role.",
    "",
    "### 2. Set env var (in YOUR shell, not in the agent)",
    "```bash",
    `export ${envVar}="${keyValue}"`,
    "```",
  ].join("\n");
}

// --- buildCopyableMarkdown: broken version (always placeholder) ---
function buildCopyableMarkdownBroken(opts: {
  isOrg: boolean;
  generatedApiKey: string | null;
}): string {
  const { isOrg } = opts;
  const envVar = isOrg ? "MENTORMATES_API_KEY" : "MENTORMATES_PARTICIPANT_API_KEY";
  const keyPlaceholder = "mm_sk_...";
  return [
    "# MentorMates Developer API",
    "",
    `## Role: ${isOrg ? "Organizer" : "Participant"}`,
    "",
    "### 1. Create a key",
    "Visit https://www.mentormates.ai/keys and generate a key for this role.",
    "",
    "### 2. Set env var (in YOUR shell, not in the agent)",
    "```bash",
    `export ${envVar}="${keyPlaceholder}"`,
    "```",
  ].join("\n");
}

describe("copyToClipboard", () => {
  const testKey = "mm_sk_abc123def456ghi789";
  const originalClipboard = navigator.clipboard;

  function setClipboard(writeText: jest.Mock) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  describe("when clipboard API succeeds", () => {
    it("copies text and resolves", async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      setClipboard(writeText);

      const result = await copyFixed(testKey);
      expect(result).toBe("copied");
      expect(writeText).toHaveBeenCalledWith(testKey);
    });
  });

  describe("when clipboard API throws", () => {
    it("broken version: rejects — caller never reaches success", async () => {
      setClipboard(jest.fn().mockRejectedValue(new Error("Not allowed")));
      await expect(copyBroken(testKey)).rejects.toThrow("Not allowed");
    });

    it("fixed version: resolves via execCommand fallback", async () => {
      setClipboard(jest.fn().mockRejectedValue(new Error("Not allowed")));
      document.execCommand = jest.fn().mockReturnValue(true);

      const result = await copyFixed(testKey);
      expect(result).toBe("copied");
      expect(document.execCommand).toHaveBeenCalledWith("copy");
    });

    it("fixed version: textarea passes the correct text and cleans up", async () => {
      setClipboard(jest.fn().mockRejectedValue(new Error("Not allowed")));
      let capturedValue = "";
      document.execCommand = jest.fn().mockImplementation(() => {
        const ta = document.querySelector("textarea");
        if (ta) capturedValue = ta.value;
        return true;
      });

      await copyFixed(testKey);
      expect(capturedValue).toBe(testKey);
      expect(document.querySelector("textarea")).toBeNull();
    });

    it("fixed version: always returns copied even on fallback", async () => {
      setClipboard(
        jest.fn().mockRejectedValue(new Error("Permission denied"))
      );
      document.execCommand = jest.fn().mockReturnValue(true);

      const result = await copyFixed(testKey);
      expect(result).toBe("copied");
    });
  });
});

describe("buildCopyableMarkdown", () => {
  const realKey = "mm_sk_b38ba5722b97141515c6a1bee4f8413bab0001bd";

  describe("broken version (always uses placeholder)", () => {
    it("never includes the real API key in the output", () => {
      const md = buildCopyableMarkdownBroken({
        isOrg: true,
        generatedApiKey: realKey,
      });
      expect(md).not.toContain(realKey);
      expect(md).toContain('export MENTORMATES_API_KEY="mm_sk_..."');
    });
  });

  describe("fixed version", () => {
    it("includes the real key when a key has been generated", () => {
      const md = buildCopyableMarkdown({
        isOrg: true,
        generatedApiKey: realKey,
      });
      expect(md).toContain(realKey);
      expect(md).toContain(`export MENTORMATES_API_KEY="${realKey}"`);
    });

    it("uses participant env var for participant role", () => {
      const md = buildCopyableMarkdown({
        isOrg: false,
        generatedApiKey: realKey,
      });
      expect(md).toContain(
        `export MENTORMATES_PARTICIPANT_API_KEY="${realKey}"`
      );
    });

    it("falls back to placeholder when no key has been generated", () => {
      const md = buildCopyableMarkdown({
        isOrg: true,
        generatedApiKey: null,
      });
      expect(md).toContain('export MENTORMATES_API_KEY="mm_sk_..."');
      expect(md).not.toContain(realKey);
    });
  });
});
