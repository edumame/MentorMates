const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // shipcue only declares "import" exports, which Jest 29 does not resolve.
    "^shipcue$": "<rootDir>/node_modules/shipcue/dist/core/index.js",
    "^shipcue/(react|server)$": "<rootDir>/node_modules/shipcue/dist/$1/index.js",
  },
};

module.exports = createJestConfig(customJestConfig);
