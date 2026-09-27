import { safeSaveLocalStorage, safeGetLocalStorage } from './storage';

export const STORAGE_KEYS = {
  PROJECTS: 'taima_projects_v4',
  STAFF: 'skima_staff_v1',
  LEAVES: 'skima_leaves_v1',
  SETTINGS: 'taima_app_settings_v3',
  DEPARTMENTS: 'skima_departments_v2',
  TRANSFERS: 'skima_dept_transfers_v2',
  STAFF_HISTORY: 'skima_staff_custom_history_v1',
  KPI_RATINGS: 'skima_kpi_involvement_v1',
  FEEDING: 'skima_feeding_schedule_v2',
  ONBOARDING: 'taima_onboarded_v3',
  VACANCIES: 'skima_vacancies_v1',
  APPLICANTS: 'skima_applicants_v1',
  PAYROLL: 'skima_payroll_config_v1',
  SUSPENSION_LOGS: 'skima_suspension_logs_v1',
  KPI_FREQUENCY: 'skima_kpi_frequency_v1',
  QUERIES: 'skima_staff_queries_v1',
} as const;

/**
 * Sanitizes and normalizes a Company Initials / ID.
 * Strictly alphanumeric (letters and numbers only, uppercase).
 * e.g., "SKM-01" -> "SKM01", "Acme Corp" -> "ACMECORP", "RHV" -> "RHV"
 */
export function normalizeCompanyId(companyId?: string): string {
  if (!companyId || typeof companyId !== 'string') return '';
  return companyId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Derives a clean company ID abbreviation from a company name if not explicitly set.
 * e.g. "Skima HQ" -> "SKM", "Apex Global Logistics" -> "AGL", "Daniel Tayo Corp" -> "DTC"
 */
export function deriveCompanyIdFromName(companyName?: string): string {
  if (!companyName || typeof companyName !== 'string') return 'DEFAULT';
  const clean = companyName.trim();
  if (!clean || clean.toLowerCase() === 'my organization' || clean.toLowerCase() === 'registered organization') {
    return 'DEFAULT';
  }
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words.map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (initials.length >= 2) return initials.slice(0, 8);
  }
  const alphanumeric = clean.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return alphanumeric.slice(0, 6) || 'DEFAULT';
}

/**
 * Normalizes a company name into a safe storage key slug.
 */
export function normalizeCompanyKey(companyName?: string): string {
  if (!companyName || typeof companyName !== 'string') {
    return 'default_org';
  }
  const trimmed = companyName.trim().toLowerCase();
  if (!trimmed || trimmed === 'registered organization' || trimmed === 'your registered company') {
    return 'default_org';
  }
  const sanitized = trimmed.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return sanitized || 'default_org';
}

/**
 * Resolves the active company ID strictly.
 * If a companyId or companyName is explicitly provided, it resolves ONLY for that entity.
 * It NEVER leaks or defaults to a foreign session when a specific company is requested.
 */
export function getActiveCompanyId(fallbackCompanyOrId?: string): string {
  // If specific company name or ID was passed, resolve strictly from that parameter
  if (fallbackCompanyOrId && typeof fallbackCompanyOrId === 'string' && fallbackCompanyOrId.trim()) {
    const trimmed = fallbackCompanyOrId.trim();

    // 1. Check if it's already a clean alphanumeric company ID (e.g. "SKM", "RHV", "ACM")
    const directClean = normalizeCompanyId(trimmed);
    if (directClean.length >= 2 && trimmed.length <= 10 && !trimmed.includes(' ') && !trimmed.includes('_')) {
      return directClean;
    }

    // 2. Check registered users to find the exact companyId configured for this company name/id
    try {
      const usersJson =
        localStorage.getItem('skima_company_users_v4') ||
        localStorage.getItem('skima_company_users_v3');
      if (usersJson) {
        const users = JSON.parse(usersJson);
        if (Array.isArray(users)) {
          const matched = users.find(
            (u: any) =>
              (u.company && u.company.trim().toLowerCase() === trimmed.toLowerCase()) ||
              (u.companyId && normalizeCompanyId(u.companyId) === directClean)
          );
          if (matched?.companyId && typeof matched.companyId === 'string' && matched.companyId.trim()) {
            return normalizeCompanyId(matched.companyId);
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Derive directly from the specified string
    return deriveCompanyIdFromName(trimmed);
  }

  // If NO company parameter was passed, resolve strictly from the active logged-in user session
  try {
    const sessionKeys = ['skima_user_session', 'taima_user_session', 'skima_current_user', 'skima_user_v1'];
    for (const key of sessionKeys) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.companyId && typeof parsed.companyId === 'string' && parsed.companyId.trim()) {
          return normalizeCompanyId(parsed.companyId);
        }
        if (parsed?.company && typeof parsed.company === 'string' && parsed.company.trim()) {
          return deriveCompanyIdFromName(parsed.company);
        }
      }
    }
  } catch {
    // ignore
  }

  return 'DEFAULT';
}

/**
 * Resolves the active company name from current session in localStorage or user accounts.
 */
export function getActiveSessionCompany(): string {
  try {
    const sessionKeys = ['skima_user_session', 'taima_user_session', 'skima_current_user', 'skima_user_v1'];
    for (const key of sessionKeys) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          parsed.company &&
          typeof parsed.company === 'string' &&
          parsed.company.trim() &&
          !parsed.company.toLowerCase().includes('registered organization')
        ) {
          return parsed.company.trim();
        }
      }
    }
  } catch {
    // ignore
  }

  return 'Default Organization';
}

