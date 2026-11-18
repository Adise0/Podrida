module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: {
    "^.+\.ts$": [
      "ts-jest",
      { tsconfig: { module: "commonjs", moduleResolution: "node", esModuleInterop: true } },
    ],
  },
  testTimeout: 60000,
};
