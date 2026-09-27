import { StaffMember, LeaveRequest } from '../types';
import { STORAGE_KEYS, getActiveCompanyId, saveCompanyData, loadCompanyData } from './companyStorage';
import { safeSaveLocalStorage } from './storage';
import { getAllKeysAndValuesFromIDB } from './idbStorage';

export interface RecoveryScanResult {
  hasRecoverableData: boolean;
  bestStaffCount: number;
  bestLeavesCount: number;
  foundStaffSources: { key: string; count: number; source: 'localStorage' | 'IndexedDB' }[];
  foundLeavesSources: { key: string; count: number; source: 'localStorage' | 'IndexedDB' }[];
  allRecoveredStaff: StaffMember[];
  allRecoveredLeaves: LeaveRequest[];
}

/**
 * Deep scans all localStorage and IndexedDB entries across all company scopes,
 * legacy prefixes, and snapshot backups to find missing staff records and leave logs.
 */
export async function scanAllStorageForStaffAndLeaves(): Promise<RecoveryScanResult> {
  const staffSources: { key: string; count: number; source: 'localStorage' | 'IndexedDB'; items: StaffMember[] }[] = [];
  const leavesSources: { key: string; count: number; source: 'localStorage' | 'IndexedDB'; items: LeaveRequest[] }[] = [];

  // 1. Scan LocalStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const keyLower = key.toLowerCase();
      // Check for staff keys
      if (keyLower.includes('staff') && !keyLower.includes('history') && !keyLower.includes('welfare')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Verify structure resembles StaffMember
              const isStaff = parsed.some((item) => item && (item.name || item.employeeId));
              if (isStaff) {
                staffSources.push({
                  key,
                  count: parsed.length,
                  source: 'localStorage',
                  items: parsed,
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Check for leaves keys
      if (keyLower.includes('leave')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const isLeave = parsed.some((item) => item && (item.leaveType || item.startDate || item.employeeName));
              if (isLeave) {
                leavesSources.push({
                  key,
                  count: parsed.length,
                  source: 'localStorage',
                  items: parsed,
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[dataRecovery] Error scanning localStorage:', err);
  }

  // 2. Scan IndexedDB (app_data store)
  try {
    const idbData = await getAllKeysAndValuesFromIDB();
    for (const [key, val] of Object.entries(idbData)) {
      const keyLower = key.toLowerCase();

      if (keyLower.includes('staff') && !keyLower.includes('history') && !keyLower.includes('welfare')) {
        if (Array.isArray(val) && val.length > 0) {
          const isStaff = val.some((item) => item && (item.name || item.employeeId));
          if (isStaff) {
            staffSources.push({
              key,
              count: val.length,
              source: 'IndexedDB',
              items: val,
            });
          }
        }
      }

      if (keyLower.includes('leave')) {
        if (Array.isArray(val) && val.length > 0) {
          const isLeave = val.some((item) => item && (item.leaveType || item.startDate || item.employeeName));
          if (isLeave) {
            leavesSources.push({
              key,
              count: val.length,
              source: 'IndexedDB',
              items: val,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[dataRecovery] Error scanning IndexedDB:', err);
  }

  // Sort sources by highest count descending
  staffSources.sort((a, b) => b.count - a.count);
  leavesSources.sort((a, b) => b.count - a.count);

  // Merge staff from all sources without duplicates to ensure complete 225+ recovery
  const staffMap = new Map<string, StaffMember>();
  staffSources.forEach((src) => {
    src.items.forEach((s) => {
      const key = (s.employeeId || s.id || s.name || '').trim().toLowerCase();
      if (key && !staffMap.has(key)) {
        staffMap.set(key, s);
      }
    });
  });

  // Merge leaves from all sources without duplicates
  const leavesMap = new Map<string, LeaveRequest>();
  leavesSources.forEach((src) => {
    src.items.forEach((l) => {
      const key = (l.id || `${l.employeeId}_${l.startDate}_${l.leaveType}`).trim().toLowerCase();
      if (key && !leavesMap.has(key)) {
        leavesMap.set(key, l);
      }
    });
  });

  const allRecoveredStaff = Array.from(staffMap.values());
  const allRecoveredLeaves = Array.from(leavesMap.values());

  return {
    hasRecoverableData: allRecoveredStaff.length > 0 || allRecoveredLeaves.length > 0,
    bestStaffCount: allRecoveredStaff.length,
    bestLeavesCount: allRecoveredLeaves.length,
    foundStaffSources: staffSources.map((s) => ({ key: s.key, count: s.count, source: s.source })),
    foundLeavesSources: leavesSources.map((l) => ({ key: l.key, count: l.count, source: l.source })),
    allRecoveredStaff,
    allRecoveredLeaves,
  };
}

/**
 * Restores recovered staff and leaves into the active company's storage.
 */
export async function executeDataRestoration(
  targetCompanyIdOrName?: string
): Promise<{
  success: boolean;
  restoredStaff: StaffMember[];
  restoredLeaves: LeaveRequest[];
  message: string;
}> {
  const scan = await scanAllStorageForStaffAndLeaves();
  if (!scan.hasRecoverableData) {
    return {
      success: false,
      restoredStaff: [],
      restoredLeaves: [],
      message: 'No displaced or historical staff records or leave logs were found in storage.',
    };
  }

  const companyId = getActiveCompanyId(targetCompanyIdOrName);

  // Save to active company in both localStorage and IndexedDB
  if (scan.allRecoveredStaff.length > 0) {
    saveCompanyData(STORAGE_KEYS.STAFF, scan.allRecoveredStaff, companyId);
  }

  if (scan.allRecoveredLeaves.length > 0) {
    saveCompanyData(STORAGE_KEYS.LEAVES, scan.allRecoveredLeaves, companyId);
  }

  const msg = `Successfully restored ${scan.allRecoveredStaff.length} staff records and ${scan.allRecoveredLeaves.length} leave logs to ${companyId}.`;
  return {
    success: true,
    restoredStaff: scan.allRecoveredStaff,
    restoredLeaves: scan.allRecoveredLeaves,
    message: msg,
  };
}
