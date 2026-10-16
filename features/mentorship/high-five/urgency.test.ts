import {
  getWaveUrgency,
  getUrgencyLabel,
  URGENCY_THRESHOLDS,
} from "./urgency";

describe("getWaveUrgency", () => {
  it("returns calm for short waits", () => {
    expect(getWaveUrgency(0)).toBe("calm");
    expect(getWaveUrgency(URGENCY_THRESHOLDS.eager - 1)).toBe("calm");
  });

  it("returns eager after 15 seconds", () => {
    expect(getWaveUrgency(URGENCY_THRESHOLDS.eager)).toBe("eager");
    expect(getWaveUrgency(URGENCY_THRESHOLDS.frantic - 1)).toBe("eager");
  });

  it("returns frantic after 45 seconds", () => {
    expect(getWaveUrgency(URGENCY_THRESHOLDS.frantic)).toBe("frantic");
    expect(getWaveUrgency(URGENCY_THRESHOLDS.desperate - 1)).toBe("frantic");
  });

  it("returns desperate after 90 seconds", () => {
    expect(getWaveUrgency(URGENCY_THRESHOLDS.desperate)).toBe("desperate");
    expect(getWaveUrgency(300)).toBe("desperate");
  });
});

describe("getUrgencyLabel", () => {
  it("returns human-readable labels for each tier", () => {
    expect(getUrgencyLabel("calm")).toBe("Just raised");
    expect(getUrgencyLabel("eager")).toBe("Waiting…");
    expect(getUrgencyLabel("frantic")).toBe("Getting antsy");
    expect(getUrgencyLabel("desperate")).toBe("Helloooo??");
  });
});
