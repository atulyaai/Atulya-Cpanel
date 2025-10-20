import { FileManagerProvider, FileInfo, DirectoryInfo, FileOperationResult, SearchResult } from '../providers/FileManagerProvider.js';
import { prisma } from '../server.js';
import type { User } from '@prisma/client';

export interface FileManagerOptions {
  allowedPaths?: string[];
  maxFileSize?: number;
}

export interface UploadResult {
  success: boolean;
  message?: string;
  error?: string;
  files?: Array<{
    name: string;
    size: number;
    path: string;
  }>;
}

export class FileManagerService {
  private provider: FileManagerProvider;

  constructor(options: FileManagerOptions = {}) {
    this.provider = new FileManagerProvider(options.allowedPaths);
  }

  /**
   * Get directory contents
   */
  async listDirectory(user: User, dirPath: string, showHidden: boolean = false): Promise<DirectoryInfo> {
    try {
      // Validate user access to path
      await this.validateUserAccess(user, dirPath);
      
      const directoryInfo = await this.provider.listDirectory(dirPath, showHidden);
      
      // Log the operation
      await this.logOperation(user, 'list_directory', dirPath, {
        showHidden,
        fileCount: directoryInfo.totalFiles,
        dirCount: directoryInfo.totalDirectories
      });

      return directoryInfo;
    } catch (error) {
      console.error('Failed to list directory:', error);
      throw error;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(user: User, filePath: string): Promise<FileInfo> {
    try {
      await this.validateUserAccess(user, filePath);
      
      const fileInfo = await this.provider.getFileInfo(filePath);
      
      await this.logOperation(user, 'get_file_info', filePath, {
        fileType: fileInfo.type,
        size: fileInfo.size
      });

      return fileInfo;
    } catch (error) {
      console.error('Failed to get file info:', error);
      throw error;
    }
  }

  /**
   * Read file content
   */
  async readFile(user: User, filePath: string, encoding?: BufferEncoding): Promise<string> {
    try {
      await this.validateUserAccess(user, filePath);
      
      const content = await this.provider.readFile(filePath, encoding);
      
      await this.logOperation(user, 'read_file', filePath, {
        size: content.length,
        encoding: encoding || 'utf8'
      });

      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  }

  /**
   * Write file content
   */
  async writeFile(user: User, filePath: string, content: string, encoding?: BufferEncoding): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, filePath);
      
      const result = await this.provider.writeFile(filePath, content, encoding);
      
      if (result.success) {
        await this.logOperation(user, 'write_file', filePath, {
          size: content.length,
          encoding: encoding || 'utf8'
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to write file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file'
      };
    }
  }

  /**
   * Create directory
   */
  async createDirectory(user: User, dirPath: string, permissions?: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, dirPath);
      
      const result = await this.provider.createDirectory(dirPath, permissions);
      
      if (result.success) {
        await this.logOperation(user, 'create_directory', dirPath, {
          permissions: permissions || '755'
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to create directory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create directory'
      };
    }
  }

  /**
   * Delete file or directory
   */
  async deletePath(user: User, filePath: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, filePath);
      
      const result = await this.provider.deletePath(filePath);
      
      if (result.success) {
        await this.logOperation(user, 'delete_path', filePath, {});
      }

      return result;
    } catch (error) {
      console.error('Failed to delete path:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete path'
      };
    }
  }

  /**
   * Rename file or directory
   */
  async renamePath(user: User, oldPath: string, newPath: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, oldPath);
      await this.validateUserAccess(user, newPath);
      
      const result = await this.provider.renamePath(oldPath, newPath);
      
      if (result.success) {
        await this.logOperation(user, 'rename_path', oldPath, {
          newPath
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to rename path:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename path'
      };
    }
  }

  /**
   * Copy file or directory
   */
  async copyPath(user: User, sourcePath: string, destPath: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, sourcePath);
      await this.validateUserAccess(user, destPath);
      
      const result = await this.provider.copyPath(sourcePath, destPath);
      
      if (result.success) {
        await this.logOperation(user, 'copy_path', sourcePath, {
          destPath
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to copy path:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy path'
      };
    }
  }

  /**
   * Change file permissions
   */
  async changePermissions(user: User, filePath: string, permissions: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, filePath);
      
      const result = await this.provider.changePermissions(filePath, permissions);
      
      if (result.success) {
        await this.logOperation(user, 'change_permissions', filePath, {
          permissions
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to change permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change permissions'
      };
    }
  }

