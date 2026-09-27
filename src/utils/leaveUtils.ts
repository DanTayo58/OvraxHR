import { LeaveRequest, StaffMember } from '../types';
import { isStaffSuspendedOnDate, isStaffSuspensionEnded } from './staffUtils';

/**
 * Returns today's date in local YYYY-MM-DD format.
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the date-sensitive status of a leave:
 * - 'Ended': when the endDate is strictly before target date (past/completed)
 * - 'Pending': when the startDate is strictly after target date (future/upcoming)
 * - 'Ongoing': when startDate <= target date and endDate >= target date (active today)
 */
export function getComputedLeaveStatus(
  startDate?: string,
  endDate?: string,
  targetDate?: string
): 'Ongoing' | 'Pending' | 'Ended' {
  const today = targetDate || getTodayDateString();
  const start = (startDate || '').trim();
  const end = (endDate || '').trim();

  // If the end date is before the current date, automatically set to Ended
  if (end && end < today) {
    return 'Ended';
  }

  // If the start date is set ahead of current date, status is Pending
  if (start && start > today) {
    return 'Pending';
  }

  // Otherwise, the date range spans today (start <= today and end >= today) -> Ongoing
  return 'Ongoing';
}

/**
 * Determines whether a leave record has ended.
 * A leave has ended if:
 * 1. It was explicitly marked with leaveStatus = 'Ended'
 * 2. Its approval status was 'Rejected'
 * 3. Its endDate is strictly before targetDate (today by default).
 */
export function isLeaveEnded(leave?: LeaveRequest | null, targetDate?: string): boolean {
  if (!leave) return true;
  if (leave.status === 'Rejected') return true;

  const today = targetDate || getTodayDateString();
  if (leave.endDate && leave.endDate.trim()) {
    const cleanEndDate = leave.endDate.trim();
    if (cleanEndDate < today) {
      return true;
    }
  }

  if (
    leave.leaveStatus === 'Ended' ||
    leave.leaveStatus === 'Restored' ||
    leave.leaveStatus === 'Concluded'
  ) {
    return true;
  }

  return false;
}

/**
 * Determines whether a leave is pending (scheduled for a future start date).
 */
export function isLeavePending(leave?: LeaveRequest | null, targetDate?: string): boolean {
  if (!leave) return false;
  if (leave.status === 'Rejected') return false;
  const today = targetDate || getTodayDateString();

  if (isLeaveEnded(leave, today)) return false;

  if (leave.startDate && leave.startDate.trim() > today) {
    return true;
  }

  return leave.leaveStatus === 'Pending' && (!leave.startDate || leave.startDate.trim() > today);
}

/**
 * Determines whether a leave is upcoming (alias to isLeavePending).
 */
export function isLeaveUpcoming(leave?: LeaveRequest | null, targetDate?: string): boolean {
  return isLeavePending(leave, targetDate);
}

/**
 * Determines whether a leave is currently ongoing (active today).
 * Must not be ended, must not be pending (future), must not be rejected,
 * and today must fall between startDate and endDate.
 */
export function isLeaveOngoing(leave?: LeaveRequest | null, targetDate?: string): boolean {
  if (!leave) return false;
  const today = targetDate || getTodayDateString();

  if (isLeaveEnded(leave, today)) return false;
  if (isLeavePending(leave, today)) return false;
  if (leave.status && leave.status !== 'Approved') return false;

  const start = (leave.startDate || '').trim();
  const end = (leave.endDate || '').trim();

  // If start is in the future, it's not ongoing yet
  if (start && start > today) return false;

  // If end is in the past, it has ended
  if (end && end < today) return false;

  return true;
}

/**
 * Determines whether a leave is currently active (alias to isLeaveOngoing).
 */
export function isLeaveCurrentlyActive(leave?: LeaveRequest | null, targetDate?: string): boolean {
  return isLeaveOngoing(leave, targetDate);
}

/**
 * Finds the currently active ongoing leave for a given staff member, if any.
 */
