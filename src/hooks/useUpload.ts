/**
 * useUpload — generic compressed file upload to Supabase Storage.
 *
 * Pipeline: File → Canvas Compression → Supabase Upload → Public URL
 *
 * Features:
 * - Client-side compression before upload
 * - Configurable storage bucket per call
 * - Async, non-blocking
 *
 * Usage:
 *   const { upload, isUploading, error } = useUpload();
 *   const url = await upload(file, bucket, userId);
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompression';

export interface UploadResult {
  url: string | null;
  error: string | null;
}

export interface UseUploadReturn {
  upload: (file: File, bucket: string, userId: string) => Promise<string | null>;
  isUploading: boolean;
  error: string | null;
}

export function useUpload(): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, bucket: string, userId: string): Promise<string | null> => {
    setIsUploading(true);
    setError(null);

    try {
      // ── Step 1: Compress ───────────────────────────────────────────────
      const compressed = await compressImage(file, {
        maxWidth: 3840,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });

      // ── Step 2: Upload to Supabase Storage ────────────────────────────
      const fileExtension = 'jpg';
      const fileName = `${userId}/${crypto.randomUUID()}.${fileExtension}`;
      const arrayBuffer = await compressed.arrayBuffer();

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Upload failed: ${storageError.message}`);
      }

      // ── Step 3: Get public URL ────────────────────────────────────────
      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      setIsUploading(false);
      return data.publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown upload error';
      setError(message);
      setIsUploading(false);
      return null;
    }
  }, []);

  return { upload, isUploading, error };
}
