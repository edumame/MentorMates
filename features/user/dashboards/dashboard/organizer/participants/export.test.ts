import Papa from "papaparse";
import {
  buildEmailTeamMap,
  buildParticipantsCsv,
  type ExportableParticipant,
  type TeamProjectRow,
} from "./export";

describe("buildEmailTeamMap", () => {
  it("maps lead and teammate emails to the project name", () => {
    const projects: TeamProjectRow[] = [
      {
        project_name: "CarePulse",
        lead_email: "lead@example.com",
        teammates: ["mate1@example.com", "mate2@example.com"],
      },
    ];

    const map = buildEmailTeamMap(projects);

    expect(map.get("lead@example.com")).toBe("CarePulse");
    expect(map.get("mate1@example.com")).toBe("CarePulse");
    expect(map.get("mate2@example.com")).toBe("CarePulse");
  });

  it("normalizes email case and whitespace", () => {
    const projects: TeamProjectRow[] = [
      {
        project_name: "  SLECare  ",
        lead_email: " Lead@Example.COM ",
        teammates: null,
      },
    ];

    const map = buildEmailTeamMap(projects);

    expect(map.get("lead@example.com")).toBe("SLECare");
  });

  it("skips rows without a project name and keeps the first team on conflicts", () => {
    const projects: TeamProjectRow[] = [
      { project_name: null, lead_email: "draft@example.com", teammates: null },
      {
        project_name: "First Team",
        lead_email: "shared@example.com",
        teammates: [],
      },
      {
        project_name: "Second Team",
        lead_email: "shared@example.com",
        teammates: ["only-second@example.com"],
      },
    ];

    const map = buildEmailTeamMap(projects);

    expect(map.has("draft@example.com")).toBe(false);
    expect(map.get("shared@example.com")).toBe("First Team");
    expect(map.get("only-second@example.com")).toBe("Second Team");
  });

  it("ignores empty teammate entries", () => {
    const projects: TeamProjectRow[] = [
      {
        project_name: "Team",
        lead_email: null,
        teammates: ["", "  ", "real@example.com"],
      },
    ];

    const map = buildEmailTeamMap(projects);

    expect(map.size).toBe(1);
    expect(map.get("real@example.com")).toBe("Team");
  });
});

describe("buildParticipantsCsv", () => {
  const participants: ExportableParticipant[] = [
    {
      display_name: "Hannah Leo",
      email: "unganleo@example.com",
      role: "participant",
      affiliation: "Universiti Malaysia Sarawak",
    },
    {
      display_name: "No Team",
      email: "solo@example.com",
      role: "mentor",
      affiliation: null,
    },
  ];

  it("includes Name, Email, Role, Team Name, and University columns", () => {
    const teamMap = new Map([["unganleo@example.com", "CarePulse"]]);

    const csv = buildParticipantsCsv(participants, teamMap);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.meta.fields).toEqual([
      "Name",
      "Email",
      "Role",
      "Team Name",
      "University",
    ]);
    expect(parsed.data[0]).toEqual({
      Name: "Hannah Leo",
      Email: "unganleo@example.com",
      Role: "participant",
      "Team Name": "CarePulse",
      University: "Universiti Malaysia Sarawak",
    });
  });

  it("falls back to empty strings for missing team and university", () => {
    const csv = buildParticipantsCsv(participants, new Map());
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[1]).toEqual({
      Name: "No Team",
      Email: "solo@example.com",
      Role: "mentor",
      "Team Name": "",
      University: "",
    });
  });

  it("prefers the formal team assignment over the project email match", () => {
    const teamMap = new Map([["unganleo@example.com", "Project Fallback"]]);
    const csv = buildParticipantsCsv(
      [{ ...participants[0], team_name: "CarePulse" }],
      teamMap
    );
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0]?.["Team Name"]).toBe("CarePulse");
  });

  it("falls back to the project email match when team_name is blank", () => {
    const teamMap = new Map([["unganleo@example.com", "Project Fallback"]]);
    const csv = buildParticipantsCsv(
      [{ ...participants[0], team_name: "  " }],
      teamMap
    );
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0]?.["Team Name"]).toBe("Project Fallback");
  });

  it("matches participants to teams case-insensitively", () => {
    const teamMap = new Map([["solo@example.com", "Solo Squad"]]);
    const csv = buildParticipantsCsv(
      [{ ...participants[1], email: " Solo@Example.com " }],
      teamMap
    );
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0]?.["Team Name"]).toBe("Solo Squad");
  });
});
