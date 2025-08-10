// src/types/test.ts

import type { Page } from 'playwright';

export interface LayoutTest {
  /** A unique, descriptive name for the test. This is used for the snapshot filename. */
  name: string;

  /** The sequence of actions to perform before taking the screenshot. */
  scenario: (page: Page) => Promise<void>;

  /** Optional. A CSS selector for the element to capture. If omitted, the full page is captured. */
  selector?: string;
}