import { chromium, firefox, webkit, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../utils/configLoader';
import { discoverTests } from '../utils/testDiscovery';
import { loadTest } from '../utils/testLoader';
import { slugify } from '../utils/slugify';
import { compareImages } from '../utils/imageComparison';
import { LayoutTest } from '../types/test';

interface CheckOptions {
  showDiff?: boolean;
}

export const checkAction = async (testName?: string, options?: CheckOptions) => {
  console.log(`Running layout-guard check${testName ? ` for test: ${testName}` : ''}...`);
  
  let browser: Browser | null = null;
  let hasFailedTests = false;
  
  try {
    // Load configuration
    const config = await loadConfig();
    console.log('Loaded configuration');
    
    // Discover tests
    const testFiles = await discoverTests(config);
    console.log(`Discovered ${testFiles.length} test files`);
    
    // Filter tests by name if testName is provided
    let testsToRun: { filePath: string; test: LayoutTest }[] = [];
    if (testName) {
      // Find the specific test
      for (const filePath of testFiles) {
        try {
          const test = await loadTest(filePath);
          if (test.name === testName) {
            testsToRun = [{ filePath, test }];
            break;
          }
        } catch (error: any) {
          console.error(`Error loading test from ${filePath}:`, error.message);
        }
      }
      
      if (testsToRun.length === 0) {
        console.error(`Test '${testName}' not found.`);
        process.exit(1);
      }
    } else {
      // Load all tests
      for (const filePath of testFiles) {
        try {
          const test = await loadTest(filePath);
          testsToRun.push({ filePath, test });
        } catch (error: any) {
          console.error(`Error loading test from ${filePath}:`, error.message);
        }
      }
    }
    
    console.log(`Running ${testsToRun.length} tests`);
    
    // Launch browser based on config
    const browserName = config.playwright?.browserName || 'chromium';
    console.log(`Launching ${browserName} browser...`);
    
    switch (browserName) {
      case 'chromium':
        browser = await chromium.launch();
        break;
      case 'firefox':
        browser = await firefox.launch();
        break;
      case 'webkit':
        browser = await webkit.launch();
        break;
      default:
        throw new Error(`Unsupported browser: ${browserName}`);
    }
    
    // Create directories
    const snapshotDir = path.join(process.cwd(), '.layoutguard', 'snapshots');
    const failureDir = path.join(process.cwd(), '.layoutguard', 'failures');
    
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    if (!fs.existsSync(failureDir)) {
      fs.mkdirSync(failureDir, { recursive: true });
    }
    
    // Create a new page context for each test
    for (const { test } of testsToRun) {
      console.log(`Running test: ${test.name}`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        // Patch page.goto to handle relative URLs with the base URL
        const originalGoto = page.goto;
        page.goto = async (url: string, options?: Parameters<typeof originalGoto>[1]) => {
          // If the URL is relative, prepend the base URL
          let fullUrl = url;
          if (url.startsWith('/')) {
            // Remove trailing slash from base URL if present
            const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
            fullUrl = `${baseUrl}${url}`;
          }
          return originalGoto.call(page, fullUrl, options);
        };
        
        // Execute the test scenario
        await test.scenario(page);
        
        // Slugify the test name for the filename
        const slugifiedName = slugify(test.name);
        const newScreenshotPath = path.join(failureDir, slugifiedName, 'new.png');
        const originalScreenshotPath = path.join(snapshotDir, `${slugifiedName}.png`);
        const diffPath = path.join(failureDir, slugifiedName, 'diff.png');
        
        // Ensure failure directory for this test exists
        const testFailureDir = path.join(failureDir, slugifiedName);
        if (!fs.existsSync(testFailureDir)) {
          fs.mkdirSync(testFailureDir, { recursive: true });
        }
        
        // Take screenshot based on selector or full page
        if (test.selector) {
          const element = page.locator(test.selector);
          await element.screenshot({ path: newScreenshotPath });
        } else {
          await page.screenshot({ path: newScreenshotPath });
        }
        
        console.log(`New screenshot saved to ${newScreenshotPath}`);
        
        // Check if this is the first run (no original screenshot exists)
        if (!fs.existsSync(originalScreenshotPath)) {
          console.log(`No original screenshot found for '${test.name}'. This appears to be the first run.`);
          console.log(`Please run 'layout-guard approve "${test.name}"' to approve this screenshot as the baseline.`);
          hasFailedTests = true;
          continue;
        }
        
        // Save the original screenshot to the failure directory for comparison
        const originalInFailureDir = path.join(failureDir, slugifiedName, 'original.png');
        fs.copyFileSync(originalScreenshotPath, originalInFailureDir);
        
        // Compare screenshots
        const threshold = config.diffThreshold || 0.01;
        const { mismatchedPixels, totalPixels } = await compareImages(
          originalScreenshotPath,
          newScreenshotPath,
          diffPath,
          threshold
        );
        
        const mismatchRatio = mismatchedPixels / totalPixels;
        
        if (mismatchRatio > threshold) {
          console.log(`Test '${test.name}' failed. Mismatch ratio: ${mismatchRatio.toFixed(4)} (threshold: ${threshold})`);
          hasFailedTests = true;
          
          // Implement --show-diff option logic
          if (options?.showDiff) {
            try {
              const { default: open } = await import('open');
              await open(diffPath);
              console.log(`Opened diff image: ${diffPath}`);
            } catch (error: any) {
              console.error(`Failed to open diff image: ${error.message}`);
            }
          }
        } else {
          console.log(`Test '${test.name}' passed. Mismatch ratio: ${mismatchRatio.toFixed(4)} (threshold: ${threshold})`);
          
          // Clean up failure directory for this test if it passed
          fs.rmSync(testFailureDir, { recursive: true, force: true });
        }
        
        console.log(`Test '${test.name}' completed`);
      } catch (error: any) {
        console.error(`Error running test '${test.name}':`, error.message);
        hasFailedTests = true;
      } finally {
        await context.close();
      }
    }
    
    // Close the browser
    if (browser) {
      await browser.close();
    }
    
    // Implement exit code logic
    if (hasFailedTests) {
      console.log('Some tests failed.');
      process.exit(1);
    } else {
      console.log('All tests passed.');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('Error during check:', error.message);
    
    // Close the browser if it's still open
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
};