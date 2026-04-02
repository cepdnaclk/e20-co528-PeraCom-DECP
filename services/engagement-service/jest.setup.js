jest.mock("uuid", () => ({
  v7: () => "mock-uuid-v7",
}));
