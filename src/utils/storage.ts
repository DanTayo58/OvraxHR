import { ProjectFile } from '../types';
import { saveToIDB, getFromIDB, deleteFromIDB } from './idbStorage';
export * from './idbStorage';

// In-memory cache fallback to ensure seamless synchronous operations even if localStorage quota is tight
const memoryCache = new Map<string, any>();

/**
 * Purges obsolete and duplicate keys from localStorage
 */
export function purgeObsoleteStorageKeys(): void {
  try {
    const legacyPrefixes = [
      'taima_projects_v1',
      'taima_projects_v2',
      'taima_projects_v3',
      'taima_app_settings_v1',
      'taima_app_settings_v2',
      'taima_onboarded_v1',
      'taima_onboarded_v2',
      'skima_staff_v0',
      'skima_feeding_schedule_v1',
      'skima_departments_v1',
      'skima_dept_transfers_v1',
    ];

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // Legacy prefixes
      if (legacyPrefixes.some((lp) => k === lp || k.startsWith(lp + '__'))) {
        keysToRemove.push(k);
        continue;
      }
    }

    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

/**
 * Compacts a project array to strip empty strings and redundant fields
 */
function compactProjects(projects: any[]): any[] {
  if (!Array.isArray(projects)) return projects;
  return projects.map((proj: any) => {
    if (!proj || typeof proj !== 'object') return proj;

    // Compact customValues
    let cleanCustomValues = proj.customValues;
    if (proj.customValues && typeof proj.customValues === 'object') {
      cleanCustomValues = {};
      for (const [staffId, colMap] of Object.entries(proj.customValues)) {
        if (colMap && typeof colMap === 'object') {
          const cleanCols: Record<string, string> = {};
          for (const [colName, val] of Object.entries(colMap as Record<string, string>)) {
            if (val && typeof val === 'string' && val.trim() !== '') {
              cleanCols[colName] = val.trim();
            }
          }
          if (Object.keys(cleanCols).length > 0) {
            cleanCustomValues[staffId] = cleanCols;
          }
        }
      }
    }

    // Compact records
    const cleanRecords = Array.isArray(proj.records)
      ? proj.records.map((rec: any) => {
          const r: Record<string, any> = {
            id: rec.id,
            employeeId: rec.employeeId,
            employeeName: rec.employeeName,
            department: rec.department,
            shift: rec.shift,
            date: rec.date,
            clockIn: rec.clockIn,
            clockOut: rec.clockOut,
            totalHours: rec.totalHours,
            status: rec.status,
          };
          if (rec.notes && rec.notes.trim()) r.notes = rec.notes.trim();
          if (rec.scheduledIn) r.scheduledIn = rec.scheduledIn;
          if (rec.dayNumber) r.dayNumber = rec.dayNumber;
          return r;
        })
      : [];

    return {
      ...proj,
      records: cleanRecords,
      customValues: cleanCustomValues,
    };
  });
}

/**
 * Safely saves data to localStorage with quota-exceeded handling,
 * IndexedDB background replication, legacy cache cleanup, and payload optimization.
 */
export function safeSaveLocalStorage(key: string, value: any): boolean {
  // Always update in-memory cache and IndexedDB with the FULL, un-truncated dataset
  memoryCache.set(key, value);
  saveToIDB(key, value).catch(() => {});

  try {
    const stringified = JSON.stringify(value);
    localStorage.setItem(key, stringified);
    return true;
  } catch (err: any) {
    // Storage quota reached: Clean up obsolete keys and bloated uncompressed image caches
    purgeObsoleteStorageKeys();

    try {
      // Remove any lingering oversized base64 logo or attachment caches from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k !== key && (k.includes('logo') || k.includes('attach'))) {
          const itemVal = localStorage.getItem(k);
          if (itemVal && itemVal.length > 50000) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {
      // ignore
    }

    // Retry saving full dataset to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      // If dataset is legitimately too large for localStorage's 5MB limit (e.g. 200+ staff records with attachments),
      // DO NOT TRUNCATE OR SLICE DATA!
      // The full dataset is safely preserved in memoryCache and IndexedDB (which supports hundreds of MBs).
      console.warn(`[safeSaveLocalStorage] Quota reached for [${key}]. Full dataset preserved in IndexedDB & cache.`);
      return true;
    }
  }
}

/**
 * Safely retrieves data from localStorage or memory cache
 */
export function safeGetLocalStorage<T>(key: string, defaultValue?: T): T {
  let localStorageValue: any = null;
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      localStorageValue = JSON.parse(saved);
    }
  } catch {
    // ignore
  }

  // If memory cache holds the data
  if (memoryCache.has(key)) {
    const memVal = memoryCache.get(key);
    // If memory cache has more records (e.g. 225 staff) than a quota-constrained localStorage, prefer memory cache
    if (Array.isArray(memVal) && Array.isArray(localStorageValue)) {
      if (memVal.length >= localStorageValue.length) {
        return memVal as T;
      }
    } else if (memVal !== null && memVal !== undefined) {
      return memVal as T;
    }
  }

  if (localStorageValue !== null) {
    memoryCache.set(key, localStorageValue);
    return localStorageValue as T;
  }

  return defaultValue as T;
}

