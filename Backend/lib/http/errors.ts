import { ZodError } from 'zod';
import { errorResponse } from './response';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'APP_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Invalid or missing authentication credentials') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to access this resource') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'A resource with this identifier already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class CatalogSizeLimitExceededError extends AppError {
  constructor(
    message: string = 'The restaurant menu catalog exceeds the supported size limit and cannot be safely displayed.',
    details?: unknown
  ) {
    super(message, 422, 'CATALOG_SIZE_LIMIT_EXCEEDED', details);
  }
}

export function handleApiError(error: unknown) {
  // Zod validation errors
  if (error instanceof ZodError) {
    const formatted = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return errorResponse('Validation failed', 400, 'VALIDATION_ERROR', formatted);
  }

  // Known application errors
  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode, error.code, error.details);
  }

  // Prisma unique constraint violation (code P2002)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[])?.join(', ') || 'field';
      return errorResponse(
        `An account with this ${target} already exists.`,
        409,
        'CONFLICT'
      );
    }
  }

  // JSON parsing error
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return errorResponse('Invalid JSON payload in request body', 400, 'MALFORMED_JSON');
  }

  // Generic fallback: never expose raw stack traces or internal details in responses
  console.error('[API_ERROR]', error);
  return errorResponse('An unexpected internal server error occurred', 500, 'INTERNAL_SERVER_ERROR');
}
