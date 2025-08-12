import path from 'path';
import { glob as globAsync, globSync as globSyncFn } from 'glob';
import { Config } from '../types/config';
import { LayoutTest } from '../types/test';

/**
 * Finds test files based on the testMatch patterns from the config.
 * @param config The configuration object.
 * @returns An array of file paths matching the test patterns.
 */
export async function discoverTests(config: Config): Promise<string[]> {
  // Resolve patterns relative to the current working directory
  const cwd = process.cwd();

  // Prefer using imported APIs so test mocks can hook into them.
  // Fall back to requiring for older environments.
  let globFn: ((pattern: string, options: any) => Promise<string[] | any> | string[] | any) | undefined = (globAsync as any);
  let globSync: ((pattern: string, options: any) => string[]) | undefined = (globSyncFn as any);
  let legacySync: ((pattern: string, options: any) => string[]) | undefined;
  let legacyFn: ((pattern: string, options: any, cb: (err: any, matches: string[]) => void) => any) | undefined;

  if (!globFn && !globSync) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const globModule: any = require('glob');
      globFn = typeof globModule?.glob === 'function' ? (globModule.glob as typeof globFn) : undefined;
      globSync = globModule.globSync as typeof globSync;
      legacySync = globModule.sync as typeof legacySync;
      legacyFn = typeof globModule === 'function' ? (globModule as typeof legacyFn) : undefined;
    } catch (error) {
      throw new Error('The "glob" package is required at runtime. Please ensure it is installed as a dependency.');
    }
  }

  const uniqueFiles = new Set<string>();

  for (const pattern of config.testMatch) {
    let matches: string[] = [];

    if (typeof globFn === 'function') {
      // Primary path: modern glob exposes an async function `glob`
      const result = await globFn(pattern, { cwd, absolute: true });
      if (Array.isArray(result)) {
        matches = result;
      } else if (result && typeof result === 'object') {
        // Some glob versions may return a Glob object; attempt to coerce to array if possible
        if (Array.isArray((result as any).matches)) {
          matches = (result as any).matches;
        } else {
          matches = [];
        }
      } else {
        matches = [];
      }
    } else if (typeof globSync === 'function') {
      // glob v8+ exposes globSync
      matches = globSync(pattern, { cwd, absolute: true }) || [];
    } else if (typeof legacySync === 'function') {
      // glob v7 exposes sync
      matches = legacySync(pattern, { cwd, absolute: true }) || [];
    } else if (typeof legacyFn === 'function') {
      // Very old API: wrap callback version into a promise, then await
      matches = await new Promise<string[]>((resolve, reject) => {
        legacyFn!(pattern, { cwd, absolute: true }, (err: any, files: string[]) => {
          if (err) return reject(err);
          resolve(files || []);
        });
      });
    } else {
      throw new Error('Unsupported "glob" module API.');
    }

    for (const filePath of matches) {
      // Convert to absolute paths if needed
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      uniqueFiles.add(absolutePath);
    }
  }

  return Array.from(uniqueFiles);
}