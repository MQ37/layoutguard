import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { compareImages } from '../src/utils/imageComparison';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

// Mock pixelmatch module
vi.mock('pixelmatch', () => ({
  default: vi.fn(),
}));

describe('imageComparison', () => {
  it('should throw an error if one or both images do not exist', async () => {
    // Mock fs.existsSync to return false for both images
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return false;
    });

    await expect(
      compareImages('/path/to/image1.png', '/path/to/image2.png', '/path/to/diff.png')
    ).rejects.toThrow('One or both images do not exist');
  });

  it('should throw an error if images have different dimensions', async () => {
    // Mock fs.existsSync to return true for both images
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === '/path/to/image1.png' || path === '/path/to/image2.png';
    });
    
    // Mock PNG.sync.read to return images with different dimensions
    const mockPngRead = vi.spyOn(PNG.sync, 'read').mockImplementation((buffer) => {
      if (buffer === 'image1 content') {
        return { width: 100, height: 100, data: Buffer.alloc(100 * 100 * 4) };
      }
      if (buffer === 'image2 content') {
        return { width: 200, height: 200, data: Buffer.alloc(200 * 200 * 4) };
      }
      return { width: 0, height: 0, data: Buffer.alloc(0) };
    });
    
    // Mock fs.readFileSync to return different content for each image
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path === '/path/to/image1.png') {
        return 'image1 content';
      }
      if (path === '/path/to/image2.png') {
        return 'image2 content';
      }
      return '';
    });

    await expect(
      compareImages('/path/to/image1.png', '/path/to/image2.png', '/path/to/diff.png')
    ).rejects.toThrow('Images have different dimensions');
    
    // Restore the mock
    mockPngRead.mockRestore();
  });

  it('should compare images correctly and return mismatched pixels', async () => {
    // Mock fs.existsSync to return true for both images
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === '/path/to/image1.png' || path === '/path/to/image2.png';
    });
    
    // Mock PNG.sync.read to return images with the same dimensions
    const mockPngRead = vi.spyOn(PNG.sync, 'read').mockImplementation((buffer) => {
      return { width: 100, height: 100, data: Buffer.alloc(100 * 100 * 4) };
    });
    
    // Mock fs.readFileSync to return content for each image
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path === '/path/to/image1.png' || path === '/path/to/image2.png') {
        return 'image content';
      }
      return '';
    });
    
    // Mock pixelmatch to return a specific number of mismatched pixels
    vi.mocked(pixelmatch).mockReturnValue(100);
    
    // Mock PNG.sync.write to return a buffer
    const mockPngWrite = vi.spyOn(PNG.sync, 'write').mockReturnValue(Buffer.from('diff image content'));
    
    // Mock path.dirname to return a directory path
    vi.mock('path', async () => {
      const actual = await vi.importActual('path');
      return {
        ...actual,
        dirname: vi.fn().mockReturnValue('/path/to/diff/dir'),
      };
    });

    const result = await compareImages(
      '/path/to/image1.png',
      '/path/to/image2.png',
      '/path/to/diff.png',
      0.01
    );

    expect(result).toEqual({
      mismatchedPixels: 100,
      totalPixels: 10000,
    });
    
    // Verify that pixelmatch was called with the correct arguments
    expect(pixelmatch).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Buffer),
      expect.any(Object), // diff.data is an object
      100,
      100,
      { threshold: 0.01 }
    );
    
    // Verify that the diff image was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/diff.png',
      expect.any(Buffer)
    );
    
    // Restore the mocks
    mockPngRead.mockRestore();
    mockPngWrite.mockRestore();
  });
});