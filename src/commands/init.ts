import fs from 'fs';
import path from 'path';

export const initAction = async () => {
  console.log('Initializing layoutguard...');

  // 1. Create .layoutguard directory
  const layoutGuardDir = path.join(process.cwd(), '.layoutguard');
  if (!fs.existsSync(layoutGuardDir)) {
    fs.mkdirSync(layoutGuardDir);
    console.log('  Created .layoutguard directory');
  }

  // 2. Create snapshots and failures subdirectories
  const snapshotsDir = path.join(layoutGuardDir, 'snapshots');
  const failuresDir = path.join(layoutGuardDir, 'failures');

  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir);
    console.log('  Created .layoutguard/snapshots directory');
  }

  if (!fs.existsSync(failuresDir)) {
    fs.mkdirSync(failuresDir);
    console.log('  Created .layoutguard/failures directory');
  }

  // 3. Create default layoutguard.config.json
  const configPath = path.join(process.cwd(), 'layoutguard.config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      testMatch: ['examples/**/*.spec.js'],
      baseUrl: 'http://localhost:3000',
      playwright: {
        browserName: 'chromium',
      },
      diffThreshold: 0.01,
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('  Created layoutguard.config.json');
  }

  // 4. Create examples directory and example test
  const examplesDir = path.join(process.cwd(), 'examples');
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir);
    console.log('  Created examples directory');

    const exampleTestPath = path.join(examplesDir, 'example.spec.js');
    if (!fs.existsSync(exampleTestPath)) {
      const exampleTest = `const test = {
  name: 'Example Test',
  scenario: async (page) => {
    await page.goto('/');
    // Add your test steps here
  },
  selector: 'body', // Optional: specify an element to capture
};

module.exports = test;
`;
      fs.writeFileSync(exampleTestPath, exampleTest);
      console.log('  Created examples/example.spec.js');
    }
  }

  console.log('Initialization complete!');
  console.log('Please review and update layoutguard.config.json as needed.');
  console.log('');
  console.log('To use Playwright browsers, run one of the following commands:');
  console.log('  npx playwright install chromium  # For Chromium/Chrome');
  console.log('  npx playwright install firefox   # For Firefox');
  console.log('  npx playwright install webkit    # For Safari');
  console.log('');
  console.log('You can also install specific versions or channels, e.g.:');
  console.log('  npx playwright install chromium@beta');
};