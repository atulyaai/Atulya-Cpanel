import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { stat, readdir, readFile, writeFile, mkdir, rmdir, unlink, chmod, chown } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: Date;
  created: Date;
  isReadable: boolean;
  isWritable: boolean;
  isExecutable: boolean;
}

export interface DirectoryInfo {
  path: string;
  files: FileInfo[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}

export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  content: string;
  match: string;
}

export class FileManagerProvider {
  private readonly allowedPaths: string[];
  private readonly maxFileSize: number = 100 * 1024 * 1024; // 100MB
  private readonly allowedExtensions: string[] = [
    '.txt', '.html', '.css', '.js', '.ts', '.json', '.xml', '.yaml', '.yml',
    '.php', '.py', '.rb', '.go', '.java', '.cpp', '.c', '.h', '.sql',
    '.md', '.log', '.conf', '.ini', '.env', '.htaccess', '.gitignore'
  ];

  constructor(allowedPaths: string[] = ['/var/www', '/home']) {
    this.allowedPaths = allowedPaths;
  }

  /**
   * Validate if a path is allowed
   */
  private validatePath(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    
    // Check if path is within allowed directories
    const isAllowed = this.allowedPaths.some(allowedPath => 
      normalizedPath.startsWith(path.resolve(allowedPath))
    );
    
    // Prevent directory traversal
    const hasTraversal = filePath.includes('..') || filePath.includes('~');
    
    return isAllowed && !hasTraversal;
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    if (!this.validatePath(filePath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const stats = await stat(filePath);
      const { uid, gid, mode } = stats;
      
      // Get owner and group names
      const [ownerResult, groupResult] = await Promise.all([
        execAsync(`id -nu ${uid}`).catch(() => ({ stdout: uid.toString() })),
        execAsync(`id -ng ${gid}`).catch(() => ({ stdout: gid.toString() }))
      ]);

      const permissions = this.formatPermissions(mode);
      const type = stats.isDirectory() ? 'directory' : 'file';

      return {
        name: path.basename(filePath),
        path: filePath,
        type,
        size: stats.size,
        permissions,
        owner: ownerResult.stdout.trim(),
        group: groupResult.stdout.trim(),
        modified: stats.mtime,
        created: stats.birthtime,
        isReadable: (mode & 0o444) !== 0,
        isWritable: (mode & 0o222) !== 0,
        isExecutable: (mode & 0o111) !== 0,
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string, showHidden: boolean = false): Promise<DirectoryInfo> {
    if (!this.validatePath(dirPath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const files: FileInfo[] = [];
      let totalSize = 0;
      let totalFiles = 0;
      let totalDirectories = 0;

      for (const entry of entries) {
        // Skip hidden files if not requested
        if (!showHidden && entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const fileInfo = await this.getFileInfo(fullPath);
        
        files.push(fileInfo);
        
        if (fileInfo.type === 'directory') {
          totalDirectories++;
        } else {
          totalFiles++;
          totalSize += fileInfo.size;
        }
      }

      // Sort directories first, then files
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        path: dirPath,
        files,
        totalFiles,
        totalDirectories,
        totalSize,
      };
    } catch (error) {
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    if (!this.validatePath(filePath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        throw new Error('Cannot read directory as file');
      }

      if (stats.size > this.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize} bytes)`);
      }

      // Check if file extension is allowed
      const ext = path.extname(filePath).toLowerCase();
      if (ext && !this.allowedExtensions.includes(ext)) {
        throw new Error(`File type not allowed: ${ext}`);
      }

      return await readFile(filePath, encoding);
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<FileOperationResult> {
    if (!this.validatePath(filePath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      // Check if file extension is allowed
      const ext = path.extname(filePath).toLowerCase();
      if (ext && !this.allowedExtensions.includes(ext)) {
        return {
          success: false,
          error: `File type not allowed: ${ext}`
        };
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.ensureDir(dir);

      await writeFile(filePath, content, encoding);
      
      return {
        success: true,
        message: 'File saved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string, permissions: string = '755'): Promise<FileOperationResult> {
    if (!this.validatePath(dirPath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      await mkdir(dirPath, { recursive: true });
      
      // Set permissions
      if (permissions) {
        await chmod(dirPath, parseInt(permissions, 8));
      }
      
      return {
        success: true,
        message: 'Directory created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete file or directory
   */
  async deletePath(filePath: string): Promise<FileOperationResult> {
    if (!this.validatePath(filePath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        // Additional safety check for directory deletion
        const entries = await readdir(filePath);
        if (entries.length > 0) {
          // Check if directory contains important files
          const importantFiles = ['.htaccess', 'index.html', 'index.php', 'wp-config.php'];
          const hasImportantFiles = entries.some(entry => importantFiles.includes(entry));
          
          if (hasImportantFiles) {
            return {
              success: false,
              error: 'Directory contains important files and cannot be deleted'
            };
          }
        }
        
        await rmdir(filePath, { recursive: true });
      } else {
        await unlink(filePath);
      }
      
      return {
        success: true,
        message: 'Deleted successfully'
      };
    } catch (error) {
      // More specific error handling
      if (error instanceof Error) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: 'File or directory not found'
          };
        } else if (error.code === 'EACCES') {
          return {
            success: false,
            error: 'Permission denied'
          };
        } else if (error.code === 'EBUSY') {
          return {
            success: false,
            error: 'File or directory is in use'
          };
        }
      }
      
      return {
        success: false,
        error: `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Rename file or directory
   */
  async renamePath(oldPath: string, newPath: string): Promise<FileOperationResult> {
    if (!this.validatePath(oldPath) || !this.validatePath(newPath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      await fs.move(oldPath, newPath);
      
      return {
        success: true,
        message: 'Renamed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Copy file or directory
   */
  async copyPath(sourcePath: string, destPath: string): Promise<FileOperationResult> {
    if (!this.validatePath(sourcePath) || !this.validatePath(destPath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      await fs.copy(sourcePath, destPath);
      
      return {
        success: true,
        message: 'Copied successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to copy: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Change file permissions
   */
  async changePermissions(filePath: string, permissions: string): Promise<FileOperationResult> {
    if (!this.validatePath(filePath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      await chmod(filePath, parseInt(permissions, 8));
      
      return {
        success: true,
        message: 'Permissions updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to change permissions: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Search for text in files
   */
  async searchInFiles(searchPath: string, query: string, extensions: string[] = []): Promise<SearchResult[]> {
    if (!this.validatePath(searchPath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const results: SearchResult[] = [];
      const regex = new RegExp(query, 'gi');
      
      await this.searchRecursive(searchPath, regex, extensions, results);
      
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recursive search helper
   */
  private async searchRecursive(
    dirPath: string, 
    regex: RegExp, 
    extensions: string[], 
    results: SearchResult[]
  ): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          await this.searchRecursive(fullPath, regex, extensions, results);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        
        // Check if extension is allowed
        if (extensions.length === 0 || extensions.includes(ext)) {
          if (this.allowedExtensions.includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf8');
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                const matches = line.match(regex);
                if (matches) {
                  matches.forEach(match => {
                    results.push({
                      path: fullPath,
                      line: index + 1,
                      column: line.indexOf(match) + 1,
                      content: line.trim(),
                      match: match
                    });
                  });
                }
              });
            } catch (error) {
              // Skip files that can't be read
              console.warn(`Skipping file ${fullPath}: ${error}`);
            }
          }
        }
      }
    }
  }

  /**
   * Compress files/directories
   */
  async compress(sourcePath: string, archivePath: string): Promise<FileOperationResult> {
    if (!this.validatePath(sourcePath) || !this.validatePath(archivePath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const ext = path.extname(archivePath).toLowerCase();
      let command: string;

      if (ext === '.zip') {
        command = `zip -r "${archivePath}" "${sourcePath}"`;
      } else if (ext === '.tar.gz' || ext === '.tgz') {
        command = `tar -czf "${archivePath}" "${sourcePath}"`;
      } else {
        return {
          success: false,
          error: 'Unsupported archive format'
        };
      }

      await execAsync(command);
      
      return {
        success: true,
        message: 'Compressed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to compress: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract archive
   */
  async extract(archivePath: string, destPath: string): Promise<FileOperationResult> {
    if (!this.validatePath(archivePath) || !this.validatePath(destPath)) {
      throw new Error('Access denied: Path not allowed');
    }

    try {
      const ext = path.extname(archivePath).toLowerCase();
      let command: string;

      if (ext === '.zip') {
        command = `unzip -o "${archivePath}" -d "${destPath}"`;
      } else if (ext === '.tar.gz' || ext === '.tgz') {
        command = `tar -xzf "${archivePath}" -C "${destPath}"`;
      } else {
        return {
          success: false,
          error: 'Unsupported archive format'
        };
      }

      await execAsync(command);
      
      return {
        success: true,
        message: 'Extracted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format file permissions
   */
  private formatPermissions(mode: number): string {
    const permissions = {
      owner: {
        read: !!(mode & 0o400),
        write: !!(mode & 0o200),
        execute: !!(mode & 0o100)
      },
      group: {
        read: !!(mode & 0o040),
        write: !!(mode & 0o020),
        execute: !!(mode & 0o010)
      },
      other: {
        read: !!(mode & 0o004),
        write: !!(mode & 0o002),
        execute: !!(mode & 0o001)
      }
    };

    const formatSection = (section: { read: boolean; write: boolean; execute: boolean }) => {
      return (section.read ? 'r' : '-') + (section.write ? 'w' : '-') + (section.execute ? 'x' : '-');
    };

    return formatSection(permissions.owner) + formatSection(permissions.group) + formatSection(permissions.other);
  }

  /**
   * Get file type based on extension
   */
  getFileType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    const typeMap: { [key: string]: string } = {
      '.txt': 'text',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.php': 'php',
      '.py': 'python',
      '.rb': 'ruby',
      '.go': 'go',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.sql': 'sql',
      '.log': 'log',
      '.conf': 'ini',
      '.ini': 'ini',
      '.env': 'properties',
      '.htaccess': 'apache',
      '.gitignore': 'gitignore'
    };

    return typeMap[ext] || 'text';
  }
}
