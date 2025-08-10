import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Compares two images and returns the number of mismatched pixels.
 * @param imagePath1 Path to the first image.
 * @param imagePath2 Path to the second image.
 * @param diffPath Path to save the diff image.
 * @param threshold Threshold for pixel difference (0 to 1).
 * @returns The number of mismatched pixels.
 */
export async function compareImages(
  imagePath1: string,
  imagePath2: string,
  diffPath: string,
  threshold: number = 0.01
): Promise<{ mismatchedPixels: number; totalPixels: number }> {
  // Check if both images exist
  if (!fs.existsSync(imagePath1) || !fs.existsSync(imagePath2)) {
    throw new Error('One or both images do not exist');
  }

  // Read the images
  const img1 = PNG.sync.read(fs.readFileSync(imagePath1));
  const img2 = PNG.sync.read(fs.readFileSync(imagePath2));

  // Check if images have the same dimensions
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error('Images have different dimensions');
  }

  // Create a diff image
  const diff = new PNG({ width: img1.width, height: img1.height });

  // Compare the images
  const mismatchedPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    img1.width,
    img1.height,
    { threshold }
  );

  // Save the diff image
  const diffDir = path.dirname(diffPath);
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    mismatchedPixels,
    totalPixels: img1.width * img1.height
  };
}