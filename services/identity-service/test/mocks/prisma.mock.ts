export const mockPrismaUserFindUnique = jest.fn();
export const mockPrismaUserFindMany = jest.fn();
export const mockPrismaUserCreate = jest.fn();
export const mockPrismaUserCreateMany = jest.fn();
export const mockPrismaUserUpdate = jest.fn();
export const mockPrismaUserUpdateMany = jest.fn();
export const mockPrismaUserDelete = jest.fn();

export const mockPrismaTransaction = jest.fn();

export const createMockPrismaService = () => ({
  user: {
    findUnique: mockPrismaUserFindUnique,
    findMany: mockPrismaUserFindMany,
    create: mockPrismaUserCreate,
    createMany: mockPrismaUserCreateMany,
    update: mockPrismaUserUpdate,
    updateMany: mockPrismaUserUpdateMany,
    delete: mockPrismaUserDelete,
  },
  socialLink: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  experience: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: mockPrismaTransaction,
});
