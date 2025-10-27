import { describe, it, expect } from 'vitest';
import { FastifyError } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { errorHandler } from './errorHandler';

describe('Error Handler', () => {
  const mockRequest = {
    log: {
      error: () => {},
    },
  } as any;

  const mockReply = {
    status: (code: number) => ({
      send: (data: any) => ({ statusCode: code, body: data }),
    }),
  } as any;

  it('should handle ZodError validation errors', async () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);

    const result = await errorHandler(zodError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Validation error');
    expect(result.body.details).toHaveLength(1);
    expect(result.body.details[0].field).toBe('email');
  });

  it('should handle Prisma unique constraint errors', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      }
    );

    const result = await errorHandler(prismaError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(409);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Resource already exists');
  });

  it('should handle Prisma record not found errors', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '5.0.0',
      }
    );

    const result = await errorHandler(prismaError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(404);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Resource not found');
  });

  it('should handle JWT errors', async () => {
    const jwtError = new Error('Invalid token');
    jwtError.name = 'JsonWebTokenError';

    const result = await errorHandler(jwtError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(401);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Invalid token');
  });

  it('should handle token expired errors', async () => {
    const tokenError = new Error('Token expired');
    tokenError.name = 'TokenExpiredError';

    const result = await errorHandler(tokenError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(401);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Token expired');
  });

  it('should handle file size limit errors', async () => {
    const fileError = new Error('File too large');
    (fileError as any).code = 'LIMIT_FILE_SIZE';

    const result = await errorHandler(fileError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(413);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('File too large');
  });

  it('should handle rate limiting errors', async () => {
    const rateLimitError = new Error('Too many requests');
    (rateLimitError as any).statusCode = 429;

    const result = await errorHandler(rateLimitError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(429);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Rate limit exceeded');
  });

  it('should handle generic errors', async () => {
    const genericError = new Error('Something went wrong');
    (genericError as any).statusCode = 500;

    const result = await errorHandler(genericError, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(500);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Internal server error');
  });

  it('should handle errors without status code', async () => {
    const error = new Error('Unknown error');

    const result = await errorHandler(error, mockRequest, mockReply);
    
    expect(result.statusCode).toBe(500);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe('Internal server error');
  });
});