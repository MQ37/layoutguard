import path from 'path';
import fs from 'fs';
import { Config } from '../types/config';

/**
 * Loads and parses the layout-guard.config.json file.
 * @returns The loaded configuration object.
 */
export async function loadConfig(): Promise<Config> {
  const configPath = path.join(process.cwd(), 'layout-guard.config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      'layout-guard.config.json not found. Please run `layout-guard init` first.'
    );
  }

  try {
    // Read and parse the JSON config file
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const userConfig: Config = JSON.parse(configContent);

    // Define default configuration values
    const defaultConfig: Config = {
      testMatch: ['**/*.spec.js'],
      baseUrl: 'http://localhost:3000',
      playwright: {
        browserName: 'chromium',
      },
      diffThreshold: 0.01,
    };

    // Start with default config
    const mergedConfig: Config = { ...defaultConfig };

    // Override with user config
    if (userConfig) {
      mergedConfig.testMatch = userConfig.testMatch || defaultConfig.testMatch;
      mergedConfig.baseUrl = userConfig.baseUrl || defaultConfig.baseUrl;
      mergedConfig.diffThreshold = userConfig.diffThreshold !== undefined ? userConfig.diffThreshold : defaultConfig.diffThreshold;

      // Handle playwright config
      const userPlaywright = userConfig.playwright || {};
      mergedConfig.playwright = {
        ...defaultConfig.playwright,
        ...userPlaywright
      };
    }

    return mergedConfig;
  } catch (error) {
    console.error('Error loading configuration:', error);
    throw new Error('Failed to load layout-guard.config.json');
  }
}