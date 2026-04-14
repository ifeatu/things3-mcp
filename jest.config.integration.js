// ABOUTME: Jest configuration for integration tests with Things3
// ABOUTME: Handles ES modules and longer timeouts for AppleScript operations

export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/tests/integration/**/*.test.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol)/)'
  ],
  // Longer timeout for AppleScript operations (Things3 can be slow, especially
  // for bulk/project/tag writes; 120 s matches the AppleScriptBridge limit).
  testTimeout: 120000,
  // Prevent the process from hanging after all tests complete
  forceExit: true,
  // Run tests serially to avoid conflicts with Things3
  maxWorkers: 1,
  // Verbose output for integration tests
  verbose: true,
  // Don't collect coverage for integration tests
  collectCoverage: false,
  // Setup file for integration tests
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
};