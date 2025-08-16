import { chromium, firefox, webkit, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../utils/configLoader';
import { discoverTests } from '../utils/testDiscovery';
import { loadTest } from '../utils/testLoader';
import { slugify } from '../utils/slugify';
import { LayoutTest } from '../types/test';

interface ApproveOptions {}

export const approveAction = async (testArg?: string, options?: ApproveOptions) => {
  console.log(`Running layout-guard approve${testArg ? ` for: ${testArg}` : ''}...`);
  
  let browser: Browser | null = null;
  
  try {
    // Load configuration
    const config = await loadConfig();
    console.log('Loaded configuration');
    
  // Discover tests
  const testFiles = await discoverTests(config);
  console.log(`Discovered ${testFiles.length} test files`);
    
    // Filter tests by name or pick by file path
    let testsToRun: { filePath: string; test: LayoutTest }[] = [];
    if (testArg) {
      // If argument looks like a file path (absolute or relative path with separator or ends with .spec or .js/.ts), try to resolve it
      const looksLikePath = /[\/]/.test(testArg) || /\.(spec\.)?(js|ts|mjs|cjs)$/.test(testArg);
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
    
    // Ensure snapshots directory exists (approve writes baselines directly here)
    const snapshotDir = path.join(process.cwd(), '.layoutguard', 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
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
        const approvedScreenshotPath = path.join(snapshotDir, `${slugifiedName}.png`);
        
        // Take screenshot based on selector or full page (entire scrollable area) directly to snapshots
        if (test.selector) {
          const element = page.locator(test.selector);
          await element.screenshot({ path: approvedScreenshotPath });
        } else {
          await page.screenshot({ path: approvedScreenshotPath, fullPage: true });
        }
        
        console.log(`Baseline screenshot saved to ${approvedScreenshotPath}`);
        
        // Clean up any legacy failure directory for this test (from previous checks)
        const legacyFailureDir = path.join(process.cwd(), '.layoutguard', 'failures', slugifiedName);
        if (fs.existsSync(legacyFailureDir)) {
          fs.rmSync(legacyFailureDir, { recursive: true, force: true });
        }
        
        console.log(`Test '${test.name}' approved`);
      } catch (error: any) {
        console.error(`Error running test '${test.name}':`, error.message);
      } finally {
        await context.close();
      }
    }
    
    // Close the browser
    if (browser) {
      await browser.close();
    }
    
    console.log('Approve command executed successfully');
  } catch (error: any) {
    console.error('Error during approve:', error.message);
    
    // Close the browser if it's still open
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
};