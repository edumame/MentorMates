/**
 * @jest-environment jsdom
 */

// Test the copyToClipboard logic extracted from keys-page-client.tsx.
// We test the function directly (not the full page component) to avoid
// heavy server deps (Supabase, auth, events).

// --- Current broken version (no try-catch) ---
async function copyBroken(text: string): Promise<string> {
  await navigator.clipboard.writeText(text);
  return "copied";
}

// --- Fixed version (try-catch + execCommand fallback) ---
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
