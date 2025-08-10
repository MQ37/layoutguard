# LayoutGuard

LayoutGuard is a command-line interface (CLI) tool designed to automate visual regression testing for web applications. It uses Playwright to drive a browser, execute user-defined scenarios, take screenshots, and compare them against previously approved "golden" snapshots.

## Features

- **Scenario-based Testing**: Define test scenarios in simple TypeScript files.
- **Centralized Snapshot Management**: Manage all artifacts in a root `.layoutguard` directory.
- **Interactive Approval Workflow**: Review and approve new or changed snapshots.
- **CI/CD Integration**: Exits with a non-zero status code if visual differences are detected.
- **Flexible Targeting**: Specify which element to capture in a screenshot.
- **Immediate Diff Viewing**: Automatically open a visual diff image when a test fails.

## Installation

```bash
npm install -g layoutguard
```

Or use it directly with npx:

```bash
npx layoutguard init
```

After initializing, you'll need to install the Playwright browsers you want to use:

```bash
npx playwright install chromium  # For Chromium/Chrome
npx playwright install firefox   # For Firefox
npx playwright install webkit    # For Safari
```

You can also install specific versions or channels:

```bash
npx playwright install chromium@beta
```

## Usage

### Initialize a new project

```bash
layoutguard init
```

This command sets up the necessary configuration and directory structure:

- Creates a `layoutguard.config.json` file
- Creates a `.layoutguard` directory with `snapshots` and `failures` subdirectories
- Creates an `examples` directory with an example test file

After running `init`, you'll need to install the Playwright browsers you want to use:

```bash
npx playwright install chromium  # For Chromium/Chrome
npx playwright install firefox   # For Firefox
npx playwright install webkit    # For Safari
```

### Configuration

The `layoutguard.config.json` file allows you to customize behavior:

```json
{
  "testMatch": ["**/*.spec.ts"],
  "baseUrl": "http://localhost:3000",
  "playwright": {
    "browserName": "chromium"
  },
  "diffThreshold": 0.01
}
```

- `testMatch`: A glob pattern to find test files.
- `baseUrl`: The base URL to prepend to navigation actions.
- `playwright.browserName`: Which browser to use (chromium, firefox, or webkit).
- `diffThreshold`: Threshold for pixel difference (0 to 1). 0 means zero tolerance.

### Writing Tests

Test scenarios are defined in `.spec.ts` files. Each file exports a default object that conforms to the `LayoutTest` interface:

```typescript
import { Page } from 'playwright';
import type { LayoutTest } from 'layoutguard';

const test: LayoutTest = {
  name: 'Dashboard Add Form Popup',
  scenario: async (page: Page) => {
    await page.goto('/dashboard');
    await page.click('#add-new-item-button');
    await page.waitForSelector('.add-item-popup', { state: 'visible' });
    await page.waitForTimeout(500); // Wait for CSS transitions
  },
  selector: '.add-item-popup', // Optional: specify an element to capture
};

export default test;
```

- `name`: A unique, descriptive name for the test. This is used for the snapshot filename.
- `scenario`: The sequence of actions to perform before taking the screenshot.
- `selector`: Optional. A CSS selector for the element to capture. If omitted, the full page is captured.

### Running Tests

```bash
layoutguard check [test-name]
```

This command executes visual regression tests:

- If `[test-name]` is omitted, layoutguard will run all tests found.
- Use the `--show-diff` option to automatically open the visual diff image if a test fails.

### Approving Snapshots

```bash
layoutguard approve [test-name]
```

This command runs the specified test(s) and replaces the existing golden snapshots with the newly generated ones:

- If `[test-name]` is omitted, it will update snapshots for all found tests.

## Directory Structure

```
my-awesome-project/
├── .layoutguard/
│   ├── snapshots/
│   │   ├── dashboard-add-form-popup.png  // Golden snapshot
│   │   └── another-test.png
│   └── failures/
│       └── dashboard-add-form-popup/
│           ├── new.png       // The latest screenshot
│           ├── original.png  // The golden snapshot it was compared against
│           └── diff.png      // A visual diff of the two
├── node_modules/
├── src/
│   └── components/
│       └── dashboard/
│           ├── Dashboard.tsx
│           └── dashboard.spec.ts  // Test file co-located with component
├── layoutguard.config.json
├── package.json
└── tsconfig.json
```

## License

MIT