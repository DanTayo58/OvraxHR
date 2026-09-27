import { getActiveCompanyId, normalizeCompanyKey, loadCompanyData, saveCompanyData, STORAGE_KEYS } from './companyStorage';
import { AppSettings, PlatformReview } from '../types';
import { compressImage } from './imageUtils';

const LOGO_BASE_KEY = 'skima_company_logo_v1';
const REVIEWS_STORAGE_KEY = 'skima_platform_reviews_v1';

// In-memory fallback & hot cache to guarantee instant, quota-safe retrieval
const MEMORY_LOGO_CACHE = new Map<string, string>();

/**
 * Centralized Logo Retrieval and Persistence Engine
 * Guarantees that wherever a client posts or retrieves a company logo,
 * it points to the exact same centralized source of truth system-wide.
 */

function cleanImageString(val: any): string | undefined {
  if (!val || typeof val !== 'string') return undefined;
  let str = val.trim();
  if (str.startsWith('"') && str.endsWith('"') && str.length > 2) {
    try {
      str = JSON.parse(str);
    } catch {
      str = str.slice(1, -1);
    }
  }
  if (
    str.startsWith('data:image/') ||
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('/') ||
    str.startsWith('blob:')
  ) {
    return str;
  }
  return undefined;
}

/**
 * Safely writes to localStorage with automatic quota recovery.
 */
function safeSetStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`Storage quota alert on key "${key}", executing emergency cache cleanup:`, err?.message || err);
    try {
      // Evict transient / duplicate preview caches to free space
      const keysToClean: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('__temp_') || k.includes('_cache_') || k.includes('_preview_'))) {
          keysToClean.push(k);
        }
      }
      keysToClean.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Fallback: save in sessionStorage or in-memory map
      try {
        sessionStorage.setItem(key, value);
      } catch {
        // ignore
      }
      return false;
    }
  }
}

/**
 * Retrieves the centralized company logo for a specified company ID or name.
 */
export function getCentralCompanyLogo(companyIdOrName?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const targetId = getActiveCompanyId(companyIdOrName);
  const directCidKey = `${LOGO_BASE_KEY}__cid_${targetId}`;

  // 0. Check hot memory cache
  if (MEMORY_LOGO_CACHE.has(targetId)) {
    return MEMORY_LOGO_CACHE.get(targetId);
  }
  if (companyIdOrName && MEMORY_LOGO_CACHE.has(companyIdOrName)) {
    return MEMORY_LOGO_CACHE.get(companyIdOrName);
  }

  try {
    // 1. Check primary company-scoped logo storage
    const directVal = localStorage.getItem(directCidKey) || sessionStorage.getItem(directCidKey);
    const cleanedDirect = cleanImageString(directVal);
    if (cleanedDirect) {
      MEMORY_LOGO_CACHE.set(targetId, cleanedDirect);
      return cleanedDirect;
    }

    // 2. Check company data storage key helper
    const loadedData = loadCompanyData<string>(LOGO_BASE_KEY, targetId);
    const cleanedLoaded = cleanImageString(loadedData);
    if (cleanedLoaded) {
      safeSetStorage(directCidKey, cleanedLoaded);
      MEMORY_LOGO_CACHE.set(targetId, cleanedLoaded);
      return cleanedLoaded;
    }

    // 3. Check company settings object from targetId & companyIdOrName
    const settingsCandidates: (AppSettings | null)[] = [
      loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, targetId),
      companyIdOrName ? loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, companyIdOrName) : null,
      loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, undefined),
    ];

    for (const settings of settingsCandidates) {
      if (!settings) continue;
      const sLogo =
        cleanImageString(settings.companyLogo) ||
        cleanImageString(settings.jdLogo) ||
        cleanImageString(settings.confirmationLogo) ||
        cleanImageString(settings.appointmentLogo);

      if (sLogo) {
        safeSetStorage(directCidKey, sLogo);
        MEMORY_LOGO_CACHE.set(targetId, sLogo);
        return sLogo;
      }
    }

    // 4. Fallback: check normalized slug key
    if (companyIdOrName) {
      const slugKey = `${LOGO_BASE_KEY}__c_${normalizeCompanyKey(companyIdOrName)}`;
      const slugVal = localStorage.getItem(slugKey);
      const cleanedSlug = cleanImageString(slugVal);
      if (cleanedSlug) {
        safeSetStorage(directCidKey, cleanedSlug);
        MEMORY_LOGO_CACHE.set(targetId, cleanedSlug);
        return cleanedSlug;
      }
    }

    // 5. Deep scan of local storage for settings with matching company ID
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_KEYS.SETTINGS) && k.includes(targetId)) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const foundLogo = cleanImageString(parsed?.companyLogo || parsed?.jdLogo);
            if (foundLogo) {
              safeSetStorage(directCidKey, foundLogo);
              MEMORY_LOGO_CACHE.set(targetId, foundLogo);
              return foundLogo;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error('Error retrieving central company logo:', err);
  }

  return undefined;
}

