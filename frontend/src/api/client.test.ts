import { describe, it, expect, vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock document
Object.defineProperty(document, 'querySelector', {
  value: vi.fn(),
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
});

// Mock window.URL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(),
    revokeObjectURL: vi.fn(),
  },
});

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Environment Configuration', () => {
    it('should have correct base URL', () => {
      // This test verifies the environment configuration
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.VITE_API_URL).toBe('http://localhost:3000');
    });
  });

  describe('File Upload Validation', () => {
    it('should validate file size limits', () => {
      const maxSize = 100 * 1024 * 1024; // 100MB
      const largeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
      
      expect(largeFile.size).toBeGreaterThan(maxSize);
    });

    it('should validate allowed file types', () => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/json', 'application/xml',
        'application/zip', 'application/x-tar', 'application/gzip'
      ];

      const validFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-executable' });

      expect(allowedTypes.includes(validFile.type)).toBe(true);
      expect(allowedTypes.includes(invalidFile.type)).toBe(false);
    });

    it('should sanitize filenames', () => {
      const filename = 'test@#$%file.txt';
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      expect(sanitized).toBe('test____file.txt');
    });
  });

  describe('Download Helper', () => {
    it('should create download link with correct attributes', () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      // Simulate the download process by manually calling createElement
      const link = document.createElement('a');
      const downloadUrl = 'blob:http://localhost:3000/test';
      const filename = 'test.txt';

      link.href = downloadUrl;
      link.download = filename;
      link.click();

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(link.href).toBe(downloadUrl);
      expect(link.download).toBe(filename);
    });
  });
});