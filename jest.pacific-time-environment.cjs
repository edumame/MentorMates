// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest loads environments as CommonJS.
const { TestEnvironment } = require("jest-environment-jsdom");

/**
 * jsdom environment pinned to a negative UTC offset for timezone regressions.
 * Assigning process.env.TZ inside a test has no effect because Jest sandboxes
 * process.env, and CI runs in UTC where these off-by-one bugs cannot appear.
 * Opt in with: @jest-environment ./jest.pacific-time-environment.cjs
 */
class PacificTimeEnvironment extends TestEnvironment {
  async setup() {
    this.previousTimeZone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    await super.setup();
  }

  async teardown() {
    await super.teardown();
    if (this.previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = this.previousTimeZone;
    }
  }
}

module.exports = PacificTimeEnvironment;