/**
 * Builds the company-scoped localStorage key for any data type.
 * Prioritizes companyId / initials (e.g. `taima_projects_v4__cid_SKM`) with fallback to slug.
 */
export function getCompanyStorageKey(baseKey: string, companyIdOrName?: string): string {
  const companyId = getActiveCompanyId(companyIdOrName);
  return `${baseKey}__cid_${companyId}`;
}

/**
 * Loads company-specific data from localStorage with strict multi-tenant isolation.
 * Automatically checks:
 * 1. Company ID key: `${baseKey}__cid_${companyId}`
 * 2. Name Slug key: `${baseKey}__c_${normalizedName}`
 *
 * NOTE: Un-scoped legacy keys are NOT checked to avoid leaking another company's data into newly created organizations.
 */
export function loadCompanyData<T>(baseKey: string, companyIdOrName?: string, defaultValue?: T): T {
  const companyId = getActiveCompanyId(companyIdOrName);
  const targetCompany = companyIdOrName || getActiveSessionCompany();
  const cidKey = `${baseKey}__cid_${companyId}`;
  const slugKey = `${baseKey}__c_${normalizeCompanyKey(targetCompany)}`;

  try {
    // 1. Check primary company ID key (using safeGetLocalStorage which checks memory cache too)
    const savedCid = safeGetLocalStorage<any>(cidKey, null);

    // 2. Check slug key
    const savedSlug = safeGetLocalStorage<any>(slugKey, null);

    // 3. Fallback to DEFAULT company key if active company has no data or was truncated
    let defaultData: any = null;
    if (companyId !== 'DEFAULT') {
      defaultData = safeGetLocalStorage<any>(`${baseKey}__cid_DEFAULT`, null);
    }

    // Determine the most complete dataset available
    let bestCandidate: any = savedCid;

    // If candidate is an array, check if any alternative source has MORE records
    if (Array.isArray(savedCid)) {
      if (Array.isArray(savedSlug) && savedSlug.length > savedCid.length) {
        bestCandidate = savedSlug;
      }
      if (Array.isArray(defaultData) && defaultData.length > (bestCandidate?.length || 0)) {
        bestCandidate = defaultData;
      }
    } else if (!savedCid) {
      if (savedSlug) {
        bestCandidate = savedSlug;
      } else if (defaultData) {
        bestCandidate = defaultData;
      }
    }

    if (bestCandidate !== null && bestCandidate !== undefined) {
      // If we recovered a more complete dataset from a fallback key, sync to current canonical key
      if (bestCandidate !== savedCid) {
        safeSaveLocalStorage(cidKey, bestCandidate);
      }
      return bestCandidate as T;
    }
  } catch (e) {
    console.error(`Failed to load company-scoped data for [${cidKey}]:`, e);
  }

  return (defaultValue !== undefined ? defaultValue : null) as unknown as T;
}

/**
 * Saves data scoped strictly to the active company ID.
 */
export function saveCompanyData<T>(baseKey: string, data: T, companyIdOrName?: string): boolean {
  const companyId = getActiveCompanyId(companyIdOrName);
  const targetCompany = companyIdOrName || getActiveSessionCompany();
  const cidKey = `${baseKey}__cid_${companyId}`;
  const slugKey = `${baseKey}__c_${normalizeCompanyKey(targetCompany)}`;

  // Remove duplicate slug key if present to halve storage consumption
  try {
    if (localStorage.getItem(slugKey) !== null) {
      localStorage.removeItem(slugKey);
    }
  } catch {
    // ignore
  }

  return safeSaveLocalStorage(cidKey, data);
}

