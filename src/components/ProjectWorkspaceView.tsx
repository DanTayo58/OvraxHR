import React, { useState } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import {
  ProjectFile,
  AttendanceRecord,
  AttendanceStatus,
  AIAnalysisResult,
  AppSettings,
  StaffMember,
  LeaveRequest,
  User as UserAccount,
} from '../types';
import { RheivatechLogo } from './RheivatechLogo';
import { LockPasswordModal } from './LockPasswordModal';
import { FileSettingsModal } from './FileSettingsModal';
import { AccessControlModal } from './AccessControlModal';
import { EditSuspensionModal } from './EditSuspensionModal';
import { NotificationBell } from './NotificationBell';
import { emitGlobalToast } from '../context/ToastContext';
import { syncStaffAndProjects } from '../utils/rosterSync';
import { getActiveOrganizationName } from '../utils/documentTemplates';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from '../utils/companyStorage';
import { getStaffSuspensionDetails, isStaffSuspendedOnDate } from '../utils/staffUtils';
import {
  ArrowLeft,
  Lock,
  Unlock,
  Download,
  Sparkles,
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Brain,
  Sliders,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Shield,
  ShieldCheck,
  Search,
  Building,
  Upload,
  Plus,
  Trash2,
  Check,
  Bot,
  RefreshCw,
  UserX,
  UserPlus,
  UserMinus,
  ToggleLeft,
  ToggleRight,
  Layers,
} from 'lucide-react';

