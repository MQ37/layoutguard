// src/types/config.ts

import type { Page } from 'playwright';

export interface Config {
  /** A glob pattern to find test files. */
  testMatch: string[];

  /** The base URL to prepend to navigation actions (e.g., page.goto('/dashboard')). */
  baseUrl: string;

  /** Playwright options, e.g., which browser to use. */
  playwright?: {
    browserName?: 'chromium' | 'firefox' | 'webkit';
  };

  /** Threshold for pixel difference (0 to 1). 0 means zero tolerance. */
  diffThreshold?: number;
}