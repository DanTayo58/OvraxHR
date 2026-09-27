/**
 * Image compression utilities for avatars, company logos, and attachments.
 * Ensures images uploaded to LocalStorage never exceed browser storage quotas
 * while maintaining pristine display sharpness on high-DPI screens.
 */

export async function compressImage(
  source: File | string,
  maxWidth = 260,
  maxHeight = 260,
  quality = 0.82
): Promise<string> {
  if (!source) return '';

  // SVG images or non-base64 external URLs don't need raster compression
  if (typeof source === 'string') {
    if (source.startsWith('data:image/svg+xml') || source.startsWith('http://') || source.startsWith('https://')) {
      return source;
    }
    // If it's already a tiny base64 string (< 20KB), return as is
    if (source.startsWith('data:image/') && source.length < 25000) {
      return source;
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleLoaded = () => {
      try {
        let width = img.naturalWidth || img.width || 200;
        let height = img.naturalHeight || img.height || 200;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(typeof source === 'string' ? source : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer webp, fallback to jpeg
        let result = canvas.toDataURL('image/webp', quality);
        if (!result.startsWith('data:image/webp') || result.length > 50000) {
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        resolve(typeof source === 'string' ? source : '');
      }
    };

    img.onload = handleLoaded;
    img.onerror = () => {
      console.warn('Image failed to load for compression');
      resolve(typeof source === 'string' ? source : '');
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(source);
    }
  });
}
