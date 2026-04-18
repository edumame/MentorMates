import {
  extractJson,
  parseAIResponse,
  buildMessages,
  getSystemPrompt,
  SUBMISSION_PROMPT,
  JUDGING_PROMPT,
} from "./ai-chat";

describe("ai-chat", () => {
  describe("extractJson", () => {
    it("parses clean JSON", () => {
      expect(extractJson('{"reply":"ok","patch":null}')).toEqual({
        reply: "ok",
        patch: null,
      });
    });

    it("extracts JSON from markdown code fences", () => {
      const input = '```json\n{"reply":"done","patch":{"name":"test"}}\n```';
      const result = extractJson(input) as Record<string, unknown>;
      expect(result).toBeTruthy();
      expect(result.reply).toBe("done");
    });

    it("extracts JSON surrounded by text", () => {
      const input = 'Here is the result: {"reply":"hello","patch":null} end';
      const result = extractJson(input) as Record<string, unknown>;
      expect(result).toBeTruthy();
      expect(result.reply).toBe("hello");
    });

    it("returns null for invalid input", () => {
      expect(extractJson("not json at all")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractJson("")).toBeNull();
    });
  });

  describe("parseAIResponse", () => {
    it("parses a valid response with patch", () => {
      const raw = JSON.stringify({
        reply: "Added tech stack field!",
        patch: {
          submission_fields: [
            { id: "project_name", label: "Project name", type: "text", required: true, placeholder: "" },
            { id: "tech_stack", label: "Tech Stack", type: "text", required: false, placeholder: "React, Node..." },
          ],
        },
      });

      const result = parseAIResponse(raw);
      expect(result.reply).toBe("Added tech stack field!");
      expect(result.patch).toBeTruthy();
      expect((result.patch as Record<string, unknown>).submission_fields).toHaveLength(2);
    });

    it("parses a response with null patch", () => {
      const raw = JSON.stringify({
        reply: "I can help with that!",
        patch: null,
      });

      const result = parseAIResponse(raw);
      expect(result.reply).toBe("I can help with that!");
      expect(result.patch).toBeNull();
    });

    it("handles raw text when JSON parsing fails", () => {
      const result = parseAIResponse("Sorry, I don't understand.");
      expect(result.reply).toBe("Sorry, I don't understand.");
      expect(result.patch).toBeNull();
    });

    it("handles empty string", () => {
      const result = parseAIResponse("");
      expect(result.reply).toBe("Sorry, I couldn't process that.");
      expect(result.patch).toBeNull();
    });

    it("defaults reply to 'Done!' when missing", () => {
      const raw = JSON.stringify({ patch: { submission_fields: [] } });
      const result = parseAIResponse(raw);
      expect(result.reply).toBe("Done!");
    });

    it("ignores array patch values", () => {
      const raw = JSON.stringify({ reply: "ok", patch: ["not", "valid"] });
      const result = parseAIResponse(raw);
      expect(result.patch).toBeNull();
    });
  });

  describe("buildMessages", () => {
    it("includes system prompt, event state, history, and user message", () => {
      const event = { submission_fields: [] };
      const history = [{ role: "user" as const, text: "hi" }];
      const messages = buildMessages(event, history, "add a field", "submission");

      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("submission form");
      expect(messages[1].role).toBe("system");
      expect(messages[1].content).toContain("submission_fields");
      expect(messages[2]).toEqual({ role: "user", content: "hi" });
      expect(messages[3]).toEqual({ role: "user", content: "add a field" });
    });

    it("limits history to last 10 messages", () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        role: "user" as const,
        text: `msg ${i}`,
      }));

      const messages = buildMessages({}, history, "latest");
      // 2 system + 10 history + 1 user = 13
      expect(messages).toHaveLength(13);
      expect(messages[messages.length - 1].content).toBe("latest");
    });

    it("handles empty history", () => {
      const messages = buildMessages({}, [], "hello");
      expect(messages).toHaveLength(3); // 2 system + 1 user
    });
  });

  describe("getSystemPrompt", () => {
    it("returns submission prompt", () => {
      expect(getSystemPrompt("submission")).toBe(SUBMISSION_PROMPT);
    });
  });

  describe("JUDGING_PROMPT track ID format", () => {
    it("does NOT instruct the AI to generate track-<timestamp> IDs", () => {
      expect(JUDGING_PROMPT).not.toContain("track-<timestamp>");
    });

    it("instructs the AI to generate UUID-format track IDs or omit them", () => {
      // The prompt should either tell the AI to use crypto.randomUUID()-style IDs
      // or tell it to omit track_id entirely (let DB default handle it)
      const mentionsUuid = /uuid|randomUUID|gen_random_uuid|omit.*track_id|do not.*generate.*id/i.test(JUDGING_PROMPT);
      expect(mentionsUuid).toBe(true);
    });
  });

  describe("parseAIResponse with track patches", () => {
    it("parses a track patch with UUID track IDs", () => {
      const raw = JSON.stringify({
        reply: "Added Best Design track.",
        patch: {
          tracks: {
            "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
              name: "Best Design",
              criteria: [{ id: "crit-1", name: "UI/UX", weight: 1, min: 1, max: 10, type: "numeric" }],
            },
          },
        },
      });
      const result = parseAIResponse(raw);
      expect(result.reply).toBe("Added Best Design track.");
      expect(result.patch).toBeTruthy();
      expect(result.patch!.tracks).toBeTruthy();
    });
  });
});
