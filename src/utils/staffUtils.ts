import { StaffMember, DepartmentInfo, SuspensionHistoryRecord, QueryRecord, QueryActionVerdict, BookedPenalty } from '../types';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS, getActiveCompanyId, normalizeCompanyId } from './companyStorage';
import { loadCompanyPayrollConfig, saveCompanyPayrollConfig } from './payrollUtils';
import { getCleanDepartments } from './departmentUtils';

export function getDepartmentCode(departmentNameOrCode: string, companyIdOrName?: string): string {
  if (!departmentNameOrCode) return 'GEN';

  // Try reading company saved departments
  try {
    const parsed = getCleanDepartments(companyIdOrName);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const found = parsed.find(
        (d) =>
          d.name.toLowerCase().trim() === departmentNameOrCode.toLowerCase().trim() ||
          d.code.toLowerCase().trim() === departmentNameOrCode.toLowerCase().trim()
      );
      if (found && found.code && found.code.trim()) {
        return found.code.trim().toUpperCase();
      }
    }
  } catch (e) {
    console.error('Error reading departments for code lookup', e);
  }

  // Fallback: clean non-alphanumeric chars and take first 3 chars
  const clean = departmentNameOrCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.slice(0, 3) || 'GEN';
}

/**
 * Formats or cleans a staff ID string.
 * For manually typed IDs (e.g. "001", "EMP-01", "1042"), the exact typed ID is preserved.
 */
export function formatStaffId(rawId: string, _companyIdOrName?: string): string {
  const trimmed = (rawId || '').trim();
  return trimmed;
}

/**
 * Generates an auto-generated Staff ID adhering to the rule:
 * `COMPANY_ID/DEPT-XXXX`
 * e.g. "SKM/ENG-A7K2", "APEX/HR-8821"
 */