  /**
   * Search for text in files
   */
  async searchInFiles(user: User, searchPath: string, query: string, extensions?: string[]): Promise<SearchResult[]> {
    try {
      await this.validateUserAccess(user, searchPath);
      
      const results = await this.provider.searchInFiles(searchPath, query, extensions);
      
      await this.logOperation(user, 'search_files', searchPath, {
        query,
        extensions: extensions || [],
        resultCount: results.length
      });

      return results;
    } catch (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
  }

  /**
   * Compress files/directories
   */
  async compress(user: User, sourcePath: string, archivePath: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, sourcePath);
      await this.validateUserAccess(user, archivePath);
      
      const result = await this.provider.compress(sourcePath, archivePath);
      
      if (result.success) {
        await this.logOperation(user, 'compress', sourcePath, {
          archivePath
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to compress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compress'
      };
    }
  }

  /**
   * Extract archive
   */
  async extract(user: User, archivePath: string, destPath: string): Promise<FileOperationResult> {
    try {
      await this.validateUserAccess(user, archivePath);
      await this.validateUserAccess(user, destPath);
      
      const result = await this.provider.extract(archivePath, destPath);
      
      if (result.success) {
        await this.logOperation(user, 'extract', archivePath, {
          destPath
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to extract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract'
      };
    }
  }

  /**
   * Upload files
   */
  async uploadFiles(user: User, destDir: string, files: Array<{
    name: string;
    content: Buffer;
    size: number;
  }>): Promise<UploadResult> {
    try {
      await this.validateUserAccess(user, destDir);
      
      const uploadedFiles: Array<{ name: string; size: number; path: string }> = [];
      
      for (const file of files) {
        const filePath = `${destDir}/${file.name}`;
        
        // Check file size
        if (file.size > 100 * 1024 * 1024) { // 100MB limit
          return {
            success: false,
            error: `File ${file.name} is too large (${file.size} bytes)`
          };
        }

        // Check file extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && !['txt', 'html', 'css', 'js', 'json', 'xml', 'md', 'log', 'conf', 'ini'].includes(ext)) {
          return {
            success: false,
            error: `File type .${ext} not allowed`
          };
        }

        await this.provider.writeFile(filePath, file.content.toString('utf8'));
        uploadedFiles.push({
          name: file.name,
          size: file.size,
          path: filePath
        });
      }

      await this.logOperation(user, 'upload_files', destDir, {
        fileCount: files.length,
        files: uploadedFiles.map(f => f.name)
      });

      return {
        success: true,
        message: `${files.length} files uploaded successfully`,
        files: uploadedFiles
      };
    } catch (error) {
      console.error('Failed to upload files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload files'
      };
    }
  }

  /**
   * Get file type for editor
   */
  getFileType(fileName: string): string {
    return this.provider.getFileType(fileName);
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    return this.provider.formatFileSize(bytes);
  }

  /**
   * Validate user access to path
   */
  private async validateUserAccess(user: User, filePath: string): Promise<void> {
    // For now, all authenticated users can access all allowed paths
    // In a production system, you would implement more granular permissions
    // based on user roles, site ownership, etc.
    
    if (user.role === 'ADMIN') {
      return; // Admins have full access
    }

    // Regular users can only access their own sites
    const sites = await prisma.site.findMany({
      where: { userId: user.id },
      select: { domain: true, documentRoot: true }
    });

    const allowedPaths = sites.map(site => site.documentRoot);
    const isAllowed = allowedPaths.some(path => filePath.startsWith(path));

    if (!isAllowed) {
      throw new Error('Access denied: You do not have permission to access this path');
    }
  }

  /**
   * Log file operation
   */
  private async logOperation(
    user: User, 
    action: string, 
    resource: string, 
    details: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action,
          resource: 'file_manager',
          resourceId: resource,
          details: details,
          ipAddress: null, // Would be passed from request
          userAgent: null, // Would be passed from request
        }
      });
    } catch (error) {
      console.error('Failed to log file operation:', error);
    }
  }

  /**
   * Get user's accessible paths
   */
  async getUserPaths(user: User): Promise<string[]> {
    if (user.role === 'ADMIN') {
      return ['/var/www', '/home', '/tmp'];
    }

    const sites = await prisma.site.findMany({
      where: { userId: user.id },
      select: { documentRoot: true }
    });

    return sites.map(site => site.documentRoot);
  }

  /**
   * Get recent file operations
   */
  async getRecentOperations(user: User, limit: number = 50): Promise<any[]> {
    try {
      const operations = await prisma.auditLog.findMany({
        where: {
          userId: user.id,
          resource: 'file_manager'
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        select: {
          id: true,
          action: true,
          resourceId: true,
          details: true,
          createdAt: true
        }
      });

      return operations;
    } catch (error) {
      console.error('Failed to get recent operations:', error);
      return [];
    }
  }
}
