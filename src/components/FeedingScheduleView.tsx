import React, { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Search,
  Calendar,
  Sparkles,
  Download,
  Users,
  XCircle,
  Coffee,
  Check,
  RefreshCw,
  AlertCircle,
  X,
  Copy,
  Building2,
  ArrowUpDown,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { StaffMember, AppSettings, LeaveRequest, User } from '../types';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from '../utils/companyStorage';
import { getActiveOrganizationName } from '../utils/documentTemplates';
import { getStaffSuspensionDetails } from '../utils/staffUtils';

export type FeedingSortField = 'name' | 'employeeId' | 'department' | 'shift' | 'fedStatus';

export interface FeedingSortRule {
  id: string;
  field: FeedingSortField;
  direction: 'asc' | 'desc';
}

const FEEDING_FIELD_LABELS: Record<FeedingSortField, string> = {
  name: 'Staff Name',
  employeeId: 'Employee ID',
  department: 'Department',
  shift: 'Assigned Shift',
  fedStatus: 'Meal Status',
};

interface FeedingScheduleViewProps {
  staffList: StaffMember[];
  isLight?: boolean;
  settings?: AppSettings;
  leaves?: LeaveRequest[];
  user?: User;
}

const STORAGE_KEY = 'skima_feeding_schedule_v2';

export const FeedingScheduleView: React.FC<FeedingScheduleViewProps> = ({
  staffList,
  isLight = false,
  settings,
  leaves = [],
  user,
}) => {
  const companyName =
    (user?.company && user.company.trim()) ||
    (settings?.companyName && settings.companyName.trim()) ||
    getActiveOrganizationName(settings);
  // Configured Dynamic Shifts from settings
  const configuredShifts = (settings?.shifts && settings.shifts.length > 0)
    ? settings.shifts
    : [
        { id: '1', name: 'Morning Shift', startTime: '08:00', endTime: '17:00', gracePeriodMinutes: 15 },
        { id: '2', name: 'Afternoon Shift', startTime: '14:00', endTime: '22:00', gracePeriodMinutes: 10 },
        { id: '3', name: 'Night Shift', startTime: '22:00', endTime: '06:00', gracePeriodMinutes: 15 },
      ];

  // Filter out "Dynamic Shift" from shift filter buttons bar
  const shiftOptions = [
    'All',
    ...configuredShifts
      .map((s) => s.name)
      .filter((name) => !/dynamic/i.test(name)),
  ];

  // Helper to check if current time falls within shift window
  const isCurrentTimeInShift = (startTime: string, endTime: string) => {
    if (!startTime || !endTime || startTime === 'N/A' || startTime === 'Auto' || startTime === 'Custom') return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return false;
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);
    
    if (startMins <= endMins) {
      // Normal daytime shift (e.g. 08:00 - 17:00)
      return currentMins >= startMins && currentMins <= endMins;
    } else {
      // Overnight shift (e.g. 22:00 - 06:00)
      return currentMins >= startMins || currentMins <= endMins;
    }
  };

  // Determine active shift(s) for current time based on configured shift time windows
  const activeNowShifts = configuredShifts.filter(
    (s) => !/dynamic/i.test(s.name) && isCurrentTimeInShift(s.startTime, s.endTime)
  );

  // Default to active shift if available, or first configured shift, or All
  const [selectedShift, setSelectedShift] = useState<string>(
    activeNowShifts[0]?.name || configuredShifts[0]?.name || 'All'
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [sortRules, setSortRules] = useState<FeedingSortRule[]>([]); // Default empty on first launch
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortContainerRef.current &&
        !sortContainerRef.current.contains(event.target as Node)
      ) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Department Filter options derived from staff list
  const departmentOptions = [
    'All',
    ...Array.from(
      new Set(staffList.map((s) => (s.department || 'Unassigned').trim()).filter(Boolean))
    ).sort(),
  ];

  // Daily Feeding Records state: { [dateStr]: { [employeeId]: boolean } }
  const [feedingRecords, setFeedingRecords] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      return loadCompanyData<Record<string, Record<string, boolean>>>(STORAGE_KEYS.FEEDING, companyName, {}) || {};
    } catch (e) {
      console.error('Failed to parse feeding records:', e);
    }
    return {};
  });

  const activeCompanyRef = useRef(companyName);
  useEffect(() => {
    if (activeCompanyRef.current !== companyName) {
      activeCompanyRef.current = companyName;
      const loaded = loadCompanyData<Record<string, Record<string, boolean>>>(STORAGE_KEYS.FEEDING, companyName, {}) || {};
      setFeedingRecords(loaded);
    }
  }, [companyName]);

  // Save feeding records to company-scoped storage
  useEffect(() => {
    if (activeCompanyRef.current === companyName) {
      saveCompanyData(STORAGE_KEYS.FEEDING, feedingRecords, companyName);
    }
  }, [feedingRecords, companyName]);

  // Current day's fed map: { [employeeId]: boolean }
  const currentDayFedMap = feedingRecords[selectedDate] || {};

  // Approved leaves from props or company storage
  const targetLeaves: LeaveRequest[] = leaves && leaves.length > 0 ? leaves : (() => {
    try {
      return loadCompanyData<LeaveRequest[]>(STORAGE_KEYS.LEAVES, companyName, []);
    } catch (e) {
      return [];
    }
  })();

  // Helper to determine suspension info for a staff member on target date
  const getStaffSuspensionInfo = (staff: StaffMember, dateStr: string) => {
    if (staff.status === 'Exited') {
      return { isSuspended: false, endDate: '' };
    }

    const details = getStaffSuspensionDetails(staff, companyName);
    const eDate = (details.endDate || staff.suspensionEndDate || '').trim();
    const sDate = (details.startDate || staff.suspensionStartDate || '').trim();

    if (sDate && eDate) {
      const isOngoing = dateStr >= sDate && dateStr <= eDate;
      return { isSuspended: isOngoing, endDate: eDate };
    }
    if (eDate) {
      const isOngoing = dateStr <= eDate;
      return { isSuspended: isOngoing, endDate: eDate };
    }
    if (sDate) {
      const isOngoing = dateStr >= sDate;
      return { isSuspended: isOngoing, endDate: '' };
    }

    if (staff.status === 'Suspended') {
      return { isSuspended: true, endDate: eDate };
    }

    return { isSuspended: false, endDate: '' };
  };

  // Helper to determine leave info for a staff member on target date
  const getStaffLeaveInfo = (staff: StaffMember, dateStr: string) => {
    if (staff.status === 'Exited') {
      return { isOnLeave: false, endDate: '', leaveType: '', hasUpcomingLeave: false, upcomingStartDate: '', upcomingEndDate: '', upcomingLeaveType: '' };
    }

    const staffIdLower = (staff.employeeId || staff.id || '').trim().toLowerCase();
    const staffNameLower = (staff.name || '').trim().toLowerCase();

    // Find any matching approved/ongoing leave in targetLeaves
    const matchingLeave = targetLeaves.find((l) => {
      const leaveEmpId = (l.employeeId || '').trim().toLowerCase();
      const leaveEmpName = (l.employeeName || '').trim().toLowerCase();
      const isMatch =
        (leaveEmpId && (leaveEmpId === staffIdLower || leaveEmpId === (staff.id || '').toLowerCase())) ||
        (leaveEmpName && staffNameLower && leaveEmpName === staffNameLower);
      if (!isMatch) return false;
      if (l.status === 'Rejected') return false;
      if (l.leaveStatus === 'Ended' || l.leaveStatus === 'Restored') return false;

      const start = (l.startDate || '').trim();
      const end = (l.endDate || '').trim();
      if (start && end) {
        return dateStr >= start && dateStr <= end;
      }
      if (start && !end) {
        return dateStr >= start;
      }
      if (!start && end) {
        return dateStr <= end;
      }
      return true;
    });

    // Check for upcoming leave scheduled in the future after dateStr
    const upcomingLeaves = targetLeaves
      .filter((l) => {
        const leaveEmpId = (l.employeeId || '').trim().toLowerCase();
        const leaveEmpName = (l.employeeName || '').trim().toLowerCase();
        const isMatch =
          (leaveEmpId && (leaveEmpId === staffIdLower || leaveEmpId === (staff.id || '').toLowerCase())) ||
          (leaveEmpName && staffNameLower && leaveEmpName === staffNameLower);
        if (!isMatch) return false;
        if (l.status === 'Rejected') return false;
        if (l.leaveStatus === 'Ended' || l.leaveStatus === 'Restored') return false;

        const start = (l.startDate || '').trim();
        return start > dateStr;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    const upcomingLeave = upcomingLeaves[0];

    if (matchingLeave) {
      return {
        isOnLeave: true,
        endDate: (matchingLeave.endDate || '').trim(),
        leaveType: matchingLeave.leaveType || 'Leave',
        hasUpcomingLeave: !!upcomingLeave,
        upcomingStartDate: upcomingLeave?.startDate || '',
        upcomingEndDate: upcomingLeave?.endDate || '',
        upcomingLeaveType: upcomingLeave?.leaveType || '',
      };
    }

    // Fallback: If staff status is explicitly 'On Leave'
    if (staff.status === 'On Leave' || /leave/i.test(staff.status || '')) {
      const anyStaffLeave = targetLeaves.find((l) => {
        const leaveEmpId = (l.employeeId || '').trim().toLowerCase();
        const leaveEmpName = (l.employeeName || '').trim().toLowerCase();
        return (
          (leaveEmpId && (leaveEmpId === staffIdLower || leaveEmpId === (staff.id || '').toLowerCase())) ||
          (leaveEmpName && staffNameLower && leaveEmpName === staffNameLower)
        );
      });
      return {
        isOnLeave: true,
        endDate: (anyStaffLeave?.endDate || '').trim(),
        leaveType: anyStaffLeave?.leaveType || 'Leave',
        hasUpcomingLeave: !!upcomingLeave,
        upcomingStartDate: upcomingLeave?.startDate || '',
        upcomingEndDate: upcomingLeave?.endDate || '',
        upcomingLeaveType: upcomingLeave?.leaveType || '',
      };
    }

    return {
      isOnLeave: false,
      endDate: '',
      leaveType: '',
      hasUpcomingLeave: !!upcomingLeave,
      upcomingStartDate: upcomingLeave?.startDate || '',
      upcomingEndDate: upcomingLeave?.endDate || '',
      upcomingLeaveType: upcomingLeave?.leaveType || '',
    };
  };

  // Active roster includes all non-exited staff (including suspended and on-leave personnel)
  // Exited staff (who have left the organization) are permanently excluded.
  const activeStaff = staffList.filter((s) => s.status !== 'Exited');

  // Filter staff assigned to selected department and shift.
  // RULE: Staff assigned to "Dynamic Shift" function across every shift schedule,
  // so if any shift is selected, staff set to dynamic shift will appear in them regardless!
  const shiftStaff = activeStaff.filter((s) => {
    // Department Filter Check
    if (selectedDepartment !== 'All') {
      const dept = (s.department || 'Unassigned').toLowerCase().trim();
      if (dept !== selectedDepartment.toLowerCase().trim()) {
        return false;
      }
    }

    if (selectedShift === 'All') return true;
    const staffShift = (s.shiftSchedule || '').toLowerCase().trim();
    const targetShift = selectedShift.toLowerCase().trim();

    // Direct match
    if (staffShift.includes(targetShift) || targetShift.includes(staffShift)) {
      return true;
    }

    // Dynamic schedule personnel function across all shifts
    if (staffShift.includes('dynamic')) {
      return true;
    }

    return false;
  });

  // Search and status filter
  const filteredStaff = shiftStaff.filter((s) => {
    // Status Filter Check
    if (selectedStatusFilter !== 'All') {
      const susp = getStaffSuspensionInfo(s, selectedDate);
      const leave = getStaffLeaveInfo(s, selectedDate);
      const isFed = !!currentDayFedMap[s.employeeId];
      const isAway = susp.isSuspended || leave.isOnLeave;

      if (selectedStatusFilter === 'On Duty' && isAway) return false;
      if (selectedStatusFilter === 'On Leave' && !leave.isOnLeave) return false;
      if (selectedStatusFilter === 'Suspended' && !susp.isSuspended) return false;
      if (selectedStatusFilter === 'Served' && !isFed) return false;
      if (selectedStatusFilter === 'Not Served' && (isFed || isAway)) return false;
    }

    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.employeeId.toLowerCase().includes(term) ||
      (s.department || '').toLowerCase().includes(term)
    );
  });

  // Sorting logic (max 2 rules)
  const sortedFeedingStaff = [...filteredStaff].sort((a, b) => {
    if (sortRules.length === 0) return 0;

    for (const rule of sortRules) {
      const dirMult = rule.direction === 'asc' ? 1 : -1;
      let res = 0;

      if (rule.field === 'name') {
        res = (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'employeeId') {
        res = (a.employeeId || '').trim().localeCompare((b.employeeId || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
      } else if (rule.field === 'department') {
        res = (a.department || '').trim().localeCompare((b.department || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'shift') {
        res = (a.shiftSchedule || '').trim().localeCompare((b.shiftSchedule || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'fedStatus') {
        const aSusp = getStaffSuspensionInfo(a, selectedDate);
        const aLeave = getStaffLeaveInfo(a, selectedDate);
        const aFed = currentDayFedMap[a.employeeId] ? 1 : 0;
        const aScore = aSusp.isSuspended ? 1 : aLeave.isOnLeave ? 2 : aFed ? 4 : 3;

        const bSusp = getStaffSuspensionInfo(b, selectedDate);
        const bLeave = getStaffLeaveInfo(b, selectedDate);
        const bFed = currentDayFedMap[b.employeeId] ? 1 : 0;
        const bScore = bSusp.isSuspended ? 1 : bLeave.isOnLeave ? 2 : bFed ? 4 : 3;

        res = aScore - bScore;
      }

      if (res !== 0) {
        return res * dirMult;
      }
    }
    return 0;
  });

  const handleAddSortRule = () => {
    if (sortRules.length >= 2) return;
    const availableFields: FeedingSortField[] = ['name', 'employeeId', 'department', 'shift', 'fedStatus'];
    const unused = availableFields.find((f) => !sortRules.some((r) => r.field === f)) || 'name';
    setSortRules((prev) => [
      ...prev,
      { id: `sort-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, field: unused, direction: 'asc' },
    ]);
  };

  const handleUpdateSortRule = (index: number, updates: Partial<FeedingSortRule>) => {
    setSortRules((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...updates };
      }
      return updated;
    });
  };

  const handleRemoveSortRule = (index: number) => {
    setSortRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSwapSortRules = () => {
    if (sortRules.length === 2) {
      setSortRules([sortRules[1], sortRules[0]]);
    }
  };

  const handleClearSortRules = () => {
    setSortRules([]);
  };

  // Toggle Fed status for an employee
  const toggleFedStatus = (employeeId: string) => {
    setFeedingRecords((prev) => {
      const dayMap = prev[selectedDate] || {};
      const newDayMap = {
        ...dayMap,
        [employeeId]: !dayMap[employeeId],
      };
      return {
        ...prev,
        [selectedDate]: newDayMap,
      };
    });
  };

  // Mark all on-duty shift staff as Fed (excluding staff on leave or suspended)
  const markAllAsFed = () => {
    setFeedingRecords((prev) => {
      const dayMap = { ...(prev[selectedDate] || {}) };
      shiftStaff.forEach((s) => {
        const susp = getStaffSuspensionInfo(s, selectedDate);
        const leave = getStaffLeaveInfo(s, selectedDate);
        if (!susp.isSuspended && !leave.isOnLeave) {
          dayMap[s.employeeId] = true;
        }
      });
      return {
        ...prev,
        [selectedDate]: dayMap,
      };
    });
  };

  // Reset shift meal marks
  const clearShiftMarks = () => {
    setFeedingRecords((prev) => {
      const dayMap = { ...(prev[selectedDate] || {}) };
      shiftStaff.forEach((s) => {
        delete dayMap[s.employeeId];
      });
      return {
        ...prev,
        [selectedDate]: dayMap,
      };
    });
  };

  // Metrics: Differentiate on-duty staff from suspended / on-leave personnel
  const onDutyStaff = shiftStaff.filter((s) => {
    const susp = getStaffSuspensionInfo(s, selectedDate);
    const leave = getStaffLeaveInfo(s, selectedDate);
    return !susp.isSuspended && !leave.isOnLeave;
  });
  const onLeaveStaff = shiftStaff.filter((s) => {
    const susp = getStaffSuspensionInfo(s, selectedDate);
    const leave = getStaffLeaveInfo(s, selectedDate);
    return !susp.isSuspended && leave.isOnLeave;
  });
  const suspendedStaff = shiftStaff.filter((s) => {
    const susp = getStaffSuspensionInfo(s, selectedDate);
    return susp.isSuspended;
  });

  const totalAssigned = shiftStaff.length;
  const totalOnDuty = onDutyStaff.length;
  const fedCount = shiftStaff.filter((s) => currentDayFedMap[s.employeeId]).length;
  const pendingCount = onDutyStaff.filter((s) => !currentDayFedMap[s.employeeId]).length;
  const fedPct = totalOnDuty > 0 ? Math.round((onDutyStaff.filter((s) => currentDayFedMap[s.employeeId]).length / totalOnDuty) * 100) : 0;

  // Pending staff list for AI assistant
  const pendingStaffList = onDutyStaff.filter((s) => !currentDayFedMap[s.employeeId]);

  // Copy pending staff list
  const handleCopyPendingList = () => {
    if (pendingStaffList.length === 0) return;
    const text = `Rheiva AI Pending Meal Report (${selectedShift} Shift - ${selectedDate}):\n` +
      pendingStaffList.map((s, idx) => `${idx + 1}. ${s.name} (ID: ${s.employeeId}) - Dept: ${s.department}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Employee ID',
      'Staff Name',
      'Department',
      'Shift Schedule',
      'Duty / Leave Status',
      'Leave or Suspension End Date',
      'Meal Served Status',
    ];

    const rows = sortedFeedingStaff.map((s) => {
      const susp = getStaffSuspensionInfo(s, selectedDate);
      const leave = getStaffLeaveInfo(s, selectedDate);
      let dutyStatus = 'On Duty';
      let endsOn = 'N/A';

      if (susp.isSuspended) {
        dutyStatus = 'Suspended';
        endsOn = susp.endDate || 'Ongoing';
        if (leave.hasUpcomingLeave) {
          endsOn += ` (Leave starts ${leave.upcomingStartDate})`;
        }
      } else if (leave.isOnLeave) {
        dutyStatus = 'On leave';
        endsOn = leave.endDate || 'Ongoing';
      } else if (leave.hasUpcomingLeave) {
        dutyStatus = 'On Duty';
        endsOn = `Leave starts: ${leave.upcomingStartDate}`;
      }

      return [
        selectedDate,
        s.employeeId,
        `"${s.name}"`,
        `"${s.department}"`,
        s.shiftSchedule,
        `"${dutyStatus}"`,
        `"${endsOn}"`,
        currentDayFedMap[s.employeeId] ? 'Meal Given (Fed)' : 'Pending Meal',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `skima_feeding_schedule_${selectedDate}_${selectedShift}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white shadow-xl border border-amber-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <UtensilsCrossed className="w-4 h-4" />
            Skima Shift Feeding & Meal Distribution
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            Feeding Schedule & Meal Verification
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Staff members assigned to the selected shift appear in the meal distribution roster. Staff on leave or suspended are clearly designated with their status and scheduled end date.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Feeding Sheet</span>
          </button>
        </div>
      </div>

      {/* Date & Shift & Department & Status Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-amber-500" />
              Feeding Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
            />
          </div>

          {/* Department Filter Select */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
              <Building2 className="w-4 h-4 text-blue-500" />
              Department:
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer max-w-[180px]"
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Select */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
              <AlertCircle className="w-4 h-4 text-emerald-500" />
              Status:
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 cursor-pointer max-w-[170px]"
            >
              <option value="All">All Staff ({totalAssigned})</option>
              <option value="On Duty">On Duty ({totalOnDuty})</option>
              <option value="On Leave">On Leave ({onLeaveStaff.length})</option>
              <option value="Suspended">Suspended ({suspendedStaff.length})</option>
              <option value="Served">Served Meals ({fedCount})</option>
              <option value="Not Served">Pending Meals ({pendingCount})</option>
            </select>
          </div>
        </div>

        {/* Shift Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">Current Shift:</span>
          {shiftOptions.map((shiftName) => {
            const shiftObj = configuredShifts.find((s) => s.name === shiftName);
            const isLiveNow = shiftObj ? isCurrentTimeInShift(shiftObj.startTime, shiftObj.endTime) : false;

            return (
              <button
                key={shiftName}
                onClick={() => setSelectedShift(shiftName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedShift === shiftName
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{shiftName === 'All' ? 'All Shifts' : shiftName}</span>
                {isLiveNow && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Shift Now" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Completion Bar & Quick AI Helper */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Meal Distribution Completion Rate ({selectedShift} Shift)
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              {fedCount} of {totalOnDuty} on-duty shift staff served ({fedPct}% Complete) • {pendingCount} Pending Meals
              {(onLeaveStaff.length > 0 || suspendedStaff.length > 0) && (
                <span>
                  {' '}• {onLeaveStaff.length} On Leave{suspendedStaff.length > 0 ? `, ${suspendedStaff.length} Suspended` : ''}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-2 shrink-0 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Ask Rheiva AI (Who is yet to collect food?)</span>
          </button>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 transition-all duration-500 shadow-sm"
            style={{ width: `${fedPct}%` }}
          />
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>{totalOnDuty}</span>
              <span className="text-xs font-normal text-slate-400">/ {totalAssigned} total</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              On Duty on {selectedShift === 'All' ? 'All Shifts' : selectedShift}
              {(onLeaveStaff.length > 0 || suspendedStaff.length > 0) && (
                <div className="text-[10px] text-slate-400">
                  {onLeaveStaff.length > 0 && `${onLeaveStaff.length} on leave`}
                  {onLeaveStaff.length > 0 && suspendedStaff.length > 0 && ' • '}
                  {suspendedStaff.length > 0 && `${suspendedStaff.length} suspended`}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {fedCount}
            </div>
            <div className="text-xs text-slate-500 font-medium">Meals Given / Fed</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {pendingCount}
            </div>
            <div className="text-xs text-slate-500 font-medium">Pending Meal Distribution</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {fedPct}%
            </div>
            <div className="text-xs text-slate-500 font-medium">Shift Feeding Completion</div>
          </div>
        </div>
      </div>

      {/* Feeding Schedule Roster Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-500" />
              Meal Distribution Roster ({selectedShift} Shift - {selectedDate})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff by name or ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Sort Dropdown Controls */}
            <div className="relative border-l border-slate-200 dark:border-slate-800 pl-3" ref={sortContainerRef}>
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  sortRules.length > 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
                title="Sort Feeding Schedule Roster"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Sort</span>
                {sortRules.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono shrink-0">
                    {sortRules.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Feeding Schedule Sorting Rules</span>
                    </span>
                    {sortRules.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSortRules}
                        className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {sortRules.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-400">
                      No active sorting rules. Defaulting to system order.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {sortRules.map((rule, idx) => (
                        <div
                          key={rule.id || idx}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>{idx === 0 ? '1. Primary Sort' : '2. Secondary Sort'}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSortRule(idx)}
                              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer text-xs"
                              title="Remove rule"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={rule.field}
                              onChange={(e) =>
                                handleUpdateSortRule(idx, {
                                  field: e.target.value as FeedingSortField,
                                })
                              }
                              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                            >
                              <option value="name">Staff Member Name</option>
                              <option value="employeeId">Employee ID</option>
                              <option value="department">Department</option>
                              <option value="shift">Assigned Shift</option>
                              <option value="fedStatus">Meal Served Status</option>
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSortRule(idx, {
                                  direction: rule.direction === 'asc' ? 'desc' : 'asc',
                                })
                              }
                              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>{rule.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Helpful tip if Primary is a unique field like Name or Employee ID and Secondary is selected */}
                  {sortRules.length === 2 && (sortRules[0].field === 'name' || sortRules[0].field === 'employeeId') && (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-300 leading-tight">
                      💡 <strong>Tip:</strong> Primary sort ({FEEDING_FIELD_LABELS[sortRules[0].field]}) evaluates first. Since names are unique, set <strong>{FEEDING_FIELD_LABELS[sortRules[1].field]}</strong> as Primary (click <strong>"Swap 1st & 2nd"</strong>) to group by {FEEDING_FIELD_LABELS[sortRules[1].field]} first.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                    {sortRules.length < 2 && (
                      <button
                        type="button"
                        onClick={handleAddSortRule}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{sortRules.length === 0 ? 'Add Sort Rule' : 'Add 2nd Rule'}</span>
                      </button>
                    )}
                    {sortRules.length === 2 && (
                      <button
                        type="button"
                        onClick={handleSwapSortRules}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Swap 1st & 2nd</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsSortDropdownOpen(false)}
                      className="ml-auto px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <button
              onClick={markAllAsFed}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Served</span>
            </button>

            <button
              onClick={clearShiftMarks}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Marks</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">
                  Employee ID
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  Staff Member Name
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  Department
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  Assigned Shift
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  Remark / Status
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {sortedFeedingStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <UtensilsCrossed className="w-8 h-8 text-amber-500 mx-auto opacity-50" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No staff members found on {selectedShift} shift
                      </p>
                      <p className="text-xs text-slate-400">
                        Staff not assigned to {selectedShift} Shift are excluded from meal collection to prevent unauthorized feeding.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedFeedingStaff.map((staff, idx) => {
                  const isFed = !!currentDayFedMap[staff.employeeId];
                  const suspInfo = getStaffSuspensionInfo(staff, selectedDate);
                  const leaveInfo = getStaffLeaveInfo(staff, selectedDate);
                  const isSuspended = suspInfo.isSuspended;
                  const isOnLeave = !isSuspended && leaveInfo.isOnLeave;

                  return (
                    <tr
                      key={`${staff.id}-${idx}`}
                      className={`transition-colors ${
                        isFed
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30'
                          : isSuspended
                          ? 'bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                          : isOnLeave
                          ? 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {staff.employeeId}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg font-mono font-bold text-[10px] flex items-center justify-center shrink-0 ${
                            isSuspended
                              ? 'bg-amber-500/10 text-amber-600'
                              : isOnLeave
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-emerald-500/10 text-emerald-600'
                          }`}
                        >
                          {staff.name.charAt(0)}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{staff.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{staff.department}</td>
                      <td className="px-4 py-3 font-semibold">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                          {staff.shiftSchedule}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSuspended ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 inline-flex items-center gap-1.5 shadow-xs">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>Suspended</span>
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                              Ends: <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{suspInfo.endDate || 'Ongoing'}</span>
                            </span>
                            {leaveInfo.hasUpcomingLeave && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 inline-flex items-center gap-1 shadow-xs"
                                title={`Leave coming up on ${leaveInfo.upcomingStartDate}`}
                              >
                                <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>Leave starts: <strong className="font-mono">{leaveInfo.upcomingStartDate}</strong></span>
                              </span>
                            )}
                            {isFed && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                Served
                              </span>
                            )}
                          </div>
                        ) : isOnLeave ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700/80 inline-flex items-center gap-1.5 shadow-xs">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span>On leave</span>
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                              Ends: <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{leaveInfo.endDate || 'Ongoing'}</span>
                            </span>
                            {isFed && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                Served
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {isFed ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                Served
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                Not Served
                              </span>
                            )}
                            {leaveInfo.hasUpcomingLeave && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 inline-flex items-center gap-1 shadow-xs"
                                title={`Scheduled ${leaveInfo.upcomingLeaveType} leave starts on ${leaveInfo.upcomingStartDate}`}
                              >
                                <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>Leave starts: <strong className="font-mono">{leaveInfo.upcomingStartDate}</strong></span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleFedStatus(staff.employeeId)}
                          title={
                            isSuspended
                              ? `Suspended until ${suspInfo.endDate || 'further notice'}`
                              : isOnLeave
                              ? `On leave until ${leaveInfo.endDate || 'further notice'}`
                              : undefined
                          }
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 ${
                            isFed
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                              : isSuspended || isOnLeave
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-600 hover:text-white border border-slate-300 dark:border-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                          }`}
                        >
                          {isFed ? (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-500" />
                              <span>Mark Not Served</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSuspended || isOnLeave ? 'Mark Served (Away)' : 'Mark Served'}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rheiva AI Assistant Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <Sparkles className="w-5 h-5 text-amber-500 animate-spin" />
                <span>Rheiva AI Meal Advisor</span>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                Current Shift Meal Audit Report ({selectedShift} Shift - {selectedDate})
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                Rheiva AI scanned the shift roster ({totalAssigned} employees assigned to {selectedShift === 'All' ? 'all shifts' : `${selectedShift} shift`}, {totalOnDuty} currently on duty).
                <br />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{fedCount} staff members</span> have collected their meals ({fedPct}% on-duty completion).
                {onLeaveStaff.length > 0 && <span className="text-slate-500 font-medium"> • {onLeaveStaff.length} on leave</span>}
                {suspendedStaff.length > 0 && <span className="text-slate-500 font-medium"> • {suspendedStaff.length} suspended</span>}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  Staff Members Yet to Collect Food ({pendingStaffList.length})
                </h5>
                {pendingStaffList.length > 0 && (
                  <button
                    onClick={handleCopyPendingList}
                    className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedNotification ? 'Copied List!' : 'Copy Pending List'}</span>
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                {pendingStaffList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    All staff members assigned to the {selectedShift} shift have received their meals!
                  </div>
                ) : (
                  pendingStaffList.map((s, idx) => (
                    <div key={s.id} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-mono text-slate-400 text-[10px]">{idx + 1}.</span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{s.employeeId} • {s.department}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleFedStatus(s.employeeId)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer"
                      >
                        Mark Served
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
