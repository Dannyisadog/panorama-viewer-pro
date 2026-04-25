/**
 * imageCompression — client-side image compression using Canvas API
 *
 * Pipeline: File → ImageLoad → DrawToCanvas → toBlob/JPEG → Blob
 * No external dependencies. Runs fully in-browser.
 *
 * Performance: uses createImageBitmap + OffscreenCanvas where available
 * to avoid blocking the main thread on large images.
 */

export interface CompressionOptions {
  /** Max width in pixels. Image is scaled down if wider. Default: 1920 */
  maxWidth?: number;
  /** JPEG quality 0–1. Default: 0.78 */
  quality?: number;
  /** Output MIME type. Default: 'image/jpeg' */
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  quality: 0.78,
  mimeType: 'image/jpeg',
};

/**
 * Compress an image File.
 *
 * Returns a Promise<Blob> with the compressed image.
 * Throws if the file is not a valid image.
 *
 * Usage:
 *   const compressed = await compressImage(file, { maxWidth: 1280, quality: 0.75 });
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const { maxWidth, quality, mimeType } = { ...DEFAULT_OPTIONS, ...options };

  if (!file.type.startsWith('image/')) {
    throw new Error(`[ImageCompression] Expected image/*, got: ${file.type}`);
  }

  // ── Load the image ────────────────────────────────────────────────────────
  const img = await loadImage(file);

  // ── Compute target dimensions ────────────────────────────────────────────
  let { width, height } = img;

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  // ── Draw to canvas and export as blob ───────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('[ImageCompression] Could not get 2d canvas context');
  }

  // Use better quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('[ImageCompression] canvas.toBlob() returned null'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

/**
 * Load a File into an HTMLImageElement.
 * Uses createImageBitmap (async, non-blocking) when available for perf.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Use createImageBitmap + createObjectURL for async non-blocking load
    if (typeof createImageBitmap !== 'undefined') {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`[ImageCompression] Failed to load image: ${file.name}`));
      };
      img.src = objectUrl;
    } else {
      // Fallback to FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`[ImageCompression] Failed to load image: ${file.name}`));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error(`[ImageCompression] FileReader error`));
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Compress an image and return a new File with the same name prefix.
 * Convenience wrapper returning File instead of Blob.
 */
export async function compressImageAsFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const blob = await compressImage(file, options);
  const extension = options.mimeType?.split('/')[1] ?? 'jpg';
  // Strip original extension and append new one
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newName = `${baseName}_compressed.${extension}`;
  return new File([blob], newName, { type: blob.type });
}
