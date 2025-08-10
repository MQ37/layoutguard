import path from 'path';
import { LayoutTest } from '../types/test';

/**
 * Loads and validates a test script.
 * @param filePath The path to the test file.
 * @returns The loaded test object.
 */
export async function loadTest(filePath: string): Promise<LayoutTest> {
  try {
    // Use require to load the test file
    // This works for both .js files in development and production
    const testModule = require(filePath);
    
    // Handle both ES modules (with default export) and CommonJS modules
    const test: LayoutTest = testModule.default || testModule;
    
    // Validate the test object
    if (!test || typeof test !== 'object') {
      throw new Error(`Test file ${filePath} does not export a valid object.`);
    }
    
    if (!test.name || typeof test.name !== 'string') {
      throw new Error(`Test in ${filePath} is missing a valid 'name' property.`);
    }
    
    if (!test.scenario || typeof test.scenario !== 'function') {
      throw new Error(`Test '${test.name}' in ${filePath} is missing a valid 'scenario' function.`);
    }
    
    // selector is optional, so no validation needed for it
    
    return test;
  } catch (error) {
    console.error(`Error loading test from ${filePath}:`, error);
    throw new Error(`Failed to load test from ${filePath}: ${error}`);
  }
}