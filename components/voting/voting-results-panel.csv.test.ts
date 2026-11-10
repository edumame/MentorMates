import { toSpreadsheetSafeCsv } from "@/lib/utils/csv";
import { buildVotingResultsCsvRows } from "./voting-results-panel";
import type { VotingResult } from "@/features/voting/hooks/use-voting-results";

jest.mock("@/features/voting/hooks/use-voting-results", () => ({ useVotingResults: jest.fn() }));

describe("voting results CSV (ORG-001)", () => {
  it("quotes and neutralises user-controlled cells", () => {
    const csv = toSpreadsheetSafeCsv(
      buildVotingResultsCsvRows([
        { projectName: '=HYPERLINK("http://x")\nhi', leadName: 'Ada "A", L', voteCount: 3 } as VotingResult,
      ])
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Rank,Project Name,Lead Name,Vote Count");
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")\nhi"`);
    expect(csv).toContain(`"Ada ""A"", L"`);
    expect(csv.endsWith(",3")).toBe(true);
  });
});
