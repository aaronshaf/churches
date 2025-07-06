import type { Context } from 'hono';

// Wrapper for async route handlers to ensure errors are properly caught
export function asyncHandler<T = any>(handler: (c: Context) => Promise<T>): (c: Context) => Promise<T> {
  return async (c: Context) => {
    return await handler(c);
  };
}

// Helper to throw standardized errors
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public type: string = 'Application Error'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Common error factories
export const errors = {
  notFound: (resource: string = 'Resource'): AppError => new AppError(`${resource} not found`, 404, 'Not Found'),

  unauthorized: (message: string = 'Authentication required'): AppError => new AppError(message, 401, 'Authentication Error'),

  forbidden: (message: string = 'Access denied'): AppError => new AppError(message, 403, 'Permission Error'),

  validation: (message: string): AppError => new AppError(message, 400, 'Validation Error'),

  database: (message: string = 'Database operation failed'): AppError => new AppError(message, 500, 'Database Error'),

  network: (message: string = 'Network request failed'): AppError => new AppError(message, 500, 'Network Error'),
};