export function generateStaffId(
  departmentNameOrCode: string,
  staffList: StaffMember[] = [],
  companyIdOrName?: string
): string {
  const compId = getActiveCompanyId(companyIdOrName);
  const deptCode = getDepartmentCode(departmentNameOrCode, companyIdOrName);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let attempts = 0;
  while (attempts < 100) {
    let rand4 = '';
    for (let i = 0; i < 4; i++) {
      rand4 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidateId = `${compId}/${deptCode}-${rand4}`;
    const exists = staffList.some(
      (s) =>
        (s.employeeId && s.employeeId.toUpperCase() === candidateId.toUpperCase()) ||
        (s.id && s.id.toUpperCase() === candidateId.toUpperCase())
    );
    if (!exists) {
      return candidateId;
    }
    attempts++;
  }

  return `${compId}/${deptCode}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Determines whether an employee ID represents an unassigned / N/A value.
 */
export function isNaEmployeeId(id?: string | null): boolean {
  if (!id) return true;
  const clean = id.trim().toUpperCase();
  return clean === '' || clean === 'N/A' || clean === 'NA' || clean === 'NONE' || clean === 'NULL';
}

/**
 * Checks whether an employee ID is unique across the staff list.
 * "N/A" and "NA" are explicitly permitted to have duplicates.
 */
export function isEmployeeIdUnique(
  candidateId: string,
  staffList: { id?: string; employeeId?: string; name?: string }[],
  currentStaffId?: string
): { isUnique: boolean; conflictingStaff?: { id?: string; employeeId?: string; name?: string } } {
  const cleanCandidate = (candidateId || '').trim();
  if (!cleanCandidate || isNaEmployeeId(cleanCandidate)) {
    return { isUnique: true };
  }

  const conflicting = staffList.find((s) => {
    if (currentStaffId && s.id === currentStaffId) return false;
    if (isNaEmployeeId(s.employeeId)) return false;
    return (s.employeeId || '').trim().toLowerCase() === cleanCandidate.toLowerCase();
  });

  return {
    isUnique: !conflicting,
    conflictingStaff: conflicting,
  };
}

/**
 * Extracts and formats structured suspension details from a StaffMember.
 */
export function getStaffSuspensionDetails(staff?: StaffMember | null, companyNameOrId?: string) {
  if (!staff) {
    return {
      isSuspended: false,
      startDate: '',
      endDate: '',
      reason: '',
      displayRange: '',
    };
  }

  let startDate = (staff.suspensionStartDate || '').trim();
  let endDate = (staff.suspensionEndDate || '').trim();
  let reason = (staff.suspensionReason || '').trim();

  // If suspensionStartDate / suspensionEndDate were not explicitly set, parse from suspensionEndTime
  if ((!startDate || !endDate) && staff.suspensionEndTime) {
    if (staff.suspensionEndTime.includes(' to ')) {
      const parts = staff.suspensionEndTime.split(' to ');
      if (!startDate) startDate = parts[0]?.trim() || '';
      if (!endDate) endDate = parts[1]?.trim() || '';
    } else {
      if (!endDate) {
        endDate = staff.suspensionEndTime.split('T')[0] || staff.suspensionEndTime.trim();
      }
    }
  }

  // If still missing startDate but staff is marked as Suspended, check historical logs
  if (!startDate && staff.status === 'Suspended') {
    try {
      const staffKey = staff.employeeId || staff.id;
      const storedLogs = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyNameOrId, {});
      const logs = storedLogs[staffKey] || [];
      const latestSusp = logs.find((l) => l.category === 'Disciplinary Suspension' || l.title?.includes('Suspension'));
      if (latestSusp && latestSusp.startDate) {
        startDate = latestSusp.startDate;
        if (!endDate && latestSusp.endDate) endDate = latestSusp.endDate;
        if (!reason && latestSusp.reason) reason = latestSusp.reason;
      }
    } catch {
      // ignore
    }
  }

  const hasSuspensionInfo = Boolean(staff.status === 'Suspended' || startDate || endDate || staff.suspensionEndTime);

  const displayRange =
    startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Until ${endDate}`
      : hasSuspensionInfo
      ? 'Active Suspension'
      : '';

  return {
    isSuspended: staff.status === 'Suspended',
    startDate,
    endDate,
    reason,
    displayRange,
  };
}

/**
 * Checks if a staff member was suspended on a specific date (YYYY-MM-DD).
 */
export function isStaffSuspendedOnDate(staff?: StaffMember | null, dateStr?: string): boolean {
  if (!staff) return false;
  if (staff.status === 'Exited') return false;

  const { isSuspended, startDate, endDate } = getStaffSuspensionDetails(staff);
  if (!isSuspended && !startDate && !endDate) return false;

  if (!dateStr) dateStr = new Date().toISOString().split('T')[0];

  if (startDate && endDate) {
    return dateStr >= startDate && dateStr <= endDate;
  }
  if (startDate && !endDate) {
    return dateStr >= startDate;
  }
  if (!startDate && endDate) {
    return dateStr <= endDate;
  }

  return isSuspended;
}

/**
 * Checks if a staff member's suspension has expired/ended as of the target date.
 */
export function isStaffSuspensionEnded(staff?: StaffMember | null, targetDate?: string): boolean {
  if (!staff) return false;
  const today = targetDate || new Date().toISOString().split('T')[0];
  const { endDate } = getStaffSuspensionDetails(staff);
  if (!endDate) return false; // Indefinite suspensions don't auto-expire
  return today > endDate;
}

/**
 * Calculates the total inclusive days between suspension start and end dates.
 */
export function calculateSuspensionDays(startDate?: string, endDate?: string): number {
  if (!startDate) return 1;
  if (!endDate) return 1; // Default to 1 day kickoff if ongoing/indefinite
  try {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
    const diffTime = d2.getTime() - d1.getTime();
    if (diffTime < 0) return 1;
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
    return Math.max(1, diffDays);
  } catch {
    return 1;
  }
}

/**
 * Logs a suspension audit event to both individual employee history and global company suspension audit log.
 */
export function logStaffSuspensionHistory(
  staff: StaffMember,
  event: {
    type: 'created' | 'updated' | 'restored' | 'ended';
    startDate?: string;
    endDate?: string;
    reason?: string;
    penaltyRuleName?: string;
    penaltyAmountFormatted?: string;
    deductionPolicy?: string;
    deductionAmount?: number;
    dailyRate?: number;
    calculationType?: 'daily_pay' | 'rigid' | 'catalog' | 'none';
    durationDays?: number;
    authorizedBy?: string;
  },
  companyNameOrId?: string
) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sDate = event.startDate || staff.suspensionStartDate || today;
    const eDate = event.endDate || staff.suspensionEndDate || '';
    const rsn = event.reason || staff.suspensionReason || 'Disciplinary workforce review.';
    const auth = event.authorizedBy || 'HR Management';
    const durationDays = event.durationDays || calculateSuspensionDays(sDate, eDate);

    let title = 'Disciplinary Suspension Registered';
    let notes = `Suspension active from ${sDate}${eDate ? ` to ${eDate} (${durationDays} days)` : ' (Indefinite/Pending Review)'}. Reason: ${rsn}.`;
    if (event.type === 'restored' || event.type === 'ended') {
      title = event.type === 'restored' ? 'Staff Unsuspended & Restored to Active' : 'Suspension Period Concluded';
      notes = `Staff member status restored to Active after suspension (${sDate} to ${eDate || 'Completed'}). Reason: ${rsn}.`;
    } else if (event.type === 'updated') {
      title = 'Suspension Timeline Adjusted';
      notes = `Suspension updated to ${sDate} to ${eDate || 'Indefinite'} (${durationDays} days). Reason: ${rsn}.`;
    }

    const deductionPolicy =
      event.deductionPolicy ||
      (event.penaltyRuleName && event.penaltyRuleName !== 'None'
        ? `${event.penaltyRuleName} (${event.penaltyAmountFormatted || 'Deducted'})`
        : 'Pardoned (No Fine / Automatic Deduction)');

    if (event.penaltyRuleName && event.penaltyRuleName !== 'None') {
      notes += ` Policy: ${event.penaltyRuleName} (${event.penaltyAmountFormatted || 'Registered in Payroll'}).`;
    } else if (event.type === 'created' && !event.deductionPolicy) {
      notes += ` Financial Penalty: Pardon granted (No fine deducted).`;
    }

    const recordId = `audit-susp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const auditEntry = {
      id: recordId,
      category: 'Disciplinary Suspension',
      title,
      date: today,
      startDate: sDate,
      endDate: eDate,
      durationDays,
      reason: rsn,
      penaltyApplied: deductionPolicy,
      deductionPolicy,
      deductionAmount: event.deductionAmount || 0,
      dailyRate: event.dailyRate,
      calculationType: event.calculationType || 'none',
      notes,
      authorizedBy: auth,
      timestamp: nowIso,
    };

    // 1. Update individual staff log in place if restored, ended, or updated
    const storedLogs = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyNameOrId, {});
    const staffKey = staff.employeeId || staff.id;
    const currentList = storedLogs[staffKey] || [];

    let updatedStaffHistoryList: any[];
    if (event.type === 'restored' || event.type === 'ended' || event.type === 'updated') {
      let found = false;
      updatedStaffHistoryList = currentList.map((entry) => {
        if (!found && entry && (entry.category === 'Disciplinary Suspension' || entry.title?.includes('Suspension'))) {
          found = true;
          return {
            ...entry,
            title,
            status: event.type === 'restored' ? 'Restored' : event.type === 'ended' ? 'Concluded' : entry.status,
            endDate: eDate || entry.endDate,
            notes: notes ? `${entry.notes ? entry.notes + ' | ' : ''}${notes}` : entry.notes,
            authorizedBy: auth || entry.authorizedBy,
            timestamp: nowIso,
          };
        }
        return entry;
      });
      if (!found) {
        updatedStaffHistoryList = [auditEntry, ...currentList];
      }
    } else {
      updatedStaffHistoryList = [auditEntry, ...currentList];
    }

    saveCompanyData(STORAGE_KEYS.STAFF_HISTORY, {
      ...storedLogs,
      [staffKey]: updatedStaffHistoryList,
    }, companyNameOrId);

    // 2. Update global company suspension log (update existing record in-place if restoring or concluding)
    const globalLogs = loadCompanyData<SuspensionHistoryRecord[]>(STORAGE_KEYS.SUSPENSION_LOGS, companyNameOrId, []);

    let updatedGlobalLogs: SuspensionHistoryRecord[];
    if (event.type === 'restored' || event.type === 'ended' || event.type === 'updated') {
      let matched = false;
      updatedGlobalLogs = globalLogs.map((rec) => {
        const isMatch =
          !matched &&
          (rec.staffId === staff.id || (rec.employeeId && staff.employeeId && rec.employeeId === staff.employeeId));
        if (isMatch) {
          matched = true;
          return {
            ...rec,
            type: event.type,
            title,
            status: event.type === 'restored' ? 'Restored' : event.type === 'ended' ? 'Concluded' : rec.status,
            endDate: eDate || (event.type === 'restored' ? today : rec.endDate),
            notes: notes ? `${rec.notes ? rec.notes + ' | ' : ''}${notes}` : rec.notes,
            authorizedBy: auth || rec.authorizedBy,
            timestamp: nowIso,
          };
        }
        return rec;
      });

      if (!matched) {
        const structuredRecord: SuspensionHistoryRecord = {
          id: recordId,
          staffId: staff.id,
          employeeId: staff.employeeId || '',
          staffName: staff.name,
          department: staff.department || 'General',
          role: staff.role || 'Staff Member',
          category: 'Disciplinary Suspension',
          type: event.type,
          title,
          date: today,
          startDate: sDate,
          endDate: eDate,
          durationDays,
          reason: rsn,
          deductionPolicy,
          deductionAmount: event.deductionAmount || 0,
          dailyRate: event.dailyRate,
          calculationType: event.calculationType || 'none',
          penaltyRuleName: event.penaltyRuleName,
          notes,
          authorizedBy: auth,
          status: event.type === 'restored' ? 'Restored' : event.type === 'ended' ? 'Concluded' : 'Currently Suspended',
          timestamp: nowIso,
        };
        updatedGlobalLogs = [structuredRecord, ...globalLogs];
      }
    } else {
      const structuredRecord: SuspensionHistoryRecord = {
        id: recordId,
        staffId: staff.id,
        employeeId: staff.employeeId || '',
        staffName: staff.name,
        department: staff.department || 'General',
        role: staff.role || 'Staff Member',
        category: 'Disciplinary Suspension',
        type: event.type,
        title,
        date: today,
        startDate: sDate,
        endDate: eDate,
        durationDays,
        reason: rsn,
        deductionPolicy,
        deductionAmount: event.deductionAmount || 0,
        dailyRate: event.dailyRate,
        calculationType: event.calculationType || 'none',
        penaltyRuleName: event.penaltyRuleName,
        notes,
        authorizedBy: auth,
        status: 'Currently Suspended',
        timestamp: nowIso,
      };
      updatedGlobalLogs = [structuredRecord, ...globalLogs];
    }

    saveCompanyData(STORAGE_KEYS.SUSPENSION_LOGS, updatedGlobalLogs, companyNameOrId);
  } catch (e) {
    console.error('Failed to log staff suspension history:', e);
  }
}

/**
 * Loads all company-wide suspension logs, combining global records and staff histories.
 * Deduplicates and consolidates so each suspension event is represented exactly once.
 */
export function getAllCompanySuspensionHistory(companyNameOrId?: string, staffList: StaffMember[] = []): SuspensionHistoryRecord[] {
  try {
    const globalLogs = loadCompanyData<SuspensionHistoryRecord[]>(STORAGE_KEYS.SUSPENSION_LOGS, companyNameOrId, []);
    const staffHistories = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyNameOrId, {});

    // Keyed by a stable compound identifier (staff identifier + approximate start date)
    const recordsMap = new Map<string, SuspensionHistoryRecord>();

    const getSuspensionKey = (rec: { staffId?: string; employeeId?: string; startDate?: string; date?: string }) => {
      const staffIdentifier = (rec.employeeId || rec.staffId || '').trim().toLowerCase();
      const sDate = (rec.startDate || rec.date || '').split('T')[0].trim();
      return `${staffIdentifier}_${sDate}`;
    };

    // 1. Add global logs first
    if (Array.isArray(globalLogs)) {
      globalLogs.forEach((rec) => {
        if (!rec || !rec.id) return;
        const key = getSuspensionKey(rec) || rec.id;
        const existing = recordsMap.get(key);

        if (!existing) {
          recordsMap.set(key, { ...rec });
        } else {
          // Merge: if this or existing is restored/ended, preserve the restored/ended status and notes
          const isRestored = rec.status === 'Restored' || rec.type === 'restored' || existing.status === 'Restored' || existing.type === 'restored';
          const isEnded = rec.status === 'Concluded' || rec.type === 'ended' || existing.status === 'Concluded' || existing.type === 'ended';
          existing.status = isRestored ? 'Restored' : isEnded ? 'Concluded' : existing.status;
          if (isRestored) existing.type = 'restored';
          if (rec.endDate && !existing.endDate) existing.endDate = rec.endDate;
          if (rec.notes && !existing.notes?.includes(rec.notes)) {
            existing.notes = `${existing.notes ? existing.notes + ' | ' : ''}${rec.notes}`;
          }
        }
      });
    }

    // 2. Extract any suspension records from individual staff histories without creating duplicates
    Object.entries(staffHistories).forEach(([staffKey, logs]) => {
      if (Array.isArray(logs)) {
        const staff = staffList.find((s) => s.employeeId === staffKey || s.id === staffKey);
        logs.forEach((log) => {
          if (log && (log.category === 'Disciplinary Suspension' || log.title?.includes('Suspension'))) {
            const key = getSuspensionKey({
              staffId: staff?.id || staffKey,
              employeeId: staff?.employeeId || staffKey,
              startDate: log.startDate || log.date,
            });

            const existing = recordsMap.get(key);
            if (!existing) {
              const isRestored = log.title?.includes('Restored') || log.status === 'Restored';
              const isEnded = log.title?.includes('Concluded') || log.status === 'Concluded';
              recordsMap.set(key, {
                id: log.id || `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                staffId: staff?.id || staffKey,
                employeeId: staff?.employeeId || staffKey,
                staffName: staff?.name || 'Staff Member',
                department: staff?.department || 'General',
                role: staff?.role || 'Staff Member',
                category: 'Disciplinary Suspension',
                type: isRestored ? 'restored' : isEnded ? 'ended' : 'created',
                title: log.title || 'Disciplinary Suspension',
                date: log.date || new Date().toISOString().split('T')[0],
                startDate: log.startDate || log.date || '',
                endDate: log.endDate || '',
                durationDays: log.durationDays || calculateSuspensionDays(log.startDate, log.endDate),
                reason: log.reason || 'Disciplinary workforce action',
                deductionPolicy: log.deductionPolicy || log.penaltyApplied || 'Pardoned (No Penalty)',
                deductionAmount: log.deductionAmount || 0,
                dailyRate: log.dailyRate,
                calculationType: log.calculationType || 'none',
                penaltyRuleName: log.penaltyRuleName,
                notes: log.notes || '',
                authorizedBy: log.authorizedBy || 'HR Management',
                status: isRestored ? 'Restored' : isEnded ? 'Concluded' : 'Currently Suspended',
                timestamp: log.timestamp || new Date().toISOString(),
              });
            } else {
              const isRestored = log.title?.includes('Restored') || log.status === 'Restored';
              const isEnded = log.title?.includes('Concluded') || log.status === 'Concluded';
              if (isRestored) {
                existing.status = 'Restored';
                existing.type = 'restored';
              } else if (isEnded && existing.status !== 'Restored') {
                existing.status = 'Concluded';
              }
              if (log.notes && !existing.notes?.includes(log.notes)) {
                existing.notes = `${existing.notes ? existing.notes + ' | ' : ''}${log.notes}`;
              }
            }
          }
        });
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // 3. Ensure all currently suspended staff members are registered in the records
    staffList.forEach((staff) => {
      const isSuspendedToday = isStaffSuspendedOnDate(staff, todayStr);
      if (isSuspendedToday || staff.status === 'Suspended') {
        const details = getStaffSuspensionDetails(staff, companyNameOrId);
        const sDate = (details.startDate || staff.suspensionStartDate || todayStr).split('T')[0];
        const eDate = (details.endDate || staff.suspensionEndDate || '').split('T')[0];
        const key = getSuspensionKey({
          staffId: staff.id,
          employeeId: staff.employeeId,
          startDate: sDate,
        });

        const existing = recordsMap.get(key) || Array.from(recordsMap.values()).find(
          (r) =>
            (r.staffId === staff.id || (r.employeeId && staff.employeeId && r.employeeId === staff.employeeId)) &&
            (r.status === 'Currently Suspended' || r.type === 'created' || r.type === 'updated')
        );

        const isActiveByDate = eDate ? eDate >= todayStr : sDate <= todayStr;
        const derivedStatus = isActiveByDate ? 'Currently Suspended' : 'Concluded';

        if (existing) {
          if (existing.status !== 'Restored') {
            existing.status = derivedStatus;
          }
          if (!existing.startDate && sDate) existing.startDate = sDate;
          if (!existing.endDate && eDate) existing.endDate = eDate;
        } else {
          const recordId = `active-susp-${staff.id}`;
          const durationDays = calculateSuspensionDays(sDate, eDate);
          recordsMap.set(key, {
            id: recordId,
            staffId: staff.id,
            employeeId: staff.employeeId || '',
            staffName: staff.name,
            department: staff.department || 'General',
            role: staff.role || 'Staff Member',
            category: 'Disciplinary Suspension',
            type: 'created',
            title: 'Disciplinary Suspension Registered',
            date: sDate || todayStr,
            startDate: sDate || todayStr,
            endDate: eDate || '',
            durationDays,
            reason: details.reason || staff.suspensionReason || 'Active disciplinary suspension',
            deductionPolicy: 'Standard Default Deduction',
            deductionAmount: 0,
            calculationType: 'none',
            notes: `Suspension period: ${sDate || 'Issuance'} to ${eDate || 'Indefinite'}.`,
            authorizedBy: 'HR Management',
            status: derivedStatus,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    const result = Array.from(recordsMap.values());

    // Normalize final status: Restored remains Restored, else check date
    result.forEach((rec) => {
      if (rec.status === 'Restored' || rec.type === 'restored' || rec.title?.toLowerCase().includes('restored')) {
        rec.status = 'Restored';
        return;
      }
      if (rec.status === 'Concluded' || rec.type === 'ended' || rec.title?.toLowerCase().includes('concluded')) {
        rec.status = 'Concluded';
        return;
      }
      const sDate = (rec.startDate || rec.date || '').split('T')[0].trim();
      const eDate = (rec.endDate || '').split('T')[0].trim();

      if (eDate) {
        if (eDate >= todayStr) {
          rec.status = 'Currently Suspended';
        } else {
          rec.status = 'Concluded';
        }
      } else if (sDate && sDate <= todayStr) {
        rec.status = 'Currently Suspended';
      } else {
        rec.status = 'Concluded';
      }
    });

    return result.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());
  } catch (e) {
    console.error('Failed to load all company suspension history:', e);
    return [];
  }
}

/**
 * Deletes an erroneous suspension log, restores staff member if needed, and removes any associated payroll fine deduction.
 */
export function deleteCompanySuspensionRecord(
  recordId: string,
  staffId: string,
  companyNameOrId?: string,
  restoreStaffToActive: boolean = true
): { success: boolean; staffRestored: boolean; penaltyRemoved: boolean; updatedStaffList?: StaffMember[] } {
  let penaltyRemoved = false;
  let staffRestored = false;
  let updatedStaffList: StaffMember[] | undefined = undefined;

  try {
    // 1. Remove from SUSPENSION_LOGS (global company logs)
    const globalLogs = loadCompanyData<SuspensionHistoryRecord[]>(STORAGE_KEYS.SUSPENSION_LOGS, companyNameOrId, []);
    const initialGlobalLen = globalLogs.length;
    const filteredGlobal = globalLogs.filter(
      (r) =>
        r.id !== recordId &&
        (r as any).recordId !== recordId &&
        !(recordId.startsWith('active-susp-') && (r.staffId === staffId || ('active-susp-' + r.staffId) === recordId))
    );
    if (filteredGlobal.length !== initialGlobalLen) {
      saveCompanyData(STORAGE_KEYS.SUSPENSION_LOGS, filteredGlobal, companyNameOrId);
    }

    // 2. Remove from STAFF_HISTORY (individual employee history logs)
    const historyMap = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyNameOrId, {});
    let updatedHistory = false;
    Object.keys(historyMap).forEach((sId) => {
      if (Array.isArray(historyMap[sId])) {
        const initialLen = historyMap[sId].length;
        historyMap[sId] = historyMap[sId].filter(
          (item) =>
            item.id !== recordId &&
            item.logId !== recordId &&
            item.recordId !== recordId &&
            !(
              recordId.startsWith('active-susp-') &&
              (item.category === 'Disciplinary Suspension' || item.title?.includes('Suspension')) &&
              (sId === staffId || item.staffId === staffId)
            )
        );
        if (historyMap[sId].length !== initialLen) {
          updatedHistory = true;
        }
      }
    });
    if (updatedHistory) {
      saveCompanyData(STORAGE_KEYS.STAFF_HISTORY, historyMap, companyNameOrId);
    }

    // 3. Remove / Void any booked penalty associated with this suspension in PayrollConfig
    const payrollConfig = loadCompanyPayrollConfig(companyNameOrId);
    if (payrollConfig.bookedPenalties && payrollConfig.bookedPenalties.length > 0) {
      const initialCount = payrollConfig.bookedPenalties.length;
      const filtered = payrollConfig.bookedPenalties.filter(
        (p) =>
          !(
            (p.staffId === staffId || p.id === recordId) &&
            (p.reason?.toLowerCase().includes('suspension') ||
              p.penaltyRuleId === 'suspension-default-deduction' ||
              p.penaltyRuleId?.includes('suspension') ||
              (p as any).suspensionRecordId === recordId ||
              p.id === recordId)
          )
      );
      if (filtered.length !== initialCount) {
        payrollConfig.bookedPenalties = filtered;
        saveCompanyPayrollConfig(payrollConfig, companyNameOrId);
        penaltyRemoved = true;
      }
    }

    // 4. Restore staff member status and clear suspension parameters if currently marked suspended
    if (restoreStaffToActive) {
      const staffList = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, companyNameOrId, []);
      const targetIndex = staffList.findIndex(
        (s) => s.id === staffId || s.employeeId === staffId || ('active-susp-' + s.id) === recordId
      );
      if (targetIndex !== -1) {
        staffList[targetIndex] = {
          ...staffList[targetIndex],
          status: 'Active',
          suspensionStartDate: undefined,
          suspensionEndDate: undefined,
          suspensionEndTime: undefined,
          suspensionReason: undefined,
          suspensionDeductedDays: undefined,
          suspensionLastSettledDate: undefined,
        };
        saveCompanyData(STORAGE_KEYS.STAFF, staffList, companyNameOrId);
        staffRestored = true;
        updatedStaffList = staffList;
      }
    }

    return { success: true, staffRestored, penaltyRemoved, updatedStaffList };
  } catch (err) {
    console.error('Error deleting suspension record:', err);
    return { success: false, staffRestored: false, penaltyRemoved: false };
  }
}

/**
 * Loads all company queries.
 */
export function loadCompanyQueries(companyNameOrId?: string): QueryRecord[] {
  try {
    const list = loadCompanyData<QueryRecord[]>(STORAGE_KEYS.QUERIES, companyNameOrId, []);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Saves company queries list.
 */
export function saveCompanyQueries(queries: QueryRecord[], companyNameOrId?: string): void {
  saveCompanyData(STORAGE_KEYS.QUERIES, queries, companyNameOrId);
}

/**
 * Gets warnings count for a staff member in a given calendar year (max 3 allowed per year).
 */
export function getStaffYearlyWarningCount(
  staffId: string,
  year: number = new Date().getFullYear(),
  companyNameOrId?: string
): number {
  const queries = loadCompanyQueries(companyNameOrId);
  return queries.filter((q) => {
    if (q.staffId !== staffId && q.employeeId !== staffId) return false;
    if (q.verdict !== 'warning') return false;
    const itemYear = q.verdictDetails?.warningYear || (q.closedAt ? new Date(q.closedAt).getFullYear() : new Date(q.issuedAt).getFullYear());
    return itemYear === year;
  }).length;
}

/**
 * Checks if a staff member currently has an active pending query.
 */
export function isStaffCurrentlyOnQuery(
  staffId: string,
  companyNameOrId?: string
): boolean {
  const queries = loadCompanyQueries(companyNameOrId);
  return queries.some((q) => (q.staffId === staffId || q.employeeId === staffId) && q.status === 'pending');
}