/**
 * Saves and propagates a client's logo to the centralized store and all linked entities.
 * Automatically ensures size safety to avoid LocalStorage quota exhaustion.
 */
export function saveCentralCompanyLogo(logoBase64: string, companyIdOrName?: string): void {
  if (!logoBase64) return;
  const targetId = getActiveCompanyId(companyIdOrName);
  const directCidKey = `${LOGO_BASE_KEY}__cid_${targetId}`;

  // Always store in memory cache first for immediate synchronous consistency
  MEMORY_LOGO_CACHE.set(targetId, logoBase64);
  if (companyIdOrName) {
    MEMORY_LOGO_CACHE.set(companyIdOrName, logoBase64);
  }

  // If the image is large (> 30KB), trigger asynchronous compression and background persistence
  const needsCompression = logoBase64.startsWith('data:image/') && logoBase64.length > 35000;

  const persistLogo = (effectiveLogo: string) => {
    try {
      // 1. Store in central logo key safely
      safeSetStorage(directCidKey, effectiveLogo);

      // 2. Sync to Company Settings
      const existingSettings =
        loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, targetId) ||
        (companyIdOrName ? loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, companyIdOrName) : null);
      if (existingSettings) {
        const updatedSettings: AppSettings = {
          ...existingSettings,
          companyLogo: effectiveLogo,
        };
        saveCompanyData(STORAGE_KEYS.SETTINGS, updatedSettings, targetId);
        if (companyIdOrName) {
          saveCompanyData(STORAGE_KEYS.SETTINGS, updatedSettings, companyIdOrName);
        }
      }

      // 3. Retroactively sync existing reviews for this company
      const rawReviews = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (rawReviews) {
        const reviews = JSON.parse(rawReviews);
        if (Array.isArray(reviews)) {
          let changed = false;
          const updatedReviews = reviews.map((r: PlatformReview) => {
            const isTargetCompany =
              (r.companyId && getActiveCompanyId(r.companyId) === targetId) ||
              (r.companyName && companyIdOrName && r.companyName.trim().toLowerCase() === companyIdOrName.trim().toLowerCase());
            if (isTargetCompany && r.companyLogo !== effectiveLogo) {
              changed = true;
              return { ...r, companyLogo: effectiveLogo };
            }
            return r;
          });
          if (changed) {
            safeSetStorage(REVIEWS_STORAGE_KEY, JSON.stringify(updatedReviews));
          }
        }
      }

      // 4. Dispatch synchronization events
      window.dispatchEvent(
        new CustomEvent('skima_logo_updated', {
          detail: { companyId: targetId, logo: effectiveLogo },
        })
      );
      window.dispatchEvent(new Event('skima_reviews_updated'));
    } catch (err) {
      console.error('Error saving central company logo:', err);
    }
  };

  if (needsCompression) {
    compressImage(logoBase64, 260, 260, 0.82)
      .then((compressed) => {
        const result = compressed || logoBase64;
        MEMORY_LOGO_CACHE.set(targetId, result);
        persistLogo(result);
      })
      .catch(() => persistLogo(logoBase64));
  } else {
    persistLogo(logoBase64);
  }
}

/**
 * Removes the centralized company logo across the workspace.
 */
export function removeCentralCompanyLogo(companyIdOrName?: string): void {
  const targetId = getActiveCompanyId(companyIdOrName);
  const directCidKey = `${LOGO_BASE_KEY}__cid_${targetId}`;

  MEMORY_LOGO_CACHE.delete(targetId);
  if (companyIdOrName) {
    MEMORY_LOGO_CACHE.delete(companyIdOrName);
  }

  try {
    localStorage.removeItem(directCidKey);

    const existingSettings = loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, targetId);
    if (existingSettings) {
      const updatedSettings: AppSettings = {
        ...existingSettings,
        companyLogo: undefined,
      };
      saveCompanyData(STORAGE_KEYS.SETTINGS, updatedSettings, targetId);
    }

    window.dispatchEvent(
      new CustomEvent('skima_logo_updated', {
        detail: { companyId: targetId, logo: undefined },
      })
    );
    window.dispatchEvent(new Event('skima_reviews_updated'));
  } catch (err) {
    console.error('Error removing central company logo:', err);
  }
}

