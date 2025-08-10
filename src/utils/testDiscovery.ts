import path from 'path';
import { glob } from 'glob';
import { Config } from '../types/config';
import { LayoutTest } from '../types/test';

/**
 * Finds test files based on the testMatch patterns from the config.
 * @param config The configuration object.
 * @returns An array of file paths matching the test patterns.
 */
export async function discoverTests(config: Config): Promise<string[]> {
  const testFiles: string[] = [];
  
  // Resolve patterns relative to the current working directory
  const cwd = process.cwd();
  
  for (const pattern of config.testMatch) {
    const files = await glob(pattern, { cwd, absolute: true });
    testFiles.push(...files);
  }
  
  // Remove duplicates
  return [...new Set(testFiles)];
}