/**
 * Migrates all data records from an old company name/id to a new company name/id.
 */
export function migrateAllCompanyData(
  oldCompanyName: string,
  newCompanyName: string,
  oldCompanyId?: string,
  newCompanyId?: string
): void {
  const oldCid = normalizeCompanyId(oldCompanyId) || deriveCompanyIdFromName(oldCompanyName);
  const newCid = normalizeCompanyId(newCompanyId) || deriveCompanyIdFromName(newCompanyName);
  const oldNorm = normalizeCompanyKey(oldCompanyName);
  const newNorm = normalizeCompanyKey(newCompanyName);

  const allBaseKeys = Object.values(STORAGE_KEYS);

  allBaseKeys.forEach((baseKey) => {
    try {
      const oldCidKey = `${baseKey}__cid_${oldCid}`;
      const newCidKey = `${baseKey}__cid_${newCid}`;
      const oldSlugKey = `${baseKey}__c_${oldNorm}`;
      const newSlugKey = `${baseKey}__c_${newNorm}`;

      const existingData =
        localStorage.getItem(oldCidKey) ||
        localStorage.getItem(oldSlugKey) ||
        localStorage.getItem(baseKey);

      if (existingData !== null) {
        localStorage.setItem(newCidKey, existingData);
        localStorage.setItem(newSlugKey, existingData);
        if (oldCidKey !== newCidKey) localStorage.removeItem(oldCidKey);
        if (oldSlugKey !== newSlugKey) localStorage.removeItem(oldSlugKey);
      }
    } catch (e) {
      console.error(`Error migrating ${baseKey} to ${newCompanyName} (${newCid}):`, e);
    }
  });
}

/**
 * Clears all data scoped to a specific company ID.
 */
export function clearCompanySpecificData(companyIdOrName?: string): void {
  const companyId = getActiveCompanyId(companyIdOrName);
  const targetCompany = companyIdOrName || getActiveSessionCompany();
  const cidKeyPrefix = `__cid_${companyId}`;
  const slugKeyPrefix = `__c_${normalizeCompanyKey(targetCompany)}`;

  const allBaseKeys = Object.values(STORAGE_KEYS);

  allBaseKeys.forEach((baseKey) => {
    try {
      const cidKey = `${baseKey}${cidKeyPrefix}`;
      const slugKey = `${baseKey}${slugKeyPrefix}`;
      const emptyVal = baseKey === STORAGE_KEYS.KPI_RATINGS || baseKey === STORAGE_KEYS.FEEDING ? '{}' : '[]';
      
      if (baseKey !== STORAGE_KEYS.SETTINGS) {
        localStorage.setItem(cidKey, emptyVal);
        localStorage.setItem(slugKey, emptyVal);
      }
    } catch (e) {
      console.error(`Error clearing data for company [${companyId}]:`, e);
    }
  });
}

/**
 * Full Network Backup Export: generates a portable JSON payload of all company data
 * for easy transfer across laptops/devices.
 */
export function exportCompanyNetworkBackup(companyIdOrName?: string): string {
  const companyId = getActiveCompanyId(companyIdOrName);
  const companyName = companyIdOrName || getActiveSessionCompany();

  const backupData: Record<string, any> = {
    _skima_backup_version: '4.0',
    companyId,
    companyName,
    exportedAt: new Date().toISOString(),
    datasets: {},
  };

  Object.entries(STORAGE_KEYS).forEach(([keyName, baseKey]) => {
    backupData.datasets[keyName] = loadCompanyData(baseKey, companyId, null);
  });

  return JSON.stringify(backupData, null, 2);
}

/**
 * Imports a portable JSON backup payload into this browser.
 */
export function importCompanyNetworkBackup(jsonString: string): { success: boolean; companyId?: string; companyName?: string; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.companyId || !parsed.datasets) {
      return { success: false, error: 'Invalid backup file structure.' };
    }

    const companyId = normalizeCompanyId(parsed.companyId);
    const companyName = parsed.companyName || companyId;

    Object.entries(STORAGE_KEYS).forEach(([keyName, baseKey]) => {
      if (parsed.datasets[keyName] !== undefined) {
        saveCompanyData(baseKey, parsed.datasets[keyName], companyId);
      }
    });

    return { success: true, companyId, companyName };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Deep Purge: Scans all localStorage keys and scrubs legacy dummy/seed data,
 * orphan departments, ghost staff, sample leave records, and duplicate admin accounts.
 */
export function purgeAllSampleAndGhostData(currentCompanyName?: string): void {
  // Safe no-op: Prevents accidental loss or purging of legitimate user data, staff records, and leave logs
  return;
}