export function getActiveLeaveForStaff(
  staff: StaffMember,
  leaves: LeaveRequest[] = [],
  targetDate?: string
): LeaveRequest | undefined {
  if (!staff || !leaves || leaves.length === 0) return undefined;
  const today = targetDate || getTodayDateString();

  const staffIdLower = (staff.employeeId || staff.id || '').trim().toLowerCase();
  const staffNameLower = (staff.name || '').trim().toLowerCase();

  return leaves.find((l) => {
    const leaveEmpId = (l.employeeId || '').trim().toLowerCase();
    const leaveEmpName = (l.employeeName || '').trim().toLowerCase();

    const isMatch =
      (leaveEmpId && (leaveEmpId === staffIdLower || leaveEmpId === (staff.id || '').toLowerCase())) ||
      (leaveEmpName && staffNameLower && leaveEmpName === staffNameLower);

    if (!isMatch) return false;
    return isLeaveOngoing(l, today);
  });
}

/**
 * Checks whether a staff member is currently on an active ongoing leave today.
 */
export function isStaffCurrentlyOnLeave(
  staff: StaffMember,
  leaves: LeaveRequest[] = [],
  targetDate?: string
): boolean {
  return !!getActiveLeaveForStaff(staff, leaves, targetDate);
}

/**
 * Automatically reconciles staff status, leave records, and suspension timelines based on current date.
 * - Leaves past their endDate are automatically set to leaveStatus: 'Ended'.
 * - Leaves whose startDate is ahead of current date are set to leaveStatus: 'Pending'.
 * - Leaves whose dates span current date (startDate <= today and endDate >= today) are set to 'Ongoing'.
 * - When a leave's start date arrives, its status automatically changes to 'Ongoing' and staff status becomes 'On Leave'.
 * - When a leave's end date passes, its status is automatically set to 'Ended' and staff status is restored to 'Active'.
 * - Suspended staff whose suspensionEndDate has passed are restored to 'Active' (or 'On Leave' if active leave exists).
 * - Staff whose status is 'On Leave' but have NO active ongoing leave are restored to 'Active'.
 * - Staff whose status is 'Active' or 'Off Duty' but HAVE an active ongoing leave are updated to 'On Leave'.
 * - Exited staff statuses are strictly preserved.
 */
export function reconcileStaffAndLeaves(
  staffList: StaffMember[],
  leaves: LeaveRequest[],
  targetDate?: string
): {
  updatedStaff: StaffMember[];
  updatedLeaves: LeaveRequest[];
  hasStaffChanged: boolean;
  hasLeavesChanged: boolean;
} {
  const today = targetDate || getTodayDateString();

  let hasLeavesChanged = false;
  const updatedLeaves = leaves.map((l) => {
    if (l.status === 'Rejected') {
      if (l.leaveStatus !== 'Ended') {
        hasLeavesChanged = true;
        return { ...l, leaveStatus: 'Ended' as const };
      }
      return l;
    }

    const computedStatus = getComputedLeaveStatus(l.startDate, l.endDate, today);

    // If leaveStatus is different from computed date-sensitive status, update it
    if (l.leaveStatus !== computedStatus) {
      hasLeavesChanged = true;
      return { ...l, leaveStatus: computedStatus };
    }

    return l;
  });

  let hasStaffChanged = false;
  const updatedStaff = staffList.map((staff) => {
    // Exited staff status is strictly preserved
    if (staff.status === 'Exited') {
      return staff;
    }

    // 1. Suspension timeframe reconciliation
    if (staff.status === 'Suspended') {
      if (isStaffSuspensionEnded(staff, today)) {
        hasStaffChanged = true;
        const hasActiveLeave = isStaffCurrentlyOnLeave(staff, updatedLeaves, today);
        return {
          ...staff,
          status: hasActiveLeave ? ('On Leave' as const) : ('Active' as const),
        };
      }
      return staff;
    }

    // If staff has active suspension dates today
    if (isStaffSuspendedOnDate(staff, today)) {
      hasStaffChanged = true;
      return { ...staff, status: 'Suspended' as const };
    }

    // 2. Leave status reconciliation based on active ONGOING leave today
    const hasActiveLeave = isStaffCurrentlyOnLeave(staff, updatedLeaves, today);

    if (staff.status === 'On Leave' && !hasActiveLeave) {
      hasStaffChanged = true;
      return { ...staff, status: 'Active' as const };
    }

    if ((staff.status === 'Active' || staff.status === 'Off Duty') && hasActiveLeave) {
      hasStaffChanged = true;
      return { ...staff, status: 'On Leave' as const };
    }

    return staff;
  });

  return {
    updatedStaff,
    updatedLeaves,
    hasStaffChanged,
    hasLeavesChanged,
  };
}
