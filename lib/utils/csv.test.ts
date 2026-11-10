import Papa from "papaparse";
import { toSpreadsheetSafeCsv } from "./csv";

describe("toSpreadsheetSafeCsv (ORG-001)", () => {
  it.each([
    ['=HYPERLINK("http://127.0.0.1/x","click")'],
    ["+SUM(1+1)"],
    ["-2+3"],
    ["@cmd|'/c calc'!A1"],
    ["\t=1+1"],
    ["\r=1+1"],
    ['=HYPERLINK("http://x")\nhi'],
    ["+1\r"],
    ["@SUM(1)\r\n2"],
    ["  =1+1"],
    ["\u00a0=1+1"],
    ["\n=1+1"],
  ])("neutralises the formula-like cell %p", (value) => {
    const csv = toSpreadsheetSafeCsv([{ Name: value }]);
    const parsed = Papa.parse<string[]>(csv).data;
    expect(parsed[1][0]).toBe("'" + value);
  });

  it("leaves ordinary text, numbers and quoting/escaping intact", () => {
    const csv = toSpreadsheetSafeCsv([
      { Name: 'Ada "The Countess", Lovelace', Score: 7.5, Delta: -2, Note: "line1\nline2" },
    ]);
    const parsed = Papa.parse<string[]>(csv).data;
    expect(parsed[0]).toEqual(["Name", "Score", "Delta", "Note"]);
    expect(parsed[1]).toEqual(['Ada "The Countess", Lovelace', "7.5", "-2", "line1\nline2"]);
  });

  it("supports array-of-arrays input", () => {
    expect(toSpreadsheetSafeCsv([["a", "=b"]])).toBe("a,'=b");
  });
});

describe("ORG-001 round 2", () => {
  it("escapes multi-line formula cells that papaparse's escapeFormulae misses", () => {
    const csv = toSpreadsheetSafeCsv([{ Description: '=HYPERLINK("http://x","click")\nmore text' }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""click"")\nmore text"`);
    expect(csv).not.toMatch(/(^|,)"=HYPERLINK/m);
  });

  it("leaves header names and non-string values alone", () => {
    const csv = toSpreadsheetSafeCsv([{ "-Score": -3, Ok: true, Empty: null }]);
    expect(csv.split("\r\n")).toEqual(["-Score,Ok,Empty", "-3,true,"]);
  });
});
