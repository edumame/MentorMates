import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SkillInstallPage from "./page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "event-1" }),
}));

const SKILL_PATH = ".claude/commands/mentormates.md";

const installResponse = (skillContent: string) => ({
  api_key: "mm_sk_test",
  event_name: "Test Event",
  skill_content: skillContent,
  setup_commands: { env_export: "", event_export: "", skill_save: "" },
});

async function copyInstallCommand(skillContent: string): Promise<string> {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => installResponse(skillContent),
  }) as unknown as typeof fetch;

  render(<SkillInstallPage />);
  fireEvent.click(
    screen.getByRole("button", { name: /generate install link/i })
  );

  const shownCommand = await screen.findByText(/mkdir -p \.claude\/commands/);
  const copyButton = shownCommand.parentElement?.querySelector("button");
  fireEvent.click(copyButton as HTMLButtonElement);
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

  const command = writeText.mock.calls[0][0] as string;
  expect(shownCommand.textContent).toBe(command);
  return command;
}

describe("SkillInstallPage copied install command", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "skill-install-"));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("does not call the session-only install route from the terminal", async () => {
    const command = await copyInstallCommand("skill body");

    expect(command).not.toContain("/api/agent/install");
    expect(command).not.toContain("curl");
  });

  it("writes the generated skill, including its key, into a fresh project", async () => {
    const skillContent = `---
name: mentormates
---

API Key: mm_sk_test
curl -H "Authorization: Bearer mm_sk_test" -d '{"a":"b"}' "$URL" | jq
\`\`\`bash
echo done
\`\`\`
`;
    const command = await copyInstallCommand(skillContent);

    execFileSync("sh", ["-c", command], { cwd: workDir });

    expect(readFileSync(join(workDir, SKILL_PATH), "utf8")).toBe(skillContent);
  });

  it("keeps shell syntax from an event name inert", async () => {
    const skillContent = `Manage "x'; touch pwned-quote; echo '" $(touch pwned-subst) \`touch pwned-tick\`\n`;
    const command = await copyInstallCommand(skillContent);

    execFileSync("sh", ["-c", command], { cwd: workDir });

    expect(readFileSync(join(workDir, SKILL_PATH), "utf8")).toBe(skillContent);
    expect(existsSync(join(workDir, "pwned-quote"))).toBe(false);
    expect(existsSync(join(workDir, "pwned-subst"))).toBe(false);
    expect(existsSync(join(workDir, "pwned-tick"))).toBe(false);
  });
});
