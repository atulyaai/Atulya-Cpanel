import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  request.log.error(error);

  // Handle different error types
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: 'Validation error',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return reply.status(409).send({
          success: false,
          error: 'Resource already exists',
          details: 'A record with this information already exists',
        });
      case 'P2025':
        return reply.status(404).send({
          success: false,
          error: 'Resource not found',
          details: 'The requested resource does not exist',
        });
      case 'P2003':
        return reply.status(400).send({
          success: false,
          error: 'Foreign key constraint failed',
          details: 'Referenced resource does not exist',
        });
      default:
        return reply.status(500).send({
          success: false,
          error: 'Database error',
          details: 'An error occurred while accessing the database',
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return reply.status(400).send({
      success: false,
      error: 'Validation error',
      details: 'Invalid data provided',
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return reply.status(401).send({
      success: false,
      error: 'Invalid token',
      details: 'The provided token is invalid',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return reply.status(401).send({
      success: false,
      error: 'Token expired',
      details: 'The provided token has expired',
    });
  }

  // Handle file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return reply.status(413).send({
      success: false,
      error: 'File too large',
      details: 'The uploaded file exceeds the maximum allowed size',
    });
  }

  // Handle rate limiting errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: 'Rate limit exceeded',
      details: 'Too many requests from this IP address',
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  return reply.status(statusCode).send({
    success: false,
    error: message,
    details: statusCode === 500 ? 'An unexpected error occurred' : undefined,
  });
}
