import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { loadConfig } from '../src/utils/configLoader';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe('configLoader', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset any modules that might have been imported
    vi.resetModules();
  });

  it('should throw an error if config file does not exist', async () => {
    // Mock fs.existsSync to return false
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(loadConfig()).rejects.toThrow(
      'layout-guard.config.json not found. Please run `layout-guard init` first.'
    );
  });

  it('should load and merge configuration correctly', async () => {
    // Mock fs.existsSync to return true
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Mock fs.readFileSync to return JSON content
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        testMatch: ['src/**/*.test.js'],
        baseUrl: 'https://example.com',
        playwright: {
          browserName: 'firefox',
        },
        diffThreshold: 0.05,
      })
    );

    const config = await loadConfig();

    expect(config).toEqual({
      testMatch: ['src/**/*.test.js'],
      baseUrl: 'https://example.com',
      playwright: {
        browserName: 'firefox',
      },
      diffThreshold: 0.05,
    });
  });

  it('should use default values when not provided in user config', async () => {
    // Mock fs.existsSync to return true
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Mock fs.readFileSync to return partial JSON content
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        baseUrl: 'https://example.com',
        // Missing testMatch, playwright, and diffThreshold
      })
    );

    const config = await loadConfig();

    expect(config).toEqual({
      testMatch: ['**/*.spec.js'], // Default value
      baseUrl: 'https://example.com',
      playwright: {
        browserName: 'chromium', // Default value
      },
      diffThreshold: 0.01, // Default value
    });
  });
});