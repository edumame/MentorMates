// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSDOMEnvironment = require("jest-environment-jsdom").default;

/**
 * Runs a test file in a non-UTC timezone, so local-vs-UTC date bugs still fail
 * on UTC machines such as CI. Opt in with this docblock at the top of a test:
 *
 *   @jest-environment ./lib/test-utils/los-angeles-timezone-environment.cjs
 *
 * Setting process.env.TZ inside a test has no effect because Jest gives tests a
 * copy of process.env. The environment runs outside that sandbox, so it can
 * change the real value, and teardown restores it for --runInBand.
 */
class LosAngelesTimezoneEnvironment extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);
    this.originalTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
  }

  async teardown() {
    if (this.originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = this.originalTimezone;
    }
    await super.teardown();
  }
}

module.exports = LosAngelesTimezoneEnvironment;
