import type { Connection, ClientSession, Model } from "mongoose";
import { Types } from "mongoose";

/**
 * Creates a mock Mongoose session for transaction tests.
 */
export function createMockSession(): jest.Mocked<ClientSession> {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  } as unknown as jest.Mocked<ClientSession>;
  return session;
}

/**
 * Creates a mock Mongoose Connection that returns a mock session.
 */
export function createMockConnection(
  session: jest.Mocked<ClientSession>,
): jest.Mocked<Pick<Connection, "startSession">> {
  return {
    startSession: jest.fn().mockResolvedValue(session),
  } as unknown as jest.Mocked<Pick<Connection, "startSession">>;
}

/**
 * Creates a chainable mock for Mongoose Model methods (find, findById, etc.)
 */
export function createChainableMock(resolveValue: unknown) {
  const chain = {
    session: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolveValue),
  };
  return chain;
}

/**
 * Creates a mock Prometheus Counter.
 */
export function createMockCounter() {
  return {
    inc: jest.fn(),
  } as unknown as { inc: jest.Mock };
}

/**
 * Creates a mock PinoLogger.
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as { info: jest.Mock; error: jest.Mock; warn: jest.Mock };
}

/**
 * Generates a valid MongoDB ObjectId string.
 */
export function createObjectId(): string {
  return new Types.ObjectId().toString();
}
