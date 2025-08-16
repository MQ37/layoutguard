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

export const checkAction = async (testArg?: string, options?: CheckOptions) => {
  console.log(`Running layout-guard check${testArg ? ` for: ${testArg}` : ''}...`);
  
  let browser: Browser | null = null;
  let hasFailedTests = false;
  let passedCount = 0;
  let failedCount = 0;
  const failedTests: string[] = [];
  const symbols = { pass: '✅', fail: '❌', info: 'ℹ️' } as const;
  
  try {
    // Load configuration
    const config = await loadConfig();
    console.log(`${symbols.info} Loaded configuration`);
    
    // Discover tests
    const testFiles = await discoverTests(config);
  console.log(`${symbols.info} Discovered ${testFiles.length} test file(s)`);
    
    // Filter tests by name or pick by file path
    let testsToRun: { filePath: string; test: LayoutTest }[] = [];
    if (testArg) {
      // If argument looks like a file path (absolute or relative path with separator or ends with .spec or .js/.ts), try to resolve it
      const looksLikePath = /[\\/]/.test(testArg) || /\.(spec\.)?(js|ts|mjs|cjs)$/.test(testArg);
      if (looksLikePath) {
        const absPath = path.isAbsolute(testArg) ? testArg : path.join(process.cwd(), testArg);
        if (!fs.existsSync(absPath)) {
          console.error(`Test file not found: ${absPath}`);
          process.exit(1);
        }
        try {
          const test = await loadTest(absPath);
          testsToRun = [{ filePath: absPath, test }];
        } catch (error: any) {
          console.error(`Error loading test from ${absPath}:`, error.message);
          process.exit(1);
        }
      } else {
        // Treat as test name; find matching test among discovered files
        for (const filePath of testFiles) {
          try {
            const test = await loadTest(filePath);
            if (test.name === testArg) {
              testsToRun = [{ filePath, test }];
              break;
            }
          } catch (error: any) {
            console.error(`Error loading test from ${filePath}:`, error.message);
          }
        }
        if (testsToRun.length === 0) {
          console.error(`Test '${testArg}' not found.`);
          process.exit(1);
        }
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
    
  console.log(`${symbols.info} Running ${testsToRun.length} test(s)`);
    
    // Launch browser based on config
    const browserName = config.playwright?.browserName || 'chromium';
  console.log(`${symbols.info} Launching ${browserName} browser...`);
    
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
  console.log(`→ Running: ${test.name}`);
      
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
        
  console.log(`${symbols.info} New screenshot saved to ${newScreenshotPath}`);
        
        // Check if this is the first run (no original screenshot exists)
        if (!fs.existsSync(originalScreenshotPath)) {
          console.log(`${symbols.fail} No baseline found for '${test.name}' (first run).`);
          console.log(`   Run: layoutguard approve "${test.name}" to set the baseline.`);
          hasFailedTests = true;
          failedCount += 1;
          failedTests.push(test.name);
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
          console.log(`${symbols.fail} '${test.name}' failed — mismatch: ${mismatchRatio.toFixed(4)} (threshold: ${threshold})`);
          hasFailedTests = true;
          failedCount += 1;
          failedTests.push(test.name);
          
          // Implement --show-diff option logic
          if (options?.showDiff) {
            try {
              const { default: open } = await import('open');
              await open(diffPath);
              console.log(`${symbols.info} Opened diff image: ${diffPath}`);
            } catch (error: any) {
              console.error(`Failed to open diff image: ${error.message}`);
            }
          }
        } else {
          console.log(`${symbols.pass} '${test.name}' passed — mismatch: ${mismatchRatio.toFixed(4)} (threshold: ${threshold})`);
          passedCount += 1;
          
          // Clean up failure directory for this test if it passed
          fs.rmSync(testFailureDir, { recursive: true, force: true });
        }
        
        console.log(`   Completed: ${test.name}`);
      } catch (error: any) {
        console.error(`Error running test '${test.name}':`, error.message);
        hasFailedTests = true;
        failedCount += 1;
        failedTests.push(test.name);
      } finally {
        await context.close();
      }
    }
    
    // Close the browser
    if (browser) {
      await browser.close();
    }
    
    // Summary
    const total = passedCount + failedCount || testsToRun.length;
    console.log('');
    console.log('Summary');
    console.log('-------');
    console.log(`${symbols.pass} Passed: ${passedCount}`);
    console.log(`${symbols.fail} Failed: ${failedCount}`);
    console.log(`${symbols.info} Total:  ${total}`);
    if (failedCount > 0 && failedTests.length > 0) {
      console.log('');
      console.log('Failed tests:');
      for (const name of failedTests) {
        console.log(`  ${symbols.fail} ${name}`);
      }
    }

    // Implement exit code logic
    if (hasFailedTests) {
      process.exit(1);
    } else {
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