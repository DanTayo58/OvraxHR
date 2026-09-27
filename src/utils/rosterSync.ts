import { StaffMember, ProjectFile, AttendanceRecord } from '../types';

/**
 * Synchronizes Staff Directory list and Project Attendance records bidirectionally.
 * 1. Unmapped personnel in attendance files are registered into the Staff Directory.
 * 2. Active personnel in the Staff Directory missing from attendance files are added to attendance records as 'Absent' entries for every day of the month.
 * 3. Employee names and departments are updated across attendance records if modified in the Staff Directory.
 */
export function syncStaffAndProjects(
  currentStaffList: StaffMember[],
  currentProjects: ProjectFile[]
): {
  updatedStaffList: StaffMember[];
  updatedProjects: ProjectFile[];
  syncedStaffCount: number;
  syncedRecordsCount: number;
} {
  const norm = (str?: string) => (str || '').trim().toLowerCase();

  let updatedStaffList: StaffMember[] = [...currentStaffList];
  let updatedProjects: ProjectFile[] = [...currentProjects];
  let syncedStaffCount = 0;
  let syncedRecordsCount = 0;

  // 1. Sync unmapped attendance personnel from ALL projects into updatedStaffList
  updatedProjects.forEach((project) => {
    if (!project.records || project.records.length === 0) return;

    // Collect unique attendance personnel from project records
    const uniqueAttendanceMap = new Map<
      string,
      { employeeId: string; name: string; department: string; shift: string }
    >();

    project.records.forEach((rec, idx) => {
      const empId = rec.employeeId || `SKM-${idx + 101}`;
      const name = rec.employeeName || 'Staff Member';
      const key = norm(empId) || norm(name);

      if (key && !uniqueAttendanceMap.has(key)) {
        uniqueAttendanceMap.set(key, {
          employeeId: empId,
          name: name,
          department: rec.department || 'HQ Operations',
          shift: rec.shift || 'Morning',
        });
      }
    });

    uniqueAttendanceMap.forEach((attItem) => {
      const attId = norm(attItem.employeeId);
      const attName = norm(attItem.name);

      // Check if this attendance staff exists in updatedStaffList primarily by ID
      const existingIndex = updatedStaffList.findIndex((g) => {
        const gEmpId = norm(g.employeeId);
        const gId = norm(g.id);
        if (attId && (gEmpId === attId || gId === attId)) return true;
        // Fallback match only if attendance record has no valid ID
        if (!attId && attName && norm(g.name) === attName) return true;
        return false;
      });

      if (existingIndex >= 0) {
        // Update existing staff member's info if missing
        const existing = updatedStaffList[existingIndex];
        updatedStaffList[existingIndex] = {
          ...existing,
          employeeId: existing.employeeId || attItem.employeeId,
          department: existing.department || attItem.department,
          shiftSchedule: existing.shiftSchedule || attItem.shift,
        };
      } else {
        // Register new staff member in staff directory
        updatedStaffList.push({
          id: `staff-synced-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          employeeId: attItem.employeeId,
          name: attItem.name,
          department: attItem.department,
          role: 'Operations Staff',
          email: `${attItem.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`,
          payGrade: 'Grade L2',
          estimatedMonthlySalary: 3200,
          shiftSchedule: attItem.shift || 'Morning',
          status: 'Active',
          joinDate: new Date().toISOString().split('T')[0],
        });
        syncedStaffCount++;
      }
    });
  });

  // Ensure unique IDs in updatedStaffList
  const seenStaffIds = new Set<string>();
  updatedStaffList = updatedStaffList.map((s, idx) => {
    let id = s.id;
    if (!id || seenStaffIds.has(id)) {
      id = `staff-${idx}-${Math.random().toString(36).substring(2, 6)}`;
    }
    seenStaffIds.add(id);
    return id === s.id ? s : { ...s, id };
  });

  // 2. Sync active staff from updatedStaffList into each Project's records
  const activeStaffList = updatedStaffList.filter((s) => s.status !== 'Exited');

  updatedProjects = updatedProjects.map((project) => {
    const [yearStr, monthStr] = (project.monthYear || '2026-08').split('-');
    const calcYear = parseInt(yearStr) || 2026;
    const calcMonth = parseInt(monthStr) || 8;
    const daysInMonth = project.daysInMonth || new Date(calcYear, calcMonth, 0).getDate() || 31;
    const monthYear = project.monthYear || `${calcYear}-${String(calcMonth).padStart(2, '0')}`;
    const resumptionTime = project.fileResumptionTime || '08:00';

    let currentRecords = [...(project.records || [])];

    activeStaffList.forEach((st) => {
      const stEmpId = norm(st.employeeId);
      const stId = norm(st.id);
      const stName = norm(st.name);

      // Check if this active staff exists in project.records primarily by ID
      const hasRecords = currentRecords.some((r) => {
        const rEmpId = norm(r.employeeId);
        if (stEmpId && rEmpId && rEmpId === stEmpId) return true;
        if (stId && rEmpId && rEmpId === stId) return true;
        if (!stEmpId && !stId && stName && norm(r.employeeName) === stName) return true;
        return false;
      });

      if (!hasRecords) {
        // Generate records for missing active staff member for all days in month
        const newStaffRecords: AttendanceRecord[] = [];
        const normJoinDate = st.joinDate ? st.joinDate.trim() : '';
        for (let day = 1; day <= daysInMonth; day++) {
          const formattedDay = day < 10 ? `0${day}` : `${day}`;
          const dayDate = `${monthYear}-${formattedDay}`;
          const isPreEmployment = Boolean(normJoinDate && dayDate < normJoinDate);
          newStaffRecords.push({
            id: `rec-synced-${st.employeeId || st.id}-${day}-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
            employeeId: st.employeeId || st.id,
            employeeName: st.name,
            department: st.department || 'HQ Operations',
            shift: st.shiftSchedule || 'Morning',
            date: dayDate,
            scheduledIn: resumptionTime,
            clockIn: '',
            clockOut: '',
            totalHours: 0,
            status: isPreEmployment ? 'On Leave' : 'Absent',
            notes: isPreEmployment ? 'Pre-Employment (Joined mid-month)' : undefined,
            dayNumber: day,
          });
          syncedRecordsCount++;
        }
        currentRecords = [...currentRecords, ...newStaffRecords];
      } else {
        // Keep employeeName and department updated in existing records
        currentRecords = currentRecords.map((r) => {
          const rEmpId = norm(r.employeeId);
          const isMatch =
            (stEmpId && rEmpId && rEmpId === stEmpId) ||
            (stId && rEmpId && rEmpId === stId) ||
            (!stEmpId && !stId && stName && norm(r.employeeName) === stName);

          if (isMatch) {
            return {
              ...r,
              employeeName: st.name || r.employeeName,
              department: st.department || r.department,
            };
          }
          return r;
        });
      }
    });

    const uniqueStaffCountInProject = new Set(currentRecords.map((r) => r.employeeId)).size;

    return {
      ...project,
      records: currentRecords,
      staffCount: uniqueStaffCountInProject,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    updatedStaffList,
    updatedProjects,
    syncedStaffCount,
    syncedRecordsCount,
  };
}