interface ProjectWorkspaceViewProps {
  project: ProjectFile;
  staffList?: StaffMember[];
  leaves?: LeaveRequest[];
  onBack: () => void;
  onUpdateProject: (updated: ProjectFile) => void;
  settings?: AppSettings;
  onSaveSettings?: (newSettings: AppSettings) => void;
  onUpdateStaffList?: (updated: StaffMember[]) => void;
  onClearAllData?: () => void;
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  project,
  staffList: globalStaffList = [],
  leaves = [],
  onBack,
  onUpdateProject,
  settings = {
    theme: 'dark',
    companyName: 'Skima HQ',
    resumptionTime: '08:00',
    closingTime: '17:00',
    gracePeriodMinutes: 15,
    defaultColumns: ['Full Name', 'Employee ID', 'Check-In', 'Check-Out'],
    autoSyncStaffFromAttendance: false,
    shifts: [],
  } as AppSettings,
  onSaveSettings = (_newSettings: AppSettings) => {},
  onUpdateStaffList,
  onClearAllData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'individual' | 'department' | 'ai'
  >('matrix');

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);

  const isLight = settings?.theme === 'light';

  // File-specific settings modal
  const [isFileSettingsOpen, setIsFileSettingsOpen] = useState(false);

  // Access Control modal
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);

  const getCurrentWorkspaceUser = (): UserAccount => {
    try {
      const savedUser =
        localStorage.getItem('skima_user_session') ||
        localStorage.getItem('skima_current_user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.error(e);
    }
    return {
      id: 'usr-admin-001',
      name: 'Daniel Tayo',
      email: 'danieltayo58@gmail.com',
      company: settings?.companyName || getActiveOrganizationName(settings),
      role: 'Admin',
      isAdmin: true,
    };
  };

  // Lock password modal
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockModalMode, setLockModalMode] = useState<'lock' | 'unlock'>('unlock');

  // Password unlock state if project is initially locked
  const [isUnlockedForSession, setIsUnlockedForSession] = useState(!project.isLocked);

  // Suspension modal state in worksheet
  const [workspaceSuspensionStaff, setWorkspaceSuspensionStaff] = useState<StaffMember | null>(null);

  const handleSaveWorkspaceSuspension = (
    staffId: string,
    startDate: string,
    endDate: string,
    reason: string
  ) => {
    const formattedEndTime =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : endDate || startDate || undefined;

    if (onUpdateStaffList) {
      const updated = globalStaffList.map((s) =>
        s.id === staffId || s.employeeId === staffId
          ? {
              ...s,
              status: 'Suspended' as const,
              suspensionStartDate: startDate || undefined,
              suspensionEndDate: endDate || undefined,
              suspensionEndTime: formattedEndTime,
              suspensionReason: reason || undefined,
            }
          : s
      );
      onUpdateStaffList(updated);
    }
    setWorkspaceSuspensionStaff(null);
  };

  const handleWorkspaceUnsuspend = (staff: StaffMember) => {
    if (onUpdateStaffList) {
      const updated = globalStaffList.map((s) =>
        s.id === staff.id || s.employeeId === staff.id
          ? {
              ...s,
              status: 'Active' as const,
              suspensionStartDate: undefined,
              suspensionEndDate: undefined,
              suspensionEndTime: undefined,
              suspensionReason: undefined,
            }
          : s
      );
      onUpdateStaffList(updated);
    }
    setWorkspaceSuspensionStaff(null);
  };

  // Staff navigation state
  const [selectedStaffIndex, setSelectedStaffIndex] = useState<number>(0);
  const [showStaffSelectorModal, setShowStaffSelectorModal] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // RheivaAI Bot & Individual Search State
  const [hasClickedRobot, setHasClickedRobot] = useState(false);
  const [indivSearchTerm, setIndivSearchTerm] = useState('');
  const [isIndivSearchFocused, setIsIndivSearchFocused] = useState(false);

  // Matrix Search Term
  const [matrixSearchTerm, setMatrixSearchTerm] = useState('');

  const daysInMonth = project.daysInMonth || 31;
  const monthYear = project.monthYear || '2026-08';

  // File specific shift rules or fallbacks
  const resumptionTime = project.fileResumptionTime || settings.resumptionTime || '08:00';
  const closingTime = project.fileClosingTime || settings.closingTime || '17:00';
  const gracePeriodMinutes =
    project.fileGracePeriodMinutes || settings.gracePeriodMinutes || 15;

  // Retrieve company name for exported documents
  const getCompanyName = () => {
    try {
      const savedUser = localStorage.getItem('skima_user_session');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.company) return parsed.company;
      }
    } catch (e) {
      console.error(e);
    }
    return settings?.companyName || 'ORGANIZATION';
  };

  // Helper to retrieve staff member's shift policy details dynamically (linking to daily shift template snapshots)
  const getStaffShiftPolicy = (empId: string, recordDate?: string) => {
    const staffObj = globalStaffList.find(
      (s) => s.id.toLowerCase() === empId.toLowerCase() || s.employeeId?.toLowerCase() === empId.toLowerCase()
    ) || (staffList.find((s) => s.id.toLowerCase() === empId.toLowerCase()) as unknown as StaffMember | undefined);

    let shiftScheduleName: string | undefined;

    // Check if there is a daily shift roster snapshot saved as an entity for this specific date
    if (recordDate && settings?.dailyShiftRosterHistory && settings.dailyShiftRosterHistory[recordDate]) {
      const daySnapshot = settings.dailyShiftRosterHistory[recordDate];
      const empIdLower = empId.toLowerCase();
      const assignmentKeys = Object.keys(daySnapshot.assignments || {});
      const matchedKey = assignmentKeys.find(
        (k) =>
          k.toLowerCase() === empIdLower ||
          (staffObj?.id && k.toLowerCase() === staffObj.id.toLowerCase()) ||
          (staffObj?.employeeId && k.toLowerCase() === staffObj.employeeId.toLowerCase()) ||
          (staffObj?.name && k.toLowerCase() === staffObj.name.toLowerCase())
      );

      if (matchedKey && daySnapshot.assignments[matchedKey]) {
        shiftScheduleName = daySnapshot.assignments[matchedKey];
      }
    }

    if (!shiftScheduleName) {
      shiftScheduleName = (staffObj as any)?.shiftSchedule || 'Morning Shift';
    }

    const sTrim = shiftScheduleName.toLowerCase().trim();

    const matchedShift = settings?.shifts?.find((s) => {
      const nameTrim = s.name.toLowerCase().trim();
      if (nameTrim === sTrim) return true;
      if (sTrim.length >= 3 && (nameTrim.includes(sTrim) || sTrim.includes(nameTrim))) return true;
      return false;
    });

    if (matchedShift && matchedShift.startTime !== 'Auto') {
      return {
        shiftName: matchedShift.name,
        resumptionTime: matchedShift.startTime,
        closingTime: matchedShift.endTime,
        gracePeriodMinutes: matchedShift.gracePeriodMinutes ?? gracePeriodMinutes,
      };
    }

    const defaultShift = settings?.shifts?.find((s) => s.isDefault && s.startTime !== 'Auto');
    if (defaultShift) {
      return {
        shiftName: defaultShift.name,
        resumptionTime: defaultShift.startTime,
        closingTime: defaultShift.endTime,
        gracePeriodMinutes: defaultShift.gracePeriodMinutes ?? gracePeriodMinutes,
      };
    }

    return {
      shiftName: shiftScheduleName,
      resumptionTime: resumptionTime,
      closingTime: closingTime,
      gracePeriodMinutes: gracePeriodMinutes,
    };
  };

  // Compute status taking into account staff shift policy & grace period
  const computeAttendanceStatus = (clockIn: string, empId: string, recordDate?: string): AttendanceStatus => {
    if (!clockIn || clockIn === '--:--' || clockIn.trim() === '') return 'Absent';

    const policy = getStaffShiftPolicy(empId, recordDate);
    const [inH, inM] = clockIn.split(':').map(Number);
    const [resH, resM] = policy.resumptionTime.split(':').map(Number);

    if (isNaN(inH) || isNaN(inM) || isNaN(resH) || isNaN(resM)) return 'On Time';

    let inTotalMins = inH * 60 + inM;
    const resTotalMins = resH * 60 + resM;
    const cutoffMins = resTotalMins + policy.gracePeriodMinutes;

    // Handle overnight shift arrival after midnight (e.g., shift starts 22:00, arrival is 00:15)
    if (resTotalMins >= 18 * 60 && inTotalMins < 12 * 60) {
      inTotalMins += 24 * 60;
    }

    return inTotalMins <= cutoffMins ? 'On Time' : 'Late';
  };

  // Extra custom columns (synced with settings and project overrides)
  const resolvedSettingsExtra =
    Array.isArray(settings?.extraColumns)
      ? settings.extraColumns
      : Array.isArray(settings?.defaultColumns)
      ? settings.defaultColumns
      : ['Shift Type', 'Supervisor Notes'];

  const extraColumns: string[] = Array.isArray(project.fileExtraColumns)
    ? project.fileExtraColumns
    : Array.isArray(project.customColumns) && !project.customColumns.includes('Full Name')
    ? project.customColumns
    : resolvedSettingsExtra;

  // Custom values storage per staff and column
  const [customCellValues, setCustomCellValues] = useState<
    Record<string, Record<string, string>>
  >(project.customValues || {});

  // Extra Column Management Handlers
  const handleDeleteAllExtraColumns = () => {
    onUpdateProject({
      ...project,
      fileExtraColumns: [],
      customColumns: [],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteExtraColumn = (colToDelete: string) => {
    const updated = extraColumns.filter((c) => c !== colToDelete);
    onUpdateProject({
      ...project,
      fileExtraColumns: updated,
      customColumns: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddQuickExtraColumn = () => {
    const newName = `Custom Note ${extraColumns.length + 1}`;
    const updated = [...extraColumns, newName];
    onUpdateProject({
      ...project,
      fileExtraColumns: updated,
      customColumns: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // Weekend Breakdown Logic
  const getWeekendBreakdown = (mYear: string) => {
    const [yearStr, monthStr] = mYear.split('-');
    const year = parseInt(yearStr) || 2026;
    const month = parseInt(monthStr) || 8;
    const totalDays = new Date(year, month, 0).getDate();

    let saturdays = 0;
    let sundays = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (dayOfWeek === 6) saturdays++;
      if (dayOfWeek === 0) sundays++;
    }

    return {
      saturdays,
      sundays,
      totalWeekends: saturdays + sundays,
    };
  };

  const weekendInfo = getWeekendBreakdown(monthYear);

  // Extract Staff List from records or defaults with authoritative ID lookup
  const extractStaffList = () => {
    if (!project.records || project.records.length === 0) {
      return [];
    }

    const map = new Map<string, { id: string; name: string; dept: string }>();
    project.records.forEach((r) => {
      const empKey = (r.employeeId || '').trim();
      if (empKey && !map.has(empKey)) {
        // ID-first mapping: lookup directory by ID to use authoritative directory name/dept
        const dirMatch = (globalStaffList || []).find(
          (g) =>
            (g.employeeId || '').trim().toLowerCase() === empKey.toLowerCase() ||
            (g.id || '').trim().toLowerCase() === empKey.toLowerCase()
        );

        map.set(empKey, {
          id: empKey,
          name: dirMatch ? dirMatch.name : (r.employeeName || 'Staff Member'),
          dept: dirMatch ? dirMatch.department : (r.department || 'General Operations'),
        });
      }
    });

    return Array.from(map.values());
  };

  const staffList = extractStaffList();
  const currentStaff = staffList[selectedStaffIndex] || staffList[0] || { id: '', name: 'No Staff', dept: 'N/A' };

  // Navigate staff
  const handleNextStaff = () => {
    setSelectedStaffIndex((prev) => (prev + 1) % staffList.length);
  };

  const handlePrevStaff = () => {
    setSelectedStaffIndex((prev) => (prev - 1 + staffList.length) % staffList.length);
  };

  // Update check-in time for staff
  const handleUpdateCheckIn = (empId: string, empName: string, dept: string, timeVal: string) => {
    const [year, month] = monthYear.split('-');
    const formattedDay = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
    const dateStr = `${year}-${month}-${formattedDay}`;

    const existingIdx = project.records.findIndex(
      (r) => r.employeeId.toLowerCase() === empId.toLowerCase() && r.dayNumber === selectedDay
    );

    let updatedRecords = [...project.records];
    const policy = getStaffShiftPolicy(empId, dateStr);
    const statusVal: AttendanceStatus = computeAttendanceStatus(timeVal, empId, dateStr);

    if (existingIdx >= 0) {
      updatedRecords[existingIdx] = {
        ...updatedRecords[existingIdx],
        clockIn: timeVal,
        scheduledIn: policy.resumptionTime,
        status: statusVal,
      };
    } else {
      updatedRecords.push({
        id: `rec-${Date.now()}-${empId}-${selectedDay}`,
        employeeId: empId,
        employeeName: empName,
        department: dept,
        shift: `${policy.resumptionTime} - ${policy.closingTime}`,
        date: dateStr,
        dayNumber: selectedDay,
        scheduledIn: policy.resumptionTime,
        clockIn: timeVal,
        clockOut: policy.closingTime,
        totalHours: 9.0,
        status: statusVal,
      });
    }

    onUpdateProject({
      ...project,
      records: updatedRecords,
      updatedAt: new Date().toISOString(),
    });
  };

  // Update check-out time for staff
  const handleUpdateCheckOut = (empId: string, empName: string, dept: string, timeVal: string) => {
    const [year, month] = monthYear.split('-');
    const formattedDay = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
    const dateStr = `${year}-${month}-${formattedDay}`;

    const existingIdx = project.records.findIndex(
      (r) => r.employeeId.toLowerCase() === empId.toLowerCase() && r.dayNumber === selectedDay
    );

    let updatedRecords = [...project.records];
    const policy = getStaffShiftPolicy(empId, dateStr);

    if (existingIdx >= 0) {
      updatedRecords[existingIdx] = {
        ...updatedRecords[existingIdx],
        clockOut: timeVal,
      };
    } else {
      updatedRecords.push({
        id: `rec-${Date.now()}-${empId}-${selectedDay}`,
        employeeId: empId,
        employeeName: empName,
        department: dept,
        shift: `${policy.resumptionTime} - ${policy.closingTime}`,
        date: dateStr,
        dayNumber: selectedDay,
        scheduledIn: policy.resumptionTime,
        clockIn: policy.resumptionTime,
        clockOut: timeVal,
        totalHours: 9.0,
        status: 'On Time',
      });
    }

    onUpdateProject({
      ...project,
      records: updatedRecords,
      updatedAt: new Date().toISOString(),
    });
  };

  // Extra Column Cell Change Handler
  const handleExtraCellChange = (empId: string, colName: string, val: string) => {
    const updated = {
      ...customCellValues,
      [empId]: {
        ...(customCellValues[empId] || {}),
        [colName]: val,
      },
    };
    setCustomCellValues(updated);
    onUpdateProject({
      ...project,
      customValues: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // Import CSV File Handler
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter((l) => l.trim() !== '');
      if (lines.length < 2) return;

      // Simple CSV Parse: Header, then rows (Full Name, ID, Department, Check-In, Check-Out)
      const newRecords: AttendanceRecord[] = [];
      const [year, month] = monthYear.split('-');

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
        if (parts.length < 2) continue;

        const name = parts[0] || `Staff ${i}`;
        const empId = parts[1] || `RH-${1000 + i}`;
        const dept = parts[2] || 'Operations';
        const checkIn = parts[3] || resumptionTime;
        const checkOut = parts[4] || closingTime;

        // Generate day 1 .. N records
        for (let d = 1; d <= Math.min(5, daysInMonth); d++) {
          const formattedDay = d < 10 ? `0${d}` : `${d}`;
          newRecords.push({
            id: `rec-imp-${i}-${d}`,
            employeeId: empId,
            employeeName: name,
            department: dept,
            shift: `${resumptionTime} - ${closingTime}`,
            date: `${year}-${month}-${formattedDay}`,
            dayNumber: d,
            scheduledIn: resumptionTime,
            clockIn: checkIn,
            clockOut: checkOut,
            totalHours: 9.0,
            status: checkIn > resumptionTime ? 'Late' : 'On Time',
          });
        }
      }

      onUpdateProject({
        ...project,
        records: newRecords,
        updatedAt: new Date().toISOString(),
      });
    };
    reader.readAsText(file);
  };

  // Days Recorded Count
  const uniqueDaysRecorded = project.records
    ? new Set(project.records.map((r) => r.dayNumber)).size
    : 0;

  // Calculate Overall Summary Metrics (Lateness Rate in Percentage!)
  const calculateOverallAverages = () => {
    if (!project.records || project.records.length === 0) {
      return {
        latenessRatePct: 14,
        presentRatePct: 92,
        punctualityRatePct: 86,
        overtimeRatePct: 18,
      };
    }

    const total = project.records.length;
    const lateCount = project.records.filter((r) => r.status === 'Late').length;
    const presentCount = project.records.filter((r) => r.status !== 'Absent').length;
    const onTimeCount = project.records.filter((r) => r.status === 'On Time' || r.status === 'Overtime').length;
    
    // Overtime occurs on present days where clockOut > closingTime or status is Overtime
    const overtimeCount = project.records.filter(
      (r) => r.status !== 'Absent' && (r.status === 'Overtime' || (r.clockOut && r.clockOut > closingTime))
    ).length;

    const latenessRatePct = Math.round((lateCount / total) * 100);
    const presentRatePct = Math.round((presentCount / total) * 100);
    const punctualityRatePct = Math.round((onTimeCount / total) * 100);
    const overtimeRatePct = Math.round((overtimeCount / total) * 100);

    return {
      latenessRatePct,
      presentRatePct,
      punctualityRatePct,
      overtimeRatePct,
    };
  };

  const overallAverages = calculateOverallAverages();

  // Individual Staff Metrics for Analysis & Pie/Trend Charts
  const getStaffIndividualData = (empId: string) => {
    if (!empId) {
      return {
        onTime: 0,
        late: 0,
        absent: 0,
        onTimeWithOvertime: 0,
        lateWithOvertime: 0,
        totalOvertimeDays: 0,
        totalOvertimeHours: 0,
        pieData: [
          { name: 'Early / On Time', value: 0, color: '#10b981' },
          { name: 'Late Days', value: 0, color: '#f59e0b' },
          { name: 'Absent Days', value: 0, color: '#ef4444' },
        ],
        innerOvertimeData: [],
        trendData: [],
      };
    }

    const staffRecords = (project.records || []).filter(
      (r) => r.employeeId.toLowerCase() === empId.toLowerCase()
    );

    const isOTRecord = (r: AttendanceRecord) => {
      if (r.status === 'Absent') return false;
      if (r.status === 'Overtime') return true;
      if (r.clockOut && r.clockOut > closingTime) return true;
      return false;
    };

    const onTimeRecords = staffRecords.filter((r) => r.status === 'On Time' || r.status === 'Overtime');
    const lateRecords = staffRecords.filter((r) => r.status === 'Late');
    const absentRecords = staffRecords.filter((r) => r.status === 'Absent');

    const onTime = onTimeRecords.length;
    const late = lateRecords.length;
    const absent = absentRecords.length;

    // Embedded Overtime Analysis (tracked as an attribute across On Time & Late workdays)
    const onTimeWithOvertime = onTimeRecords.filter(isOTRecord).length;
    const lateWithOvertime = lateRecords.filter(isOTRecord).length;
    const totalOvertimeDays = staffRecords.filter(isOTRecord).length;

    let totalOvertimeHours = 0;
    staffRecords.forEach((r) => {
      if (isOTRecord(r)) {
        if (r.clockOut && closingTime) {
          const [coH, coM] = r.clockOut.split(':').map(Number);
          const [clH, clM] = closingTime.split(':').map(Number);
          const mins = (coH * 60 + coM) - (clH * 60 + clM);
          totalOvertimeHours += mins > 0 ? Math.round((mins / 60) * 10) / 10 : 1.5;
        } else {
          totalOvertimeHours += 1.5;
        }
      }
    });

    // Pure 3-Slice Outer Pie Chart (On Time + Late + Absent = 100% Total Logged Days)
    const pieData = [
      { name: 'Early / On Time', value: onTime || 18, color: '#10b981' },
      { name: 'Late Days', value: late || 4, color: '#f59e0b' },
      { name: 'Absent Days', value: absent || 2, color: '#ef4444' },
    ];

    const presentDays = onTime + late || 22;
    const effectiveOtDays = totalOvertimeDays || (onTime ? Math.floor(onTime * 0.3) : 3);
    const nonOtPresentDays = Math.max(0, presentDays - effectiveOtDays);

    // Inner Concentric Ring: Overtime Arc measuring overtime ratio within Present Workdays (On Time + Late)
    const innerOvertimeData = [
      { name: 'Overtime Workdays', value: effectiveOtDays, color: '#a855f7' },
      { name: 'Standard Workdays', value: nonOtPresentDays, color: isLight ? '#cbd5e1' : '#334155' },
      { name: 'Absent (N/A)', value: absent || 2, color: 'transparent' },
    ];

    // Day-by-Day Progress Trend Dataset (Day 1 to daysInMonth)
    const trendData = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const rec = staffRecords.find((r) => r.dayNumber === d);
      const st = rec ? (rec.status === 'Overtime' ? 'On Time' : rec.status) : d % 6 === 0 ? 'Late' : 'On Time';
      const hasOT = rec ? isOTRecord(rec) : (d % 7 === 0 || d % 5 === 0);

      let score = 100;
      if (st === 'Late') score = 50;
      if (st === 'Absent') score = 10;
      if (hasOT) score += 25; // Visual height elevation showing extra effort

      const statusLabel = hasOT ? `${st} (+ Overtime)` : st;

      trendData.push({
        day: `Day ${d}`,
        status: statusLabel,
        rawStatus: st,
        hasOT,
        score: score,
      });
    }

    return {
      onTime,
      late,
      absent,
      onTimeWithOvertime: onTimeWithOvertime || (onTime ? Math.floor(onTime * 0.25) : 2),
      lateWithOvertime: lateWithOvertime || (late ? Math.floor(late * 0.5) : 1),
      totalOvertimeDays: totalOvertimeDays || (onTime ? Math.floor(onTime * 0.3) : 3),
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10 || 8.5,
      pieData,
      innerOvertimeData,
      trendData,
    };
  };

  const staffAnalytics = getStaffIndividualData(currentStaff.id);

  // Departmental Breakdown
  const getDepartmentAnalytics = () => {
    const deptMap = new Map<
      string,
      {
        dept: string;
        staffCount: number;
        onTime: number;
        late: number;
        absent: number;
        overtime: number;
        onTimeOvertime: number;
        lateOvertime: number;
        total: number;
      }
    >();

    staffList.forEach((st) => {
      const dName = st.dept || 'Operations';
      if (!deptMap.has(dName)) {
        deptMap.set(dName, {
          dept: dName,
          staffCount: 0,
          onTime: 0,
          late: 0,
          absent: 0,
          overtime: 0,
          onTimeOvertime: 0,
          lateOvertime: 0,
          total: 0,
        });
      }
      const entry = deptMap.get(dName)!;
      entry.staffCount += 1;

      const stRecs = project.records.filter(
        (r) => r.employeeId.toLowerCase() === st.id.toLowerCase()
      );

      stRecs.forEach((r) => {
        entry.total += 1;
        const isOT = (r.clockOut && r.clockOut > closingTime) || r.status === 'Overtime';
        if (r.status === 'On Time' || r.status === 'Overtime') {
          entry.onTime += 1;
          if (isOT) entry.onTimeOvertime += 1;
        } else if (r.status === 'Late') {
          entry.late += 1;
          if (isOT) entry.lateOvertime += 1;
        } else if (r.status === 'Absent') {
          entry.absent += 1;
        }
        if (isOT) entry.overtime += 1;
      });
    });

    const result = Array.from(deptMap.values()).map((d) => {
      const totalRecs = Math.max(1, d.total);
      return {
        ...d,
        punctualityPct: Math.round((d.onTime / totalRecs) * 100) || 88,
        latenessPct: Math.round((d.late / totalRecs) * 100) || 12,
        overtimePct: Math.round((d.overtime / totalRecs) * 100) || 15,
      };
    });

    return result;
  };

  const departmentData = getDepartmentAnalytics();

  // Mismatch Analysis between Master Staff Directory and Attendance Sheet Upload using Authoritative Staff IDs
  const activeGlobalStaff = (globalStaffList || []).filter((s) => s.status !== 'Exited');
  const exitedGlobalStaff = (globalStaffList || []).filter((s) => s.status === 'Exited');

  // Staff in attendance sheet missing from active staff directory (Matched strictly by Staff ID)
  const uploadStaffNotInDirectory = staffList.filter((s) => {
    const sId = (s.id || '').trim().toLowerCase();
    if (!sId) return true;
    return !activeGlobalStaff.some((g) => {
      const gEmpId = (g.employeeId || '').trim().toLowerCase();
      const gId = (g.id || '').trim().toLowerCase();
      return (gEmpId && gEmpId === sId) || (gId && gId === sId);
    });
  });

  // Active staff in directory missing from attendance sheet upload (Matched strictly by Staff ID)
  const activeDirectoryStaffNotInUpload = activeGlobalStaff.filter((g) => {
    const gEmpId = (g.employeeId || '').trim().toLowerCase();
    const gId = (g.id || '').trim().toLowerCase();
    return !staffList.some((s) => {
      const sId = (s.id || '').trim().toLowerCase();
      return (gEmpId && sId === gEmpId) || (gId && sId === gId);
    });
  });

  // Exited staff present in attendance upload (Matched strictly by Staff ID)
  const exitedStaffInUpload = staffList.filter((s) => {
    const sId = (s.id || '').trim().toLowerCase();
    if (!sId) return false;
    return exitedGlobalStaff.some((e) => {
      const eEmpId = (e.employeeId || '').trim().toLowerCase();
      const eId = (e.id || '').trim().toLowerCase();
      return (eEmpId && eEmpId === sId) || (eId && eId === sId);
    });
  });

  const hasNameDiscrepancy =
    uploadStaffNotInDirectory.length > 0 ||
    activeDirectoryStaffNotInUpload.length > 0 ||
    exitedStaffInUpload.length > 0;

  // Sync All Rosters (Missing Active Staff to Worksheet & Unmapped Upload Staff to HR Directory)
  const handleSyncAllRosters = () => {
    let sourceStaff = Array.isArray(globalStaffList) && globalStaffList.length > 0 ? globalStaffList : [];

    if (sourceStaff.length === 0) {
      const compKey = (settings?.companyName && settings.companyName.trim()) || getCompanyName();
      try {
        const stored = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, compKey, []);
        if (Array.isArray(stored) && stored.length > 0) {
          sourceStaff = stored;
        }
      } catch (e) {
        console.error('Error fetching staff directory for sync:', e);
      }
    }

    if (sourceStaff.length === 0 && (!project.records || project.records.length === 0)) {
      emitGlobalToast('No staff members found in the Staff Directory. Please add staff in the Staff Directory tab first, or upload an attendance spreadsheet.', 'warning');
      return;
    }

    const { updatedStaffList, updatedProjects } = syncStaffAndProjects(
      sourceStaff,
      [project]
    );

    if (onUpdateStaffList) {
      onUpdateStaffList(updatedStaffList);
    }

    if (updatedProjects && updatedProjects.length > 0) {
      const updatedProj = updatedProjects[0];
      onUpdateProject(updatedProj);
      try {
        const compKey = (settings?.companyName && settings.companyName.trim()) || getCompanyName();
        const allProjects = loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, compKey, []);
        if (Array.isArray(allProjects)) {
          const mapped = allProjects.map((p) => (p.id === updatedProj.id ? updatedProj : p));
          saveCompanyData(STORAGE_KEYS.PROJECTS, mapped, compKey);
        }
      } catch (e) {
        console.error(e);
      }
    }

    emitGlobalToast(`Successfully synchronized with Staff Directory! ${updatedStaffList.length} staff records are now mapped to this attendance worksheet.`, 'success');

    setTimeout(() => handleRunAIAnalysis(), 300);
  };

  // Toggle Auto-Sync Staff List on Attendance
  const handleToggleAutoSync = () => {
    const nextState = !settings.autoSyncStaffFromAttendance;

    onSaveSettings({
      ...settings,
      autoSyncStaffFromAttendance: nextState,
    });

    if (nextState) {
      handleSyncAllRosters();
    }
  };

  // Add single active HR staff to worksheet
  const handleAddSingleStaffToWorksheet = (st: StaffMember) => {
    const newRecords: AttendanceRecord[] = [];
    const normJoinDate = st.joinDate ? st.joinDate.trim() : '';
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = `${monthYear}-${String(day).padStart(2, '0')}`;
      const isPreEmployment = Boolean(normJoinDate && dayDate < normJoinDate);
      newRecords.push({
        id: `rec-synced-${st.employeeId}-${day}-${Date.now()}`,
        employeeId: st.employeeId,
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
    }

    onUpdateProject({
      ...project,
      records: [...project.records, ...newRecords],
      staffCount: (project.staffCount || 0) + 1,
    });

    emitGlobalToast(`Added "${st.name}" (${st.employeeId}) to attendance worksheet!`, 'success');
    setTimeout(() => handleRunAIAnalysis(), 300);
  };

  // Register single unmapped worksheet personnel into HR directory
  const handleRegisterSingleStaffToDirectory = (st: { id: string; name: string; dept: string }) => {
    if (!onUpdateStaffList) return;
    const newStaff: StaffMember = {
      id: `staff-registered-${Date.now()}`,
      employeeId: st.id,
      name: st.name,
      department: st.dept || 'Operations',
      role: 'Operations Staff',
      email: `${st.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`,
      payGrade: 'Grade L2',
      estimatedMonthlySalary: 3200,
      shiftSchedule: 'Morning',
      status: 'Active',
      joinDate: new Date().toISOString().split('T')[0],
    };

    onUpdateStaffList([...(globalStaffList || []), newStaff]);
    emitGlobalToast(`Registered "${st.name}" (${st.id}) into HR Staff Directory!`, 'success');
    setTimeout(() => handleRunAIAnalysis(), 300);
  };

  // Run RheivaAI Intelligence Analysis
  const handleRunAIAnalysis = () => {
    setIsGeneratingAI(true);
    setTimeout(() => {
      const summaryText = hasNameDiscrepancy
        ? `ID-First AI Biometric Resolution: I analyzed this attendance upload against the active staff directory using Staff IDs as the primary authoritative key. The scan revealed discrepancies that require your attention:`
        : `ID-First AI Biometric Resolution: All ${staffList.length} personnel were accurately mapped to active Staff IDs in the directory regardless of name spelling variations. Skima matrix verified ${uniqueDaysRecorded}/${daysInMonth} days with ${overallAverages.punctualityRatePct}% overall punctuality.`;

      const detectedAnomalies: string[] = [];
      if (uploadStaffNotInDirectory.length > 0) {
        detectedAnomalies.push(
          `Unmapped Staff IDs (${uploadStaffNotInDirectory.length}): ${uploadStaffNotInDirectory.map((s) => `ID ${s.id} (${s.name})`).join(', ')} found in worksheet but not matched with any active Staff ID in the directory.`
        );
      }
      if (activeDirectoryStaffNotInUpload.length > 0) {
        detectedAnomalies.push(
          `Missing Active Staff IDs (${activeDirectoryStaffNotInUpload.length}): ${activeDirectoryStaffNotInUpload.map((s) => `${s.name} [ID: ${s.employeeId}]`).join(', ')} registered in HR directory but absent from this upload.`
        );
      }
      if (exitedStaffInUpload.length > 0) {
        detectedAnomalies.push(
          `Exited Personnel Logged (${exitedStaffInUpload.length}): ${exitedStaffInUpload.map((s) => `${s.name} (ID: ${s.id})`).join(', ')} marked as EXITED in HR roster but still registered clock-in entries.`
        );
      }
      const [aiY, aiM] = monthYear.split('-');
      const dailySnapshotsInMonth = Object.keys(settings?.dailyShiftRosterHistory || {}).filter((dKey) =>
        dKey.startsWith(`${aiY}-${aiM}`)
      );
      if (dailySnapshotsInMonth.length > 0) {
        detectedAnomalies.push(
          `Shift Roster Snapshots Active: ${dailySnapshotsInMonth.length} calendar day(s) have date-locked shift template entities recorded, ensuring worksheet accuracy across morning/night rotations.`
        );
      }
      if (detectedAnomalies.length === 0) {
        detectedAnomalies.push(
          `ID-Based Biometric Link: Staff IDs matched 100% with the master directory. All name references are synced.`
        );
        detectedAnomalies.push(
          `Lateness Cutoff: Grace period threshold enforced at ${gracePeriodMinutes} minutes from official resumption (${resumptionTime}).`
        );
        detectedAnomalies.push(
          `Weekend Adjustment: ${weekendInfo.totalWeekends} weekend days (${weekendInfo.saturdays} Saturdays, ${weekendInfo.sundays} Sundays) auto-configured.`
        );
      }

      setAiResult({
        executiveSummary: summaryText,
        anomalies: detectedAnomalies,
        departmentInsights: departmentData.map((dp) => ({
          department: dp.dept,
          insight: `${dp.staffCount} staff members, ${dp.punctualityPct}% punctuality rate, ${dp.latenessPct}% lateness rate.`,
        })),
        recommendations: [
          uploadStaffNotInDirectory.length > 0
            ? 'Add unmapped personnel to active staff directory or link their Employee IDs.'
            : 'Verify daily check-in logs for accurate payroll calculation.',
          exitedStaffInUpload.length > 0
            ? 'Audit biometric clock-in devices to purge credentials of exited employees.'
            : 'Export CSV/Excel summary report for monthly record keeping.',
          activeDirectoryStaffNotInUpload.length > 0
            ? 'Flag missing active employees for unauthorized absence or leave verification.'
            : 'Schedule auto-sync between attendance uploads and HR directory.',
        ],
      });
      setIsGeneratingAI(false);
    }, 1000);
  };

  // Export Excel Workbook with Days as Individual Worksheets
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const companyName = getCompanyName();

    // 1. Monthly Summary Worksheet
    const summaryAOA: any[][] = [];
    summaryAOA.push([companyName.toUpperCase()]);
    summaryAOA.push([`BIOMETRIC ATTENDANCE REPORT - ${project.name}`]);
    summaryAOA.push(['Month:', monthYear]);
    summaryAOA.push(['Total Staff:', staffList.length]);
    summaryAOA.push([]);
    summaryAOA.push([
      'Employee ID',
      'Full Name',
      'Department',
      'Days Present',
      'On Time Count',
      'Late Count',
      'Overtime Count',
      'Total Hours Worked',
    ]);

    staffList.forEach((st) => {
      const stRecs = project.records.filter(
        (r) => r.employeeId.toLowerCase() === st.id.toLowerCase()
      );
      const present = stRecs.filter((r) => r.status !== 'Absent').length;
      const onTime = stRecs.filter((r) => r.status === 'On Time').length;
      const late = stRecs.filter((r) => r.status === 'Late').length;
      const overtime = stRecs.filter((r) => r.status === 'Overtime').length;
      const totalHrs =
        Math.round(
          stRecs.reduce((acc, r) => acc + (r.totalHours || 0), 0) * 10
        ) / 10;

      summaryAOA.push([
        st.id,
        st.name,
        st.dept,
        present,
        onTime,
        late,
        overtime,
        totalHrs,
      ]);
    });

    summaryAOA.push([]);
    summaryAOA.push([`Generated by Skima Attendance System - ${companyName}`]);

    const summaryWS = XLSX.utils.aoa_to_sheet(summaryAOA);
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Monthly Summary');

    // 2. Individual Worksheets for Each Day (Day 1 to daysInMonth)
    for (let d = 1; d <= daysInMonth; d++) {
      const dayAOA: any[][] = [];
      const dayDateStr = `${monthYear}-${String(d).padStart(2, '0')}`;
      dayAOA.push([companyName.toUpperCase()]);
      dayAOA.push([`DAILY ATTENDANCE LOG - DAY ${d} (${dayDateStr})`]);
      dayAOA.push([]);

      const headers = [
        'Employee ID',
        'Full Name',
        'Department',
        'Scheduled Resumption',
        'Clock In',
        'Clock Out',
        'Total Hours',
        'Attendance Status',
        'Biometric Notes',
        ...extraColumns,
      ];
      dayAOA.push(headers);

      staffList.forEach((st) => {
        const currentRecord = project.records.find(
          (r) => r.employeeId.toLowerCase() === st.id.toLowerCase() && r.dayNumber === d
        );

        const staffPolicy = getStaffShiftPolicy(st.id, dayDateStr);
        const checkInVal = currentRecord ? currentRecord.clockIn : '--:--';
        const checkOutVal = currentRecord ? currentRecord.clockOut : '--:--';
        const hoursVal = currentRecord ? currentRecord.totalHours : 0;
        const statusVal = currentRecord ? currentRecord.status : 'Absent';
        const notesVal = currentRecord ? currentRecord.notes || '' : '';

        const extraVals = extraColumns.map(
          (col) => customCellValues[st.id]?.[col] || ''
        );

        dayAOA.push([
          st.id,
          st.name,
          st.dept,
          staffPolicy.resumptionTime,
          checkInVal,
          checkOutVal,
          hoursVal,
          statusVal,
          notesVal,
          ...extraVals,
        ]);
      });

      // Footer row attribution
      dayAOA.push([]);
      dayAOA.push([`Generated by Skima Attendance System - ${companyName}`]);

      const dayWS = XLSX.utils.aoa_to_sheet(dayAOA);
      const sheetName = `Day ${String(d).padStart(2, '0')}`;
      XLSX.utils.book_append_sheet(wb, dayWS, sheetName);
    }

    // Trigger file download
    const cleanFileName = project.name.replace(/\.(csv|xlsx|xls)$/i, '');
    XLSX.writeFile(wb, `${cleanFileName}_Export.xlsx`);
    emitGlobalToast(`Exported full attendance workbook (${cleanFileName}.xlsx)`, 'success');
  };

  // Export CSV File
  const handleExportCSV = () => {
    const companyName = getCompanyName();
    let csvContent = `data:text/csv;charset=utf-8,`;
    csvContent += `"${companyName.toUpperCase()}"\n`;
    csvContent += `"DAILY ATTENDANCE LOG - ${project.name}"\n\n`;

    const headers = [
      'Full Name',
      'Employee ID',
      'Department',
      'Check-In',
      'Check-Out',
      ...extraColumns,
    ];

    csvContent += headers.join(',') + '\n';

    const formattedSelectedDay = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
    const selectedDateForDay = `${monthYear}-${formattedSelectedDay}`;

    staffList.forEach((st) => {
      const currentRecord = project.records.find(
        (r) => r.employeeId.toLowerCase() === st.id.toLowerCase() && r.dayNumber === selectedDay
      );

      const staffPolicy = getStaffShiftPolicy(st.id, selectedDateForDay);
      const checkInVal = currentRecord ? currentRecord.clockIn : staffPolicy.resumptionTime;
      const checkOutVal = currentRecord ? currentRecord.clockOut : staffPolicy.closingTime;

      const extraVals = extraColumns.map(
        (col) => `"${customCellValues[st.id]?.[col] || ''}"`
      );

      const matchedGlobalStaff = globalStaffList.find(
        (s) => s.id === st.id || s.employeeId === st.id || s.name === st.name
      );
      const isSuspended = matchedGlobalStaff?.status === 'Suspended' || (st as any).status === 'Suspended';
      const displayName = isSuspended && !st.name.includes('(suspended)') ? `${st.name} (suspended)` : st.name;

      const row = [
        `"${displayName}"`,
        st.id,
        `"${st.dept}"`,
        checkInVal,
        checkOutVal,
        ...extraVals,
      ];

      csvContent += row.join(',') + '\n';
    });

    csvContent += `\n"Generated by Skima Attendance System - ${companyName}"\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', project.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    emitGlobalToast(`Exported Day ${selectedDay} attendance records (${project.name})`, 'success');
  };

  // If locked and not unlocked for session
  if (project.isLocked && !isUnlockedForSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <LockPasswordModal
          isOpen={true}
          mode="unlock"
          fileName={project.name}
          onClose={onBack}
          onConfirmLock={() => {}}
          onConfirmUnlock={(passwordAttempt) => {
            if (!project.lockPassword || passwordAttempt === project.lockPassword) {
              setIsUnlockedForSession(true);
              return true;
            }
            return false;
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Access Control Modal */}
      <AccessControlModal
        isOpen={isAccessControlOpen}
        onClose={() => setIsAccessControlOpen(false)}
        currentUser={getCurrentWorkspaceUser()}
        theme={settings?.theme}
      />

      {/* File-Specific Settings Modal */}
      <FileSettingsModal
        isOpen={isFileSettingsOpen}
        onClose={() => setIsFileSettingsOpen(false)}
        project={project}
        isLight={isLight}
        settings={settings}
        onSaveFileSettings={(updatedProj) => {
          onUpdateProject(updatedProj);
        }}
      />

      {/* Lock Password Modal */}
      {showLockModal && (
        <LockPasswordModal
          isOpen={showLockModal}
          mode={lockModalMode}
          fileName={project.name}
          onClose={() => setShowLockModal(false)}
          onConfirmLock={(password) => {
            onUpdateProject({ ...project, isLocked: true, lockPassword: password });
          }}
          onConfirmUnlock={(passwordAttempt) => {
            if (!project.lockPassword || passwordAttempt === project.lockPassword) {
              onUpdateProject({ ...project, isLocked: false, lockPassword: '' });
              return true;
            }
            return false;
          }}
        />
      )}

      {/* Staff Selector Dropdown Modal */}
      {showStaffSelectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Select Staff Member</h3>
              <button
                onClick={() => setShowStaffSelectorModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                placeholder="Search staff by name or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 p-1">
              {staffList
                .filter(
                  (s) =>
                    s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                    s.id.toLowerCase().includes(staffSearchQuery.toLowerCase())
                )
                .map((st, idx) => (
                  <button
                    key={`${st.id}-${idx}`}
                    onClick={() => {
                      setSelectedStaffIndex(staffList.findIndex((x) => x.id === st.id));
                      setShowStaffSelectorModal(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                      st.id === currentStaff.id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-white block">{st.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{st.id} • {st.dept}</span>
                    </div>
                    {st.id === currentStaff.id && <Check className="w-4 h-4 text-blue-400" />}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl px-4 lg:px-8 py-3.5 flex items-center justify-between border-b transition-colors ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-900 shadow-sm'
          : 'bg-slate-900/90 border-slate-800/80 text-white'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl transition-colors cursor-pointer border ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <RheivatechLogo size="sm" showSubtext={false} theme={isLight ? 'light' : 'dark'} />
          <div className={`hidden sm:block h-5 w-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`hidden sm:block max-w-xs truncate font-bold text-xs font-mono ${
            isLight ? 'text-slate-800' : 'text-slate-300'
          }`}>
            {project.name}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* File Specific Settings Modal Button */}
          <button
            onClick={() => setIsFileSettingsOpen(true)}
            className={`p-2.5 rounded-xl border text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
            }`}
            title="File Specific Settings & Custom Columns"
          >
            <Settings className="w-4 h-4 text-blue-500" />
            <span className="hidden md:inline font-mono text-xs font-semibold">File Settings</span>
          </button>

          {/* Lock / Unlock Toggle */}
          <button
            onClick={() => {
              setLockModalMode(project.isLocked ? 'unlock' : 'lock');
              setShowLockModal(true);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              project.isLocked
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            {project.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{project.isLocked ? 'Locked' : 'Unlocked'}</span>
          </button>

          {/* Notification Bell */}
          <NotificationBell staffList={globalStaffList} isLight={isLight} />

          {/* Consolidated Single Export Button */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-md shadow-emerald-600/30 transition-colors cursor-pointer"
            title="Export Excel Workbook with Days as Individual Worksheets (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* File Overview Banner */}
        <div
          className={`rounded-3xl border p-6 shadow-xl space-y-6 transition-colors ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-md'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          <div
            className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b pb-6 ${
              isLight ? 'border-slate-200' : 'border-slate-800/80'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {project.name}
                </h2>
                {project.isLocked && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-mono border border-amber-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Protected
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-mono flex items-center gap-2 flex-wrap ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                <span>
                  Month: <strong className="text-blue-600 dark:text-blue-400">{monthYear}</strong>
                </span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  {uniqueDaysRecorded}/{daysInMonth} Days Logged
                </span>
              </p>
            </div>

            {/* Shift Rules Badge & Daily Shift Snapshot Badge */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div
                className={`flex items-center gap-4 px-5 py-3 rounded-2xl border font-mono text-xs ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-slate-950 border-slate-800 text-white'
                }`}
              >
                <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <span
                    className={`block text-[10px] uppercase font-semibold ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Active Shift Policies ({settings?.shifts?.length || 1} Configured)
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {settings?.shifts && settings.shifts.length > 0
                      ? settings.shifts.map((s) => `${s.name} (${s.startTime})`).join(' • ')
                      : `${resumptionTime} - ${closingTime} (${gracePeriodMinutes}m Grace)`}
                  </span>
                </div>
              </div>

              {/* Day-Locked Shift Entity Badge */}
              {(() => {
                const [y, m] = monthYear.split('-');
                const fDay = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
                const curDate = `${y}-${m}-${fDay}`;
                const daySnap = settings?.dailyShiftRosterHistory?.[curDate];

                return (
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border font-mono text-xs ${
                      daySnap
                        ? isLight
                          ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                          : 'bg-purple-950/40 border-purple-800/80 text-purple-200'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <Layers className={`w-4 h-4 shrink-0 ${daySnap ? 'text-purple-500' : 'text-slate-400'}`} />
                    <div>
                      <span
                        className={`block text-[10px] uppercase font-semibold ${
                          daySnap
                            ? isLight
                              ? 'text-purple-700'
                              : 'text-purple-300'
                            : isLight
                            ? 'text-slate-500'
                            : 'text-slate-400'
                        }`}
                      >
                        Day {selectedDay} Shift Entity
                      </span>
                      {daySnap ? (
                        <span className="font-bold flex items-center gap-1.5">
                          <span>{daySnap.templateName}</span>
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px] font-mono border border-purple-500/30">
                            Date-Locked
                          </span>
                        </span>
                      ) : (
                        <span className="font-medium text-[11px] opacity-80">
                          {settings?.activeTemplateId
                            ? `${settings.savedRosterTemplates?.find((t) => t.id === settings.activeTemplateId)?.name || 'Active Roster'} (Live)`
                            : 'Standard Baseline'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* AI Schedule & Weekend Analysis Note */}
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 ${
              isLight
                ? 'bg-blue-50/80 border-blue-200 text-slate-800'
                : 'bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-950 border-blue-500/30 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-mono font-bold text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>File Schedule & Weekend Policy Note</span>
            </div>
            <p className="leading-relaxed">
              In{' '}
              <strong className={isLight ? 'text-slate-900 font-mono' : 'text-white font-mono'}>
                {monthYear}
              </strong>{' '}
              (Total {daysInMonth} days), there are{' '}
              <strong className="text-blue-600 dark:text-blue-300 font-mono">
                {weekendInfo.totalWeekends} weekend days
              </strong>{' '}
              ({weekendInfo.saturdays} Saturdays, {weekendInfo.sundays} Sundays). Resumption target is{' '}
              <strong className={isLight ? 'text-slate-900 font-mono' : 'text-white font-mono'}>
                {resumptionTime}
              </strong>{' '}
              with a{' '}
              <strong className="text-amber-600 dark:text-amber-300 font-mono">
                {gracePeriodMinutes}-minute grace period
              </strong>{' '}
              before lateness triggers.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center gap-2 overflow-x-auto pb-2 border-b ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : isLight
                ? 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Attendance Record Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : isLight
                ? 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Individual Analysis Card</span>
          </button>

          <button
            onClick={() => setActiveTab('department')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'department'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : isLight
                ? 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Departmental Analysis</span>
          </button>

          {/* RheivaAI Bot Tab Button with Bell/Alarm Shake */}
          <button
            onClick={() => {
              setActiveTab('ai');
              setHasClickedRobot(true);
              if (!aiResult) handleRunAIAnalysis();
            }}
            className={`relative px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : isLight
                ? 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="RheivaAI Intelligence Bot"
          >
            <motion.div
              animate={
                hasNameDiscrepancy && !hasClickedRobot
                  ? { rotate: [0, -22, 22, -16, 16, -10, 10, 0] }
                  : {}
              }
              transition={
                hasNameDiscrepancy && !hasClickedRobot
                  ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }
                  : {}
              }
              className="inline-flex items-center justify-center shrink-0"
            >
              <Bot
                className={`w-5 h-5 ${
                  hasNameDiscrepancy && !hasClickedRobot
                    ? 'text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    : 'text-indigo-500'
                }`}
              />
            </motion.div>
            <span className="font-bold">RheivaAI Bot</span>

            {hasNameDiscrepancy && !hasClickedRobot && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white dark:border-slate-900"></span>
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Attendance Record Matrix */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            {/* Top Toolbar: Day Pill Selector + Search + Column Controls + Import CSV Button */}
            <div
              className={`flex flex-col gap-3 p-4 rounded-3xl border transition-colors ${
                isLight
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-900 border-slate-800 shadow-xl'
              }`}
            >
              {/* Row 1: Day Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span
                  className={`text-xs font-mono shrink-0 font-bold mr-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Day:
                </span>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold shrink-0 transition-all cursor-pointer ${
                      selectedDay === d
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md shadow-blue-600/30'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>

              {/* Row 2: Search Bar & Actions Toolbar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                {/* Search Bar for Matrix */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={matrixSearchTerm}
                    onChange={(e) => setMatrixSearchTerm(e.target.value)}
                    placeholder="Search attendance matrix by staff name, employee ID, department, or custom notes..."
                    className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs font-mono border outline-none transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        : 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  {matrixSearchTerm && (
                    <button
                      onClick={() => setMatrixSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Extra Columns & Roster Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {extraColumns.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllExtraColumns}
                      className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Delete all extra custom columns from this worksheet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Extra Columns ({extraColumns.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddQuickExtraColumn}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                        : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border-indigo-800/60'
                    }`}
                    title="Add a new custom column for remarks/jottings"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Column</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncAllRosters}
                    className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                        : 'bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border-blue-800/60'
                    }`}
                    title="Populate/Synchronize active staff from Staff Directory into this project attendance sheet"
                  >
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Get Staff from Directory</span>
                  </button>

                  <label
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>Import CSV / Excel</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.txt"
                      onChange={handleCSVImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Attendance Record Matrix Table */}
            {staffList.length === 0 ? (
              <div
                className={`p-10 rounded-3xl border text-center space-y-4 transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-sm text-slate-900'
                    : 'bg-slate-900 border-slate-800 shadow-2xl text-white'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base">Empty Attendance Worksheet</h3>
                  <p className={`text-xs max-w-md mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    This worksheet has no attendance records or staff assigned yet. Get started by pulling active staff from the Staff Directory or uploading an attendance file.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleSyncAllRosters}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>Get Staff from Staff Directory</span>
                  </button>
                  <label
                    className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold border flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>Upload Attendance File</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.txt"
                      onChange={handleCSVImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div
                className={`rounded-3xl border overflow-hidden transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-sm text-slate-900'
                    : 'bg-slate-900 border-slate-800 shadow-2xl text-white'
                }`}
              >
                {/* Result count indicator if searching */}
                {matrixSearchTerm && (
                  <div
                    className={`px-4 py-2.5 border-b text-xs font-mono flex items-center justify-between ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>
                      Found{' '}
                      <strong className={isLight ? 'text-blue-600 font-bold' : 'text-blue-400 font-bold'}>
                        {
                          staffList.filter((st) => {
                            const q = matrixSearchTerm.toLowerCase().trim();
                            const nameMatch = st.name.toLowerCase().includes(q);
                            const idMatch = st.id.toLowerCase().includes(q);
                            const deptMatch = st.dept.toLowerCase().includes(q);
                            const customValuesMatch = Object.values(customCellValues[st.id] || {}).some(
                              (v) => typeof v === 'string' && v.toLowerCase().includes(q)
                            );
                            return nameMatch || idMatch || deptMatch || customValuesMatch;
                          }).length
                        }
                      </strong>{' '}
                      staff matching &ldquo;{matrixSearchTerm}&rdquo; out of {staffList.length} total
                    </span>
                    <button
                      onClick={() => setMatrixSearchTerm('')}
                      className="text-xs text-blue-500 hover:underline cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  </div>
                )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`uppercase font-mono tracking-wider border-b ${
                      isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <tr>
                      <th className={`p-4 font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Full Name
                      </th>
                      <th className="p-4 font-bold">Employee ID</th>
                      <th className="p-4 font-bold">Department</th>
                      <th className="p-4 font-bold text-blue-600 dark:text-blue-400">
                        Check-In
                      </th>
                      <th className="p-4 font-bold text-blue-600 dark:text-blue-400">
                        Check-Out
                      </th>
                      <th className="p-4 font-bold text-teal-600 dark:text-teal-400">
                        Leave / Off Log
                      </th>
                      {/* Separate Extra Custom Columns with inline Delete */}
                      {extraColumns.map((col, idx) => (
                        <th
                          key={idx}
                          className={`p-4 font-bold text-indigo-600 dark:text-indigo-300 ${
                            isLight ? 'bg-indigo-50/50' : 'bg-slate-900/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              {col}{' '}
                              <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                                (Custom)
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteExtraColumn(col)}
                              className="p-1 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                              title={`Delete column "${col}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y font-sans ${
                      isLight ? 'divide-slate-200' : 'divide-slate-800/80'
                    }`}
                  >
                    {staffList
                      .filter((st) => {
                        if (!matrixSearchTerm.trim()) return true;
                        const q = matrixSearchTerm.toLowerCase().trim();
                        const nameMatch = st.name.toLowerCase().includes(q);
                        const idMatch = st.id.toLowerCase().includes(q);
                        const deptMatch = st.dept.toLowerCase().includes(q);
                        const customValuesMatch = Object.values(customCellValues[st.id] || {}).some(
                          (v) => typeof v === 'string' && v.toLowerCase().includes(q)
                        );
                        return nameMatch || idMatch || deptMatch || customValuesMatch;
                      })
                      .map((st, idx) => {
                      const currentRecord = project.records.find(
                        (r) =>
                          r.employeeId.toLowerCase() === st.id.toLowerCase() &&
                          r.dayNumber === selectedDay
                      );

                      const checkInTime = currentRecord ? currentRecord.clockIn : resumptionTime;
                      const checkOutTime = currentRecord ? currentRecord.clockOut : closingTime;

                      const matchedGlobalStaff = globalStaffList.find(
                        (gs) =>
                          (gs.employeeId && gs.employeeId.toLowerCase() === st.id.toLowerCase()) ||
                          (gs.id && gs.id.toLowerCase() === st.id.toLowerCase()) ||
                          (gs.name && gs.name.toLowerCase() === st.name.toLowerCase())
                      );

                      const isExited = matchedGlobalStaff?.status === 'Exited';
                      const isSuspended = matchedGlobalStaff?.status === 'Suspended' || (st as any).status === 'Suspended';
                      const suspensionDetails = getStaffSuspensionDetails(matchedGlobalStaff);

                      return (
                        <tr
                          key={`${st.id}-${idx}`}
                          className={`transition-colors ${
                            isExited
                              ? isLight
                                ? 'bg-rose-50 hover:bg-rose-100/80'
                                : 'bg-rose-950/20 hover:bg-rose-950/40'
                              : isSuspended
                              ? isLight
                                ? 'bg-amber-50/50 hover:bg-amber-50/80'
                                : 'bg-amber-950/15 hover:bg-amber-950/30'
                              : isLight
                              ? 'hover:bg-slate-50'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td
                            className={`p-4 font-bold flex flex-col justify-center ${
                              isLight ? 'text-slate-900' : 'text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{st.name}</span>
                              {isSuspended && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (matchedGlobalStaff) {
                                      setWorkspaceSuspensionStaff(matchedGlobalStaff);
                                    } else {
                                      // Create on-the-fly staff entry
                                      setWorkspaceSuspensionStaff({
                                        id: st.id,
                                        employeeId: st.id,
                                        name: st.name,
                                        department: st.dept,
                                        role: 'Staff Member',
                                        email: '',
                                        phone: '',
                                        payGrade: 'Grade L1',
                                        estimatedMonthlySalary: 3000,
                                        shiftSchedule: 'Morning',
                                        status: 'Suspended',
                                        joinDate: new Date().toISOString().split('T')[0],
                                      });
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 shrink-0 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                  title={`Suspended (${suspensionDetails.displayRange}) - Click to edit suspension start/end dates`}
                                >
                                  <UserMinus className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>(suspended)</span>
                                </button>
                              )}
                              {isExited && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                                  EXITED STAFF
                                </span>
                              )}
                            </div>
                            {isSuspended && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (matchedGlobalStaff) {
                                    setWorkspaceSuspensionStaff(matchedGlobalStaff);
                                  }
                                }}
                                className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 mt-0.5 text-left"
                                title="Click to view or edit suspension dates"
                              >
                                <Calendar className="w-3 h-3 text-amber-500 shrink-0 inline" />
                                <span>Suspension: {suspensionDetails.displayRange}</span>
                              </button>
                            )}
                            {(() => {
                              const [y, m] = monthYear.split('-');
                              const fDay = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
                              const curDate = `${y}-${m}-${fDay}`;
                              const policy = getStaffShiftPolicy(st.id, curDate);
                              const daySnap = settings?.dailyShiftRosterHistory?.[curDate];

                              return (
                                <span
                                  className="text-[10px] font-mono font-medium text-blue-500/90 dark:text-blue-400 flex items-center gap-1.5"
                                  title={daySnap ? `Evaluated from Day ${selectedDay} snapshot: "${daySnap.templateName}"` : `Evaluated from active roster`}
                                >
                                  <span>{policy.shiftName} ({policy.resumptionTime} - {policy.closingTime})</span>
                                  {daySnap && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" title="Date-locked snapshot active" />
                                  )}
                                </span>
                              );
                            })()}
                          </td>
                          <td className={`p-4 font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {st.id}
                          </td>
                          <td className={`p-4 font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {st.dept}
                          </td>

                          {/* Check-In Input */}
                          <td className="p-4 font-mono">
                            <input
                              type="time"
                              value={checkInTime}
                              onChange={(e) =>
                                handleUpdateCheckIn(st.id, st.name, st.dept, e.target.value)
                              }
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono outline-none focus:border-blue-500 ${
                                isLight
                                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'
                                  : 'bg-slate-800 border-slate-700 text-white'
                              }`}
                            />
                          </td>

                          {/* Check-Out Input */}
                          <td className="p-4 font-mono">
                            <input
                              type="time"
                              value={checkOutTime}
                              onChange={(e) =>
                                handleUpdateCheckOut(st.id, st.name, st.dept, e.target.value)
                              }
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono outline-none focus:border-blue-500 ${
                                isLight
                                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'
                                  : 'bg-slate-800 border-slate-700 text-white'
                              }`}
                            />
                          </td>

                          {/* Leave / Off Log Column */}
                          <td className="p-4 font-mono">
                            {(() => {
                              const selectedDateStr = `${monthYear}-${String(selectedDay).padStart(2, '0')}`;
                              const isSuspendedOnDate = isStaffSuspendedOnDate(matchedGlobalStaff, selectedDateStr) || (isSuspended && !suspensionDetails.startDate && !suspensionDetails.endDate);

                              const matchingLeave = leaves.find(
                                (l) =>
                                  (l.employeeId.toLowerCase() === st.id.toLowerCase() ||
                                    l.employeeName.toLowerCase() === st.name.toLowerCase()) &&
                                  l.status === 'Approved' &&
                                  selectedDateStr >= l.startDate &&
                                  selectedDateStr <= l.endDate
                              );

                              const hasTimedIn =
                                currentRecord &&
                                currentRecord.clockIn &&
                                currentRecord.clockIn !== '--:--' &&
                                currentRecord.clockIn.trim() !== '';

                              if (isSuspendedOnDate) {
                                if (hasTimedIn) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (matchedGlobalStaff) {
                                          setWorkspaceSuspensionStaff(matchedGlobalStaff);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/50 whitespace-nowrap shadow-sm cursor-pointer transition-colors"
                                      title="Suspended personnel clocked in. Click to edit suspension dates."
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                                      <span>Suspended: {suspensionDetails.displayRange}</span>
                                      <span className="font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded text-[10px] uppercase border border-rose-500/30">
                                        (Clock-in on suspension)
                                      </span>
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (matchedGlobalStaff) {
                                        setWorkspaceSuspensionStaff(matchedGlobalStaff);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/35 whitespace-nowrap cursor-pointer transition-colors shadow-sm"
                                    title="Active Staff Suspension. Click to edit dates."
                                  >
                                    <UserMinus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>Suspended: {suspensionDetails.displayRange}</span>
                                    {suspensionDetails.reason && (
                                      <span className="text-[10px] opacity-75 font-normal truncate max-w-[120px]">
                                        ({suspensionDetails.reason})
                                      </span>
                                    )}
                                  </button>
                                );
                              }

                              if (matchingLeave) {
                                if (hasTimedIn) {
                                  return (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap shadow-sm">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                                      <span>covered by leave log ID #{matchingLeave.id} ({matchingLeave.leaveType} Leave)</span>
                                      <span className="font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded text-[10px] uppercase border border-rose-500/30">
                                        (Abnormal log found)
                                      </span>
                                    </span>
                                  );
                                }

                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/30 whitespace-nowrap">
                                    covered by leave log ID #{matchingLeave.id} ({matchingLeave.leaveType} Leave)
                                  </span>
                                );
                              }

                              return (
                                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                  No Leave Logged
                                </span>
                              );
                            })()}
                          </td>

                          {/* Extra Custom Columns Inputs */}
                          {extraColumns.map((col, idx) => (
                            <td
                              key={idx}
                              className={`p-4 font-mono ${isLight ? 'bg-slate-50/50' : 'bg-slate-950/20'}`}
                            >
                              <input
                                type="text"
                                placeholder={`Empty ${col}`}
                                value={customCellValues[st.id]?.[col] || ''}
                                onChange={(e) =>
                                  handleExtraCellChange(st.id, col, e.target.value)
                                }
                                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none focus:border-indigo-500 ${
                                  isLight
                                    ? 'bg-white border-slate-300 text-slate-900'
                                    : 'bg-slate-800/80 border-slate-700/80 text-white'
                                }`}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Tab 2: Individual Analysis Card (Pie Chart + Embedded Overtime Breakdown + Trend Chart) */}
        {activeTab === 'individual' && (
          <div className="space-y-6">
            {/* Staff Navigation & Summary Pills Bar */}
            <div
              className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={handlePrevStaff}
                  className={`p-2.5 rounded-2xl border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Previous Staff Member"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div>
                  <h3 className={`font-extrabold text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {currentStaff.name}
                  </h3>
                  <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    ID: {currentStaff.id} • Dept: {currentStaff.dept}
                  </p>
                </div>

                <button
                  onClick={handleNextStaff}
                  className={`p-2.5 rounded-2xl border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Next Staff Member"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Live Keystroke Search Bar beside Right Arrow */}
                <div className="relative flex-1 min-w-[160px] max-w-xs ml-1">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20'
                        : 'bg-slate-800 border-slate-700 text-white focus-within:border-blue-500'
                    }`}
                  >
                    <Search className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input
                      type="text"
                      value={indivSearchTerm}
                      onChange={(e) => setIndivSearchTerm(e.target.value)}
                      placeholder="Search staff..."
                      className="w-full bg-transparent outline-none text-xs font-medium placeholder:text-slate-400"
                    />
                    {indivSearchTerm && (
                      <button
                        onClick={() => setIndivSearchTerm('')}
                        className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Live Dropdown Results on Keystroke */}
                  {indivSearchTerm.trim() !== '' && (
                    <div
                      className={`absolute top-full left-0 right-0 mt-1 z-30 max-h-56 overflow-y-auto rounded-2xl border shadow-2xl p-1.5 space-y-1 ${
                        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    >
                      {(() => {
                        const matches = staffList.filter(
                          (st) =>
                            st.name.toLowerCase().includes(indivSearchTerm.toLowerCase()) ||
                            st.id.toLowerCase().includes(indivSearchTerm.toLowerCase()) ||
                            st.dept.toLowerCase().includes(indivSearchTerm.toLowerCase())
                        );

                        if (matches.length === 0) {
                          return (
                            <div className="p-3 text-center text-xs text-slate-400 font-mono">
                              No staff found for "{indivSearchTerm}"
                            </div>
                          );
                        }

                        return matches.map((st, idx) => (
                          <button
                            key={`${st.id}-${idx}`}
                            onClick={() => {
                              const idx = staffList.findIndex((s) => s.id === st.id);
                              if (idx >= 0) setSelectedStaffIndex(idx);
                              setIndivSearchTerm('');
                            }}
                            className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              st.id === currentStaff.id
                                ? 'bg-blue-600/20 text-blue-600 dark:text-blue-300 font-bold'
                                : isLight
                                ? 'hover:bg-slate-100 text-slate-800'
                                : 'hover:bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div>
                              <span className="font-bold block">{st.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {st.id} • {st.dept}
                              </span>
                            </div>
                            {st.id === currentStaff.id && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Staff Metric Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  On Time: {staffAnalytics.onTime}d
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  Late: {staffAnalytics.late}d
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                  Absent: {staffAnalytics.absent}d
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
                  Overtime: {staffAnalytics.totalOvertimeDays}d ({staffAnalytics.totalOvertimeHours}h)
                </span>
              </div>
            </div>

            {/* Individual Suspended Staff Alert Banner */}
            {(() => {
              const matched = globalStaffList.find(
                (gs) =>
                  (gs.employeeId && gs.employeeId.toLowerCase() === currentStaff.id.toLowerCase()) ||
                  (gs.id && gs.id.toLowerCase() === currentStaff.id.toLowerCase()) ||
                  (gs.name && gs.name.toLowerCase() === currentStaff.name.toLowerCase())
              );
              if (matched && matched.status === 'Suspended') {
                const details = getStaffSuspensionDetails(matched);
                return (
                  <div
                    className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
                      isLight
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-amber-950/30 border-amber-800/60 text-amber-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                        <UserMinus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          <span>Staff Member Currently Suspended</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            (suspended)
                          </span>
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                          Active Suspension Period: <strong className="font-mono">{details.displayRange}</strong>
                          {details.reason && <span> • Reason: {details.reason}</span>}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWorkspaceSuspensionStaff(matched)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 shadow flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition-colors shrink-0"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Edit Suspension Dates</span>
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Individual Charts & Embedded Overtime Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart: Clean 3-Category Distribution (Rotational Consistency Guaranteed) */}
              <div
                className={`p-6 rounded-3xl border space-y-4 shadow-xl transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b pb-3 ${
                    isLight ? 'border-slate-200' : 'border-slate-800'
                  }`}
                >
                  <h4
                    className={`font-bold text-sm flex items-center gap-2 font-mono ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    <PieChartIcon className="w-4 h-4 text-blue-500" />
                    Monthly Attendance Distribution
                  </h4>
                  <span
                    className={`text-xs font-mono ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {daysInMonth} Days Total
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* Concentric Inner Ring: Sleek thin purple Overtime line measuring Overtime ratio within Present Workdays */}
                      <Pie
                        data={staffAnalytics.innerOvertimeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={50}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        {staffAnalytics.innerOvertimeData.map((entry, index) => (
                          <Cell
                            key={`inner-cell-${index}`}
                            fill={entry.color === 'transparent' ? 'transparent' : entry.color}
                          />
                        ))}
                      </Pie>

                      {/* Outer Ring: Rich & Prominent Primary Punctuality (Early/On Time, Late, Absent) */}
                      <Pie
                        data={staffAnalytics.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={96}
                        paddingAngle={3}
                        dataKey="value"
                        stroke={isLight ? '#ffffff' : '#0f172a'}
                        strokeWidth={2}
                      >
                        {staffAnalytics.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>

                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? '#ffffff' : '#0f172a',
                          borderColor: isLight ? '#e2e8f0' : '#334155',
                          borderRadius: '12px',
                          color: isLight ? '#0f172a' : '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Absent (N/A)') return [null, null];
                          return [`${value} days`, name];
                        }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span
                            className={`text-xs font-mono ${
                              isLight ? 'text-slate-700' : 'text-slate-300'
                            }`}
                          >
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div
                  className={`p-3 rounded-2xl border text-[11px] font-mono leading-relaxed flex items-center gap-2 ${
                    isLight
                      ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                      : 'bg-purple-950/40 border-purple-800/60 text-purple-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0 inline-block" />
                  <span>
                    <strong>Concentric Inner Purple Bar:</strong> Measures overtime ratio directly inside the Green & Orange present workdays ({staffAnalytics.totalOvertimeDays} of {staffAnalytics.onTime + staffAnalytics.late} days = {Math.round((staffAnalytics.totalOvertimeDays / Math.max(1, staffAnalytics.onTime + staffAnalytics.late)) * 100)}%).
                  </span>
                </div>
              </div>

              {/* Embedded Overtime Analysis Box */}
              <div
                className={`p-6 rounded-3xl border space-y-4 shadow-xl transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b pb-3 ${
                    isLight ? 'border-slate-200' : 'border-slate-800'
                  }`}
                >
                  <h4
                    className={`font-bold text-sm flex items-center gap-2 font-mono ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-purple-500" />
                    Embedded Overtime Analysis
                  </h4>
                  <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                    {staffAnalytics.totalOvertimeHours} Hours Total
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`p-4 rounded-2xl border space-y-1 ${
                      isLight
                        ? 'bg-emerald-50/70 border-emerald-200/80'
                        : 'bg-emerald-950/30 border-emerald-800/40'
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold block">
                      On Time (+ Overtime)
                    </span>
                    <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      {staffAnalytics.onTimeWithOvertime} <span className="text-xs font-normal">days</span>
                    </p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Arrived on time & worked past closing time
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border space-y-1 ${
                      isLight
                        ? 'bg-amber-50/70 border-amber-200/80'
                        : 'bg-amber-950/30 border-amber-800/40'
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase text-amber-700 dark:text-amber-400 font-bold block">
                      Late (+ Overtime)
                    </span>
                    <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                      {staffAnalytics.lateWithOvertime} <span className="text-xs font-normal">days</span>
                    </p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Arrived late & worked past closing time
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between ${
                    isLight
                      ? 'bg-purple-50/60 border-purple-200'
                      : 'bg-purple-950/30 border-purple-800/50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">
                      Total Overtime Work Sessions
                    </span>
                    <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Integrated across {staffAnalytics.onTimeWithOvertime + staffAnalytics.lateWithOvertime} present workdays
                    </span>
                  </div>
                  <span className="text-2xl font-extrabold font-mono text-purple-600 dark:text-purple-400">
                    {staffAnalytics.totalOvertimeDays}d
                  </span>
                </div>
              </div>

              {/* Trend Chart: Daily Attendance Progress */}
              <div
                className={`p-6 rounded-3xl border space-y-4 shadow-xl lg:col-span-2 transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b pb-3 ${
                    isLight ? 'border-slate-200' : 'border-slate-800'
                  }`}
                >
                  <h4
                    className={`font-bold text-sm flex items-center gap-2 font-mono ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Daily Attendance & Overtime Log (Day 1 to {daysInMonth})
                  </h4>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    Embedded Status View
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={staffAnalytics.trendData}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#1e293b'} />
                      <XAxis dataKey="day" stroke={isLight ? '#64748b' : '#64748b'} fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} domain={[0, 140]} hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? '#ffffff' : '#0f172a',
                          borderColor: isLight ? '#cbd5e1' : '#334155',
                          borderRadius: '12px',
                          color: isLight ? '#0f172a' : '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value, name, item) => [
                          `Status: ${item.payload.status}`,
                          'Attendance',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorTrend)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Departmental Analysis Tab */}
        {activeTab === 'department' && (
          <div className="space-y-6">
            <div
              className={`p-6 rounded-3xl border shadow-xl space-y-6 transition-colors ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <div
                className={`flex items-center justify-between border-b pb-4 ${
                  isLight ? 'border-slate-200' : 'border-slate-800'
                }`}
              >
                <div>
                  <h3
                    className={`font-extrabold text-lg flex items-center gap-2 ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    <Building className="w-5 h-5 text-blue-500" />
                    Departmental Attendance & Overtime Analysis
                  </h3>
                  <p
                    className={`text-xs font-mono ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Comparing punctuality, lateness, and embedded overtime across operational units
                  </p>
                </div>
              </div>

              {/* Department Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departmentData.map((dp, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border space-y-3 ${
                      isLight
                        ? 'bg-slate-50/80 border-slate-200'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between border-b pb-2 ${
                        isLight ? 'border-slate-200' : 'border-slate-800/80'
                      }`}
                    >
                      <span className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {dp.dept}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          isLight
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {dp.staffCount} Staff
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                      <div>
                        <span className={`block text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Punctuality
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
                          {dp.punctualityPct}%
                        </span>
                      </div>
                      <div>
                        <span className={`block text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Lateness
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-base">
                          {dp.latenessPct}%
                        </span>
                      </div>
                      <div>
                        <span className={`block text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Overtime
                        </span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold text-base">
                          {dp.overtime} <span className="text-[10px] font-normal">days</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Department Bar Chart Comparison */}
              <div
                className={`p-6 rounded-2xl border space-y-4 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <h4
                  className={`font-bold text-xs font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-white'
                  }`}
                >
                  Department Comparison Chart (Punctuality vs Lateness)
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#1e293b'} />
                      <XAxis dataKey="dept" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? '#ffffff' : '#0f172a',
                          borderColor: isLight ? '#cbd5e1' : '#334155',
                          borderRadius: '12px',
                          color: isLight ? '#0f172a' : '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="punctualityPct" name="Punctuality Rate (%)" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="latenessPct" name="Lateness Rate (%)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: AI Matrix Analysis */}
        {activeTab === 'ai' && (
          <div
            className={`rounded-3xl border p-6 space-y-6 shadow-xl transition-colors ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  AI Attendance Matrix Analysis
                </h3>
                <p
                  className={`text-xs font-mono ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Automated shift verification & completeness diagnostics
                </p>
              </div>

              <button
                onClick={handleRunAIAnalysis}
                disabled={isGeneratingAI}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingAI ? 'Analyzing...' : 'Generate Matrix Insights'}</span>
              </button>
            </div>

            {aiResult && (
              <div
                className={`space-y-4 pt-4 border-t ${
                  isLight ? 'border-slate-200' : 'border-slate-800'
                }`}
              >
                <div
                  className={`p-4 rounded-2xl border text-xs font-mono leading-relaxed ${
                    isLight
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      : 'bg-indigo-950/40 border-indigo-800/50 text-indigo-200'
                  }`}
                >
                  <span className="font-bold block text-indigo-600 dark:text-indigo-400 mb-1">Executive Diagnostic:</span>
                  {aiResult.executiveSummary}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className={`p-4 rounded-2xl border space-y-2 ${
                      isLight
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase font-mono flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Detected Anomalies
                    </h4>
                    <ul className={`space-y-1.5 text-xs font-sans ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {aiResult.anomalies.map((anom, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{anom}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isLight
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Recommendations & Actions
                      </h4>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          settings.autoSyncStaffFromAttendance
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        Auto-Sync: {settings.autoSyncStaffFromAttendance ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>

                    <ul className={`space-y-1.5 text-xs font-sans ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {aiResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-500">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Interactive Recommendations Action Hub */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                      {/* Toggle Button for Sync Staff List on Attendance */}
                      <button
                        onClick={handleToggleAutoSync}
                        className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          settings.autoSyncStaffFromAttendance
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                            : isLight
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                        title="Toggle auto-sync between master staff directory and attendance worksheets"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${settings.autoSyncStaffFromAttendance ? 'animate-spin' : ''}`} />
                        <span>
                          {settings.autoSyncStaffFromAttendance
                            ? 'Sync Staff List: ON'
                            : 'Toggle Sync Staff List on Attendance'}
                        </span>
                      </button>

                      {/* One-Click Sync All Rosters Button */}
                      {hasNameDiscrepancy && (
                        <button
                          onClick={handleSyncAllRosters}
                          className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                          title="Sync missing personnel into worksheet and unmapped staff to directory"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>⚡ Sync Rosters Now ({activeDirectoryStaffNotInUpload.length + uploadStaffNotInDirectory.length})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* HR Roster Discrepancy Summary Box (Column for staff names not in worksheet) */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold font-mono flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        HR Roster Summary: Personnel Not in Attendance Worksheet
                      </h4>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Cross-reference analysis to help HR identify missing active employees and unmapped upload entries.
                      </p>
                    </div>

                    {activeDirectoryStaffNotInUpload.length > 0 && (
                      <button
                        onClick={handleSyncAllRosters}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add All Missing ({activeDirectoryStaffNotInUpload.length}) to Worksheet</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Summary Column 1: Active HR Personnel NOT in Worksheet */}
                    <div
                      className={`p-4 rounded-xl border space-y-3 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold font-mono uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <UserX className="w-4 h-4" /> Active Staff NOT in Worksheet ({activeDirectoryStaffNotInUpload.length})
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          HR Directory Discrepancy
                        </span>
                      </div>

                      {activeDirectoryStaffNotInUpload.length === 0 ? (
                        <div className="p-3 text-center text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          ✓ All active HR directory employees are present in this attendance worksheet.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {activeDirectoryStaffNotInUpload.map((st, idx) => (
                            <div
                              key={`${st.id}-${idx}`}
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                              }`}
                            >
                              <div>
                                <span className="font-bold block text-slate-900 dark:text-white">{st.name}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  ID: {st.employeeId} • {st.department} • {st.role}
                                </span>
                              </div>
                              <button
                                onClick={() => handleAddSingleStaffToWorksheet(st)}
                                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono font-bold shrink-0 transition cursor-pointer"
                                title="Add to attendance worksheet"
                              >
                                + Add to Sheet
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary Column 2: Unmapped Upload Personnel NOT in Active Directory */}
                    <div
                      className={`p-4 rounded-xl border space-y-3 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold font-mono uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4" /> Unmapped Upload Personnel ({uploadStaffNotInDirectory.length})
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Unregistered Entry
                        </span>
                      </div>

                      {uploadStaffNotInDirectory.length === 0 ? (
                        <div className="p-3 text-center text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          ✓ All worksheet personnel are verified in the active HR directory.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {uploadStaffNotInDirectory.map((st, idx) => (
                            <div
                              key={`${st.id}-${idx}`}
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                              }`}
                            >
                              <div>
                                <span className="font-bold block text-slate-900 dark:text-white">{st.name}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  Worksheet ID: {st.id} • Dept: {st.dept}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRegisterSingleStaffToDirectory(st)}
                                className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-mono font-bold shrink-0 transition cursor-pointer"
                                title="Register into HR Staff Directory"
                              >
                                + Register HR
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exited Personnel Alert Banner */}
                  {exitedStaffInUpload.length > 0 && (
                    <div
                      className={`p-4 rounded-xl border space-y-2 ${
                        isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-950/30 border-rose-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Exited HR Personnel Logged in Worksheet ({exitedStaffInUpload.length})
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold">
                          Security Alert
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {exitedStaffInUpload.map((st, idx) => (
                          <div
                            key={`${st.id}-${idx}`}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isLight ? 'bg-white border-rose-200' : 'bg-slate-900 border-rose-900/50'
                            }`}
                          >
                            <span className="font-bold block text-rose-600 dark:text-rose-400">{st.name}</span>
                            <span className="text-[10px] font-mono text-slate-500 block">ID: {st.id} • Dept: {st.dept}</span>
                            <span className="text-[10px] font-mono text-rose-500 font-bold block mt-1">Status: EXITED EMPLOYEE</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Suspension Dates Modal */}
      <EditSuspensionModal
        isOpen={!!workspaceSuspensionStaff}
        staff={workspaceSuspensionStaff}
        onClose={() => setWorkspaceSuspensionStaff(null)}
        onSave={handleSaveWorkspaceSuspension}
        onUnsuspend={handleWorkspaceUnsuspend}
        isLight={isLight}
      />
    </div>
  );
};
