// next/jest is loaded by this CommonJS configuration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jsdom",
  // Browser journeys use Playwright; audit snapshots are historical bug reproductions, not regression tests.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/", "<rootDir>/audit-recovery/", "<rootDir>/audit-2026-11-06/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // shipcue only declares "import" exports, which Jest 29 does not resolve.
    "^shipcue$": "<rootDir>/node_modules/shipcue/dist/core/index.js",
    "^shipcue/(react|server)$": "<rootDir>/node_modules/shipcue/dist/$1/index.js",
  },
};

module.exports = createJestConfig(customJestConfig);
