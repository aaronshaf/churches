import { describe, expect, test } from 'bun:test';
import { AppError, asyncHandler, errors } from './async-handler';

describe('asyncHandler', () => {
  test('returns wrapped handler result', async () => {
    const wrapped = asyncHandler(async () => 'ok');
    const result = await wrapped({} as any);

    expect(result).toBe('ok');
  });
});

describe('AppError', () => {
  test('sets name, statusCode, and type', () => {
    const error = new AppError('bad request', 400, 'Validation Error');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('bad request');
    expect(error.statusCode).toBe(400);
    expect(error.type).toBe('Validation Error');
  });
});

describe('errors factories', () => {
  test('notFound creates a 404 AppError', () => {
    const error = errors.notFound('Church');
    expect(error.message).toBe('Church not found');
    expect(error.statusCode).toBe(404);
    expect(error.type).toBe('Not Found');
  });

  test('unauthorized and forbidden create auth errors', () => {
    const unauthorized = errors.unauthorized();
    const forbidden = errors.forbidden();

    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.type).toBe('Authentication Error');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.type).toBe('Permission Error');
  });

  test('validation, database, and network create expected defaults', () => {
    const validation = errors.validation('invalid');
    const database = errors.database();
    const network = errors.network();

    expect(validation.statusCode).toBe(400);
    expect(validation.type).toBe('Validation Error');
    expect(database.message).toBe('Database operation failed');
    expect(database.statusCode).toBe(500);
    expect(database.type).toBe('Database Error');
    expect(network.message).toBe('Network request failed');
    expect(network.statusCode).toBe(500);
    expect(network.type).toBe('Network Error');
  });
});
