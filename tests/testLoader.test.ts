import { describe, it, expect } from 'vitest';
import path from 'path';
import { loadTest } from '../src/utils/testLoader';

describe('testLoader', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('should load and validate a valid test file', async () => {
    const testFilePath = path.join(fixturesDir, 'valid-test.spec.js');

    const test = await loadTest(testFilePath);

    expect(test).toEqual({
      name: 'Valid Test',
      scenario: expect.any(Function),
      selector: '.test-element',
    });
  });

  it('should load and validate a valid test file with CommonJS export', async () => {
    const testFilePath = path.join(fixturesDir, 'valid-test-commonjs.spec.js');

    const test = await loadTest(testFilePath);

    expect(test).toEqual({
      name: 'Valid Test CommonJS',
      scenario: expect.any(Function),
      selector: '.test-element',
    });
  });

  it('should throw an error if the test file does not export a valid object', async () => {
    const testFilePath = path.join(fixturesDir, 'invalid-test.spec.js');

    await expect(loadTest(testFilePath)).rejects.toThrow(
      `Test file ${testFilePath} does not export a valid object.`
    );
  });

  it('should throw an error if the test is missing a name', async () => {
    const testFilePath = path.join(fixturesDir, 'missing-name.spec.js');

    await expect(loadTest(testFilePath)).rejects.toThrow(
      `Test in ${testFilePath} is missing a valid 'name' property.`
    );
  });

  it('should throw an error if the test is missing a scenario function', async () => {
    const testFilePath = path.join(fixturesDir, 'missing-scenario.spec.js');

    await expect(loadTest(testFilePath)).rejects.toThrow(
      `Test 'Test Component' in ${testFilePath} is missing a valid 'scenario' function.`
    );
  });
});