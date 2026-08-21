/**
 * @fileoverview Error handling utilities with correlation IDs.
 * @security NEVER exposes stack traces, file paths, or DB details to clients.
 * All sensitive error information is logged server-side only.
 */

import { nanoid } from 'nanoid';
import { ZodError } from 'zod';
import { sanitizeForLog } from '@/lib/security/sanitize';
import type { ApiErrorResponse } from '@/types';

/**
 * Application error with HTTP status code and correlation ID.
 * Use this for all known/expected error conditions.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly correlationId: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    correlationId?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.correlationId = correlationId ?? createCorrelationId();
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Creates a unique correlation ID for request tracing.
 * Enables log correlation without exposing internal state to clients.
 */
export function createCorrelationId(): string {
  return nanoid(21);
}

/**
 * Handles any error and returns a safe API response.
 * @security
 * - Known AppErrors: returns the error message (already safe)
 * - Zod validation errors: returns field-level errors for the client
 * - Unknown errors: returns GENERIC message, logs details server-side only
 * - NEVER returns stack traces, SQL queries, or file paths
 */
export function handleApiError(error: unknown): {
  status: number;
  body: ApiErrorResponse;
} {
  const correlationId = createCorrelationId();

  // Known application errors - safe to return message
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        success: false,
        error: error.message,
        correlationId: error.correlationId,
      },
    };
  }

  // Zod validation errors - return field-level details
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }

    return {
      status: 400,
      body: {
        success: false,
        error: 'Validation failed',
        correlationId,
        fieldErrors,
      },
    };
  }

  // Standard Error objects - log details, return generic message
  if (error instanceof Error) {
    // Log the real error server-side for debugging
    console.error(
      `[ERROR] correlationId=${correlationId} type=${error.name} message=${sanitizeForLog(error.message)}`
    );

    // Check for specific Prisma errors
    if (error.message.includes('Unique constraint')) {
      return {
        status: 409,
        body: {
          success: false,
          error: 'A record with this information already exists',
          correlationId,
        },
      };
    }

    if (error.message.includes('Record to update not found') ||
        error.message.includes('not found')) {
      return {
        status: 404,
        body: {
          success: false,
          error: 'Resource not found',
          correlationId,
        },
      };
    }
  }

  // Unknown errors - NEVER expose details
  console.error(
    `[ERROR] correlationId=${correlationId} type=UNKNOWN error=${sanitizeForLog(error)}`
  );

  return {
    status: 500,
    body: {
      success: false,
      error: 'An internal error occurred. Please try again later.',
      correlationId,
    },
  };
}

/**
 * Formats an error for server-side logging with PII redaction.
 */
export function formatErrorForLog(
  error: unknown,
  correlationId: string
): string {
  if (error instanceof Error) {
    return `[${correlationId}] ${error.name}: ${sanitizeForLog(error.message)}`;
  }
  return `[${correlationId}] UNKNOWN: ${sanitizeForLog(error)}`;
}
