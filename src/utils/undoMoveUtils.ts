import { StaffMember } from '../types';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from './companyStorage';
import { DepartmentTransferRecord } from '../components/DepartmentsView';

export interface LastMoveDetails {
  record: DepartmentTransferRecord;
  staffMember?: StaffMember;
  staffName: string;
  employeeId: string;
  currentDepartment: string;
  destinationDepartment: string;
  currentRole?: string;
  revertedRole?: string;
  currentSalary?: number;
  revertedSalary?: number;
  effectiveDate: string;
  reason: string;
}

/**
 * Retrieves the latest unreversed department move / transfer from storage.
 */
export function getLastMoveRecord(
  companyName: string,
  staffList: StaffMember[] = []
): LastMoveDetails | null {
  if (!companyName) return null;

  try {
    const transfers = loadCompanyData<DepartmentTransferRecord[]>(
      STORAGE_KEYS.TRANSFERS,
      companyName,
      []
    );

    if (!Array.isArray(transfers) || transfers.length === 0) {
      return null;
    }

    // Find the latest transfer that has not already been undone
    const lastUnreversed = transfers.find((t) => !t.isReversed);
    if (!lastUnreversed) {
      return null;
    }

    const staff = staffList.find(
      (s) =>
        (lastUnreversed.employeeId &&
          s.employeeId &&
          s.employeeId.toUpperCase() !== 'N/A' &&
          s.employeeId.toLowerCase() === lastUnreversed.employeeId.toLowerCase()) ||
        s.name.trim().toLowerCase() === lastUnreversed.staffName.trim().toLowerCase()
    );

    return {
      record: lastUnreversed,
      staffMember: staff,
      staffName: staff?.name || lastUnreversed.staffName,
      employeeId: staff?.employeeId || lastUnreversed.employeeId || 'N/A',
      currentDepartment: staff?.department || lastUnreversed.toDepartment,
      destinationDepartment: lastUnreversed.fromDepartment,
      currentRole: staff?.role || lastUnreversed.toRole,
      revertedRole: lastUnreversed.fromRole || 'Staff Member',
      currentSalary: staff?.estimatedMonthlySalary,
      revertedSalary: lastUnreversed.previousSalary,
      effectiveDate: lastUnreversed.effectiveDate,
      reason: lastUnreversed.reason,
    };
  } catch (err) {
    console.error('Failed to get last move record:', err);
    return null;
  }
}

/**
 * Reverts the most recent move / transfer:
 * - Restores the staff member to their previous department, role, and salary.
 * - Updates staff directory state and storage.
 * - Marks the transfer record as reversed.
 * - Logs audit record to employee history.
 * - Triggers cross-component synchronization events.
 */
export function executeUndoLastMove(
  companyName: string,
  staffList: StaffMember[],
  onUpdateStaffList: (updated: StaffMember[]) => void,
  actorName: string = 'HR Admin'
): { success: boolean; message: string; undoneRecord?: DepartmentTransferRecord } {
  if (!companyName) {
    return { success: false, message: 'No active company session found.' };
  }

  try {
    const transfers = loadCompanyData<DepartmentTransferRecord[]>(
      STORAGE_KEYS.TRANSFERS,
      companyName,
      []
    );

    if (!Array.isArray(transfers) || transfers.length === 0) {
      return { success: false, message: 'No recent moves found to undo.' };
    }

    const targetIdx = transfers.findIndex((t) => !t.isReversed);
    if (targetIdx === -1) {
      return { success: false, message: 'All recent moves have already been undone.' };
    }

    const recordToRevert = transfers[targetIdx];

    // Find the staff member
    const staff = staffList.find(
      (s) =>
        (recordToRevert.employeeId &&
          s.employeeId &&
          s.employeeId.toUpperCase() !== 'N/A' &&
          s.employeeId.toLowerCase() === recordToRevert.employeeId.toLowerCase()) ||
        s.name.trim().toLowerCase() === recordToRevert.staffName.trim().toLowerCase()
    );

    const originalFromDept = recordToRevert.fromDepartment || 'General';
    const originalFromRole = recordToRevert.fromRole || staff?.role || 'Staff Member';
    const originalPrevSalary =
      recordToRevert.previousSalary !== undefined
        ? recordToRevert.previousSalary
        : staff?.estimatedMonthlySalary || 0;

    let updatedList = staffList;

    if (staff) {
      updatedList = staffList.map((s) => {
        if (s.id === staff.id) {
          return {
            ...s,
            department: originalFromDept,
            role: originalFromRole,
            estimatedMonthlySalary: originalPrevSalary,
          };
        }
        return s;
      });

      onUpdateStaffList(updatedList);
      saveCompanyData(STORAGE_KEYS.STAFF, updatedList, companyName);
    }

    // Mark the transfer as reversed in transfers history
    const updatedTransfers = transfers.map((t, idx) => {
      if (idx === targetIdx) {
        return {
          ...t,
          isReversed: true,
          reversedAt: new Date().toISOString(),
          reversedBy: actorName,
        };
      }
      return t;
    });

    saveCompanyData(STORAGE_KEYS.TRANSFERS, updatedTransfers, companyName);

    // Add audit entry in staff history
    if (staff) {
      try {
        const staffKey = staff.employeeId && staff.employeeId.toUpperCase() !== 'N/A'
          ? staff.employeeId
          : staff.id;
        const allHistory = loadCompanyData<Record<string, any[]>>(
          STORAGE_KEYS.STAFF_HISTORY,
          companyName,
          {}
        );
        const employeeLogs = allHistory[staffKey] || [];
        const auditLog = {
          id: `audit-undomove-${Date.now()}`,
          category: 'Department Transfer Reversal',
          title: `Move Undone: Returned to ${originalFromDept}`,
          date: new Date().toISOString().split('T')[0],
          notes: `Previous department transfer to "${recordToRevert.toDepartment}" was undone by ${actorName}. Restored to "${originalFromDept}" as "${originalFromRole}".`,
          authorizedBy: actorName,
        };
        saveCompanyData(
          STORAGE_KEYS.STAFF_HISTORY,
          {
            ...allHistory,
            [staffKey]: [auditLog, ...employeeLogs],
          },
          companyName
        );
      } catch (logErr) {
        console.warn('Failed to write staff history audit on undo move:', logErr);
      }
    }

    // Dispatch global events for real-time reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skima_transfers_updated'));
      window.dispatchEvent(new CustomEvent('skima_move_undone', { detail: recordToRevert }));
    }

    return {
      success: true,
      message: `Undid last move: "${recordToRevert.staffName}" returned from ${recordToRevert.toDepartment} back to ${originalFromDept}.`,
      undoneRecord: recordToRevert,
    };
  } catch (err: any) {
    console.error('Failed to undo last move:', err);
    return {
      success: false,
      message: err?.message || 'Failed to undo move due to an unexpected error.',
    };
  }
}
