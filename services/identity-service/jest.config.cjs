/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.spec.json",
        useESM: false,
      },
    ],
  },
  testMatch: ["**/*.spec.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts", "!src/**/index.ts"],
  coverageDirectory: "coverage",
  setupFilesAfterEnv: ["<rootDir>/test/jest-setup.cjs"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
