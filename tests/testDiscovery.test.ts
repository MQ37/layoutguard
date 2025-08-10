import { describe, it, expect, vi } from 'vitest';
import { glob } from 'glob';
import { discoverTests } from '../src/utils/testDiscovery';
import { Config } from '../src/types/config';

// Mock glob module
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

describe('testDiscovery', () => {
  it('should discover test files based on config patterns', async () => {
    const config: Config = {
      testMatch: ['src/**/*.spec.js', 'tests/**/*.test.js'],
      baseUrl: 'http://localhost:3000',
      playwright: {
        browserName: 'chromium',
      },
      diffThreshold: 0.01,
    };

    // Mock glob to return specific file paths
    vi.mocked(glob).mockImplementation(async (pattern) => {
      if (pattern === 'src/**/*.spec.js') {
        return ['/path/to/project/src/component1.spec.js', '/path/to/project/src/component2.spec.js'];
      }
      if (pattern === 'tests/**/*.test.js') {
        return ['/path/to/project/tests/test1.test.js'];
      }
      return [];
    });

    const testFiles = await discoverTests(config);

    expect(testFiles).toEqual([
      '/path/to/project/src/component1.spec.js',
      '/path/to/project/src/component2.spec.js',
      '/path/to/project/tests/test1.test.js',
    ]);
    
    // Verify glob was called with the correct patterns
    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenCalledWith('src/**/*.spec.js', { cwd: process.cwd(), absolute: true });
    expect(glob).toHaveBeenCalledWith('tests/**/*.test.js', { cwd: process.cwd(), absolute: true });
  });

  it('should remove duplicate file paths', async () => {
    const config: Config = {
      testMatch: ['src/**/*.spec.js', 'tests/**/*.spec.js'],
      baseUrl: 'http://localhost:3000',
      playwright: {
        browserName: 'chromium',
      },
      diffThreshold: 0.01,
    };

    // Mock glob to return overlapping file paths
    vi.mocked(glob).mockImplementation(async (pattern) => {
      if (pattern === 'src/**/*.spec.js') {
        return ['/path/to/project/src/component.spec.js'];
      }
      if (pattern === 'tests/**/*.spec.js') {
        return ['/path/to/project/src/component.spec.js']; // Same file
      }
      return [];
    });

    const testFiles = await discoverTests(config);

    // Should only contain unique file paths
    expect(testFiles).toEqual(['/path/to/project/src/component.spec.js']);
  });
});