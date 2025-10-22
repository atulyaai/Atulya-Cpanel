import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { FileManagerService } from '../services/FileManagerService.js';
import { requireAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/security.js';

const listDirectorySchema = z.object({
  path: z.string().min(1),
  showHidden: z.boolean().optional().default(false),
});

const readFileSchema = z.object({
  path: z.string().min(1),
  encoding: z.string().optional().default('utf8'),
});

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.string().optional().default('utf8'),
});

const createDirectorySchema = z.object({
  path: z.string().min(1),
  permissions: z.string().optional().default('755'),
});

const deletePathSchema = z.object({
  path: z.string().min(1),
});

const renamePathSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
});

const copyPathSchema = z.object({
  sourcePath: z.string().min(1),
  destPath: z.string().min(1),
});

const changePermissionsSchema = z.object({
  path: z.string().min(1),
  permissions: z.string().min(3).max(3),
});

const searchSchema = z.object({
  path: z.string().min(1),
  query: z.string().min(1),
  extensions: z.array(z.string()).optional(),
});

const compressSchema = z.object({
  sourcePath: z.string().min(1),
  archivePath: z.string().min(1),
});

const extractSchema = z.object({
  archivePath: z.string().min(1),
  destPath: z.string().min(1),
});

export async function fileRoutes(fastify: FastifyInstance) {
  const fileManagerService = new FileManagerService();

  // Apply rate limiting to all file operations
  fastify.addHook('preHandler', apiRateLimit);

  // List directory contents
  fastify.get('/list', {
    preHandler: [requireAuth],
    schema: {
      querystring: listDirectorySchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path, showHidden } = request.query as z.infer<typeof listDirectorySchema>;
      
      const directoryInfo = await fileManagerService.listDirectory(authRequest.user, path, showHidden);
      
      return reply.send({
        success: true,
        data: directoryInfo,
      });
    } catch (error) {
      fastify.log.error('Failed to list directory:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list directory',
      });
    }
  });

  // Get file information
  fastify.get('/info', {
    preHandler: [requireAuth],
    schema: {
      querystring: z.object({
        path: z.string().min(1),
      }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path } = request.query as { path: string };
      
      const fileInfo = await fileManagerService.getFileInfo(authRequest.user, path);
      
      return reply.send({
        success: true,
        data: fileInfo,
      });
    } catch (error) {
      fastify.log.error('Failed to get file info:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file info',
      });
    }
  });

  // Read file content
  fastify.get('/read', {
    preHandler: [requireAuth],
    schema: {
      querystring: readFileSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path, encoding } = request.query as z.infer<typeof readFileSchema>;
      
      // Additional path validation
      if (path.includes('..') || path.includes('~') || path.startsWith('/')) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid file path',
        });
      }
      
      const content = await fileManagerService.readFile(authRequest.user, path, encoding as BufferEncoding);
      
      // Limit content size for response
      const maxContentSize = 1024 * 1024; // 1MB
      if (content.length > maxContentSize) {
        return reply.status(413).send({
          success: false,
          error: 'File too large to display',
        });
      }
      
      return reply.send({
        success: true,
        data: {
          path,
          content,
          encoding,
          size: content.length,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to read file:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      });
    }
  });

  // Write file content
  fastify.post('/write', {
    preHandler: [requireAuth],
    schema: {
      body: writeFileSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path, content, encoding } = request.body as z.infer<typeof writeFileSchema>;
      
      const result = await fileManagerService.writeFile(authRequest.user, path, content, encoding as BufferEncoding);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to write file:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file',
      });
    }
  });

  // Create directory
  fastify.post('/mkdir', {
    preHandler: [requireAuth],
    schema: {
      body: createDirectorySchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path, permissions } = request.body as z.infer<typeof createDirectorySchema>;
      
      const result = await fileManagerService.createDirectory(authRequest.user, path, permissions);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to create directory:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create directory',
      });
    }
  });

  // Delete file or directory
  fastify.delete('/delete', {
    preHandler: [requireAuth],
    schema: {
      body: deletePathSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path } = request.body as z.infer<typeof deletePathSchema>;
      
      const result = await fileManagerService.deletePath(authRequest.user, path);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to delete path:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete path',
      });
    }
  });

  // Rename file or directory
  fastify.put('/rename', {
    preHandler: [requireAuth],
    schema: {
      body: renamePathSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { oldPath, newPath } = request.body as z.infer<typeof renamePathSchema>;
      
      const result = await fileManagerService.renamePath(authRequest.user, oldPath, newPath);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to rename path:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename path',
      });
    }
  });

  // Copy file or directory
  fastify.post('/copy', {
    preHandler: [requireAuth],
    schema: {
      body: copyPathSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { sourcePath, destPath } = request.body as z.infer<typeof copyPathSchema>;
      
      const result = await fileManagerService.copyPath(authRequest.user, sourcePath, destPath);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to copy path:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy path',
      });
    }
  });

  // Change file permissions
  fastify.put('/chmod', {
    preHandler: [requireAuth],
    schema: {
      body: changePermissionsSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path, permissions } = request.body as z.infer<typeof changePermissionsSchema>;
      
      const result = await fileManagerService.changePermissions(authRequest.user, path, permissions);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to change permissions:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change permissions',
      });
    }
  });

  // Search for text in files
  fastify.get('/search', {
    preHandler: [requireAuth],
    schema: {
      querystring: searchSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { path, query, extensions } = request.query as z.infer<typeof searchSchema>;
      
      const results = await fileManagerService.searchInFiles(authRequest.user, path, query, extensions);
      
      return reply.send({
        success: true,
        data: {
          query,
          path,
          results,
          count: results.length,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to search files:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search files',
      });
    }
  });

  // Compress files/directories
  fastify.post('/compress', {
    preHandler: [requireAuth],
    schema: {
      body: compressSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { sourcePath, archivePath } = request.body as z.infer<typeof compressSchema>;
      
      const result = await fileManagerService.compress(authRequest.user, sourcePath, archivePath);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to compress:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compress',
      });
    }
  });

  // Extract archive
  fastify.post('/extract', {
    preHandler: [requireAuth],
    schema: {
      body: extractSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { archivePath, destPath } = request.body as z.infer<typeof extractSchema>;
      
      const result = await fileManagerService.extract(authRequest.user, archivePath, destPath);
      
      return reply.send({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      fastify.log.error('Failed to extract:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract',
      });
    }
  });

  // Upload files
  fastify.post('/upload', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      const destDir = data.fields.destDir?.value as string || '/tmp';
      const fileContent = await data.toBuffer();
      
      const uploadResult = await fileManagerService.uploadFiles(authRequest.user, destDir, [{
        name: data.filename,
        content: fileContent,
        size: fileContent.length,
      }]);

      return reply.send({
        success: uploadResult.success,
        message: uploadResult.message,
        error: uploadResult.error,
        data: uploadResult.files,
      });
    } catch (error) {
      fastify.log.error('Failed to upload file:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  });

  // Get user's accessible paths
  fastify.get('/paths', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const paths = await fileManagerService.getUserPaths(authRequest.user);
      
      return reply.send({
        success: true,
        data: paths,
      });
    } catch (error) {
      fastify.log.error('Failed to get user paths:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user paths',
      });
    }
  });

  // Get recent file operations
  fastify.get('/operations', {
    preHandler: [requireAuth],
    schema: {
      querystring: z.object({
        limit: z.coerce.number().min(1).max(100).optional().default(50),
      }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { limit } = request.query as { limit: number };
      
      const operations = await fileManagerService.getRecentOperations(authRequest.user, limit);
      
      return reply.send({
        success: true,
        data: operations,
      });
    } catch (error) {
      fastify.log.error('Failed to get recent operations:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent operations',
      });
    }
  });

  // Get file type for editor
  fastify.get('/type', {
    preHandler: [requireAuth],
    schema: {
      querystring: z.object({
        filename: z.string().min(1),
      }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { filename } = request.query as { filename: string };
      const fileType = fileManagerService.getFileType(filename);
      
      return reply.send({
        success: true,
        data: {
          filename,
          type: fileType,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get file type:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file type',
      });
    }
  });
}