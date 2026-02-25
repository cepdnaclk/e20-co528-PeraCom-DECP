export const mockRedisSet = jest.fn().mockResolvedValue(undefined);
export const mockRedisGet = jest.fn().mockResolvedValue(null);
export const mockRedisDel = jest.fn().mockResolvedValue(1);

export const createMockRedisClient = () => ({
  set: mockRedisSet,
  get: mockRedisGet,
  del: mockRedisDel,
});

export const createMockRedisService = () => ({
  getClient: jest.fn().mockReturnValue(createMockRedisClient()),
});
