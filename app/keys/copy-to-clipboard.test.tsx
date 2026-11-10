/**
 * @jest-environment jsdom
 */

// The copyToClipboard tests exercise a local copy of the logic from
// keys-page-client.tsx. The generated key tests render the real component.

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import KeysPageClient from "./keys-page-client";

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

describe("KeysPageClient generated key handling", () => {
  const realKey = "mm_sk_b38ba5722b97141515c6a1bee4f8413bab0001bd";
  const managedEvents = [{ id: "event-1", name: "Hack Day", eventDate: null }];
  const originalClipboard = navigator.clipboard;
  const originalFetch = global.fetch;
  let writeText: jest.Mock;

  function renderPage() {
    return render(
      <KeysPageClient
        initialKeys={[]}
        managedEventOptions={managedEvents}
        participantEventOptions={[]}
      />
    );
  }

  async function createKey() {
    fireEvent.click(screen.getByRole("button", { name: "Create Key" }));
    await screen.findByText("Key created");
  }

  function switchTab(name: "Participant" | "Organizer") {
    fireEvent.click(screen.getByRole("button", { name }));
  }

  async function copyPage(): Promise<string> {
    writeText.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Copy page" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    // Flush the "Copied" state update before the next interaction.
    await screen.findByRole("button", { name: "Copied" });
    return writeText.mock.calls[0][0] as string;
  }

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        api_key: realKey,
        message: "Key created",
        key: {
          id: "key-1",
          event_id: null,
          prefix: "mm_sk_b38b",
          label: null,
          scopes: ["event:read"],
          created_at: "2026-01-01T00:00:00.000Z",
        },
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    global.fetch = originalFetch;
  });

  describe("Copy page", () => {
    it("uses the placeholder when no key has been generated", async () => {
      renderPage();

      const md = await copyPage();
      expect(md).toContain('export MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..."');
    });

    it("never embeds a generated key, matching its 'omitted' notice", async () => {
      renderPage();
      switchTab("Organizer");
      await createKey();

      const md = await copyPage();
      expect(md).not.toContain(realKey);
      expect(md).toContain('export MENTORMATES_API_KEY="mm_sk_..."');
      expect(md).toContain("The key itself is intentionally omitted here.");
    });

    it("does not embed the generated key after switching tabs", async () => {
      renderPage();
      switchTab("Organizer");
      await createKey();
      switchTab("Participant");

      const md = await copyPage();
      expect(md).not.toContain(realKey);
      expect(md).toContain('export MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..."');
    });
  });

  describe("on-screen key", () => {
    it("shows the key under the env var of the tab that created it", async () => {
      const { container } = renderPage();
      switchTab("Organizer");
      await createKey();

      expect(container).toHaveTextContent(
        `export MENTORMATES_API_KEY="${realKey}"`
      );
      expect(
        screen.getByText(/Your newly generated key is filled in above/)
      ).toBeInTheDocument();
    });

    it("hides an organizer key on the participant tab", async () => {
      const { container } = renderPage();
      switchTab("Organizer");
      await createKey();
      switchTab("Participant");

      expect(container).not.toHaveTextContent(realKey);
      expect(container).toHaveTextContent(
        'export MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..."'
      );
      expect(screen.queryByText("Key created")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Your newly generated key is filled in above/)
      ).not.toBeInTheDocument();
    });

    it("hides a participant key on the organizer tab", async () => {
      const { container } = renderPage();
      await createKey();
      switchTab("Organizer");

      expect(container).not.toHaveTextContent(realKey);
      expect(container).toHaveTextContent(
        'export MENTORMATES_API_KEY="mm_sk_..."'
      );
    });

    it("keeps the one-time key available on return to its own tab", async () => {
      const { container } = renderPage();
      switchTab("Organizer");
      await createKey();
      switchTab("Participant");
      switchTab("Organizer");

      expect(container).toHaveTextContent(
        `export MENTORMATES_API_KEY="${realKey}"`
      );
      expect(screen.getByText("Key created")).toBeInTheDocument();
    });

    it("attributes the key to the tab it was requested from, even if the tab changes mid-request", async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      const response = await (global.fetch as jest.Mock)();
      (global.fetch as jest.Mock).mockClear();
      (global.fetch as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { container } = renderPage();
      switchTab("Organizer");
      fireEvent.click(screen.getByRole("button", { name: "Create Key" }));
      switchTab("Participant");
      await act(async () => {
        resolveFetch(response);
      });

      expect(container).not.toHaveTextContent(realKey);
      switchTab("Organizer");
      expect(container).toHaveTextContent(
        `export MENTORMATES_API_KEY="${realKey}"`
      );
    });
  });
});
