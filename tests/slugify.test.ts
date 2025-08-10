import { describe, it, expect } from 'vitest';
import { slugify } from '../src/utils/slugify';

describe('slugify', () => {
  it('should convert text to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should replace spaces and special characters with hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Test 123')).toBe('test-123');
  });

  it('should remove leading and trailing hyphens', () => {
    expect(slugify('-Hello World-')).toBe('hello-world');
    expect(slugify('---Test---')).toBe('test');
  });

  it('should handle multiple consecutive special characters', () => {
    expect(slugify('Hello,,,World!!!')).toBe('hello-world');
    expect(slugify('Test...123???')).toBe('test-123');
  });

  it('should handle empty strings', () => {
    expect(slugify('')).toBe('');
  });

  it('should handle strings with only special characters', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('---')).toBe('');
  });
});