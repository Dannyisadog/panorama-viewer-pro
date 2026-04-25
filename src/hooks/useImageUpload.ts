/**
 * useImageUpload — compressed image upload hook for Supabase Storage
 *
 * Pipeline: File → Canvas Compression → Supabase Upload → Public URL → Annotation
 *
 * Features:
 * - Client-side compression before upload (prevents large file transfers)
 * - Non-blocking async operation
 * - Uploads to Supabase Storage bucket 'annotations-media'
 * - Returns public URL for immediate rendering / annotation creation
 *
 * Usage:
 *   const { upload, isUploading, error } = useImageUpload();
 *   const url = await upload(file, user);
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompression';
import { generateId } from '@/lib/annotationsService';

export interface UploadProgress {
  stage: 'idle' | 'compressing' | 'uploading' | 'done' | 'error';
  message?: string;
}

export interface UseImageUploadReturn {
  upload: (file: File, userId: string) => Promise<string | null>;
  isUploading: boolean;
  progress: UploadProgress;
  error: string | null;
}

const STORAGE_BUCKET = 'annotations-media';

/**
 * Upload an image file to Supabase Storage, with client-side compression.
 * Returns the public URL on success, null on failure.
 */
export function useImageUpload(): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ stage: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, userId: string): Promise<string | null> => {
    setIsUploading(true);
    setError(null);
    setProgress({ stage: 'compressing', message: 'Optimizing image...' });

    try {
      // ── Step 1: Compress ───────────────────────────────────────────────
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        quality: 0.78,
        mimeType: 'image/jpeg',
      });

      setProgress({ stage: 'uploading', message: 'Uploading...' });

      // ── Step 2: Upload to Supabase Storage ────────────────────────────
      const fileExtension = 'jpg'; // always JPEG after compression
      const fileName = `${userId}/${generateId()}.${fileExtension}`;
      const arrayBuffer = await compressed.arrayBuffer();

      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // ── Step 3: Get public URL ────────────────────────────────────────
      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      setProgress({ stage: 'done', message: 'Ready' });
      setIsUploading(false);

      return data.publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown upload error';
      setError(message);
      setProgress({ stage: 'error', message });
      setIsUploading(false);
      return null;
    }
  }, []);

  return { upload, isUploading, progress, error };
}
