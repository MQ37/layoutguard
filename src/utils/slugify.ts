/**
 * Converts a string to a slug suitable for use as a filename.
 * @param text The text to slugify.
 * @returns The slugified text.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}