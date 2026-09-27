import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ProjectFile, User, AppSettings, StaffMember, LeaveRequest } from '../types';
import { RheivatechLogo } from './RheivatechLogo';
import { LockPasswordModal } from './LockPasswordModal';
import { SettingsModal } from './SettingsModal';
import { AccessControlModal } from './AccessControlModal';
import { StaffUploadGuideModal, UploadModalMode } from './StaffUploadGuideModal';
import { UndoMoveConfirmModal } from './UndoMoveConfirmModal';
import { getLastMoveRecord, executeUndoLastMove, LastMoveDetails } from '../utils/undoMoveUtils';
import { getCompanyCurrencySymbol } from '../utils/payrollUtils';
import { StaffDirectoryView } from './StaffDirectoryView';
import { ShiftPlanningView } from './ShiftPlanningView';
import { LeavesManagementView } from './LeavesManagementView';
import { FeedingScheduleView } from './FeedingScheduleView';
import { DepartmentsView } from './DepartmentsView';
import { HelpSupportView } from './HelpSupportView';
import { PayrollView } from './PayrollView';
import { NotificationBell } from './NotificationBell';
import { ManageQueryModal } from './ManageQueryModal';
import { emitGlobalToast } from '../context/ToastContext';
import { getActiveOrganizationName } from '../utils/documentTemplates';
import {
  FileSpreadsheet,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  LogOut,
  HelpCircle,
  Trash2,
  Edit2,
  X,
  Calendar,
  Users,
  Search,
  CheckCircle2,
  Sparkles,
  Settings,
  Clock,
  Filter,
  BadgeDollarSign,
  UtensilsCrossed,
  FolderKanban,
  Upload,
  Layers,
  Shield,
  Building2,
  DollarSign,
  Undo2
} from 'lucide-react';

interface DashboardViewProps {
  user: User;
  projects: ProjectFile[];
  onUpdateProjects?: (updated: ProjectFile[]) => void;
  staffList: StaffMember[];
  onUpdateStaffList: (updated: StaffMember[]) => void;
  leaves: LeaveRequest[];
  onUpdateLeaves: (updated: LeaveRequest[]) => void;
  onOpenProject: (project: ProjectFile) => void;
  onAddNewClick: () => void;
  onToggleLockWithPassword: (projectId: string, password?: string) => void;
  onConfirmUnlockPassword: (projectId: string, passwordAttempt: string) => boolean;
  onRenameProject: (projectId: string, newName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenHelp: () => void;
  onRefreshTriggered: () => void;
  onLogout: () => void;
  settings?: AppSettings;
  onSaveSettings?: (newSettings: AppSettings) => void;
  onClearAllData?: () => void;
}

export type HRModuleTab =
  | 'directory'
  | 'departments'
  | 'attendance'
  | 'shifts'
  | 'leaves'
  | 'payroll'
  | 'feeding'
  | 'help';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  resumptionTime: '08:00',
  closingTime: '17:00',
  gracePeriodMinutes: 15,
  defaultColumns: ['Full Name', 'Employee ID', 'Check-In', 'Check-Out'],
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  projects,
  onUpdateProjects,
  staffList,
  onUpdateStaffList,
  leaves,
  onUpdateLeaves,
  onOpenProject,
  onAddNewClick,
  onToggleLockWithPassword,
  onConfirmUnlockPassword,
  onRenameProject,
  onDeleteProject,
  onOpenHelp,
  onRefreshTriggered,
  onLogout,
  settings = DEFAULT_SETTINGS,
  onSaveSettings = () => {},
  onClearAllData,
}) => {
  const [activeTab, setActiveTab] = useState<HRModuleTab>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('All Years');
  const [selectedMonth, setSelectedMonth] = useState<string>('All Months');

  // Staff Upload Guide Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalMode, setUploadModalMode] = useState<UploadModalMode>('scheme');
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
  const [lastMoveInfo, setLastMoveInfo] = useState<LastMoveDetails | null>(null);

  const activeCompanyName =
    (user?.company && user.company.trim()) ||
    getActiveOrganizationName(settings) ||
    'Company';

  const checkLastMove = React.useCallback(() => {
    const lastMove = getLastMoveRecord(activeCompanyName, staffList);
    setLastMoveInfo(lastMove);
  }, [activeCompanyName, staffList]);

  React.useEffect(() => {
    checkLastMove();
    const handleTransfersChange = () => checkLastMove();
    window.addEventListener('skima_transfers_updated', handleTransfersChange);
    window.addEventListener('skima_move_undone', handleTransfersChange);
    return () => {
      window.removeEventListener('skima_transfers_updated', handleTransfersChange);
      window.removeEventListener('skima_move_undone', handleTransfersChange);
    };
  }, [checkLastMove]);

  const handleExecuteUndo = () => {
    const result = executeUndoLastMove(
      activeCompanyName,
      staffList,
      onUpdateStaffList,
      user?.name || user?.username || 'HR Admin'
    );
    if (result.success) {
      emitGlobalToast(result.message, 'success');
      checkLastMove();
    } else {
      emitGlobalToast(result.message, 'warning');
    }
  };

  // Settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Access Control modal
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);

  const isAdmin =
    user.isAdmin === true ||
    (user.role && user.role.toLowerCase().includes('admin'));

  // Password modal states
  const [lockModalProject, setLockModalProject] = useState<ProjectFile | null>(null);
  const [lockModalMode, setLockModalMode] = useState<'lock' | 'unlock'>('lock');

  // Inline rename state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<ProjectFile | null>(null);

  // Disciplinary Query modal states
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [selectedQueryStaff, setSelectedQueryStaff] = useState<StaffMember | null>(null);
  const [selectedInitialQueryId, setSelectedInitialQueryId] = useState<string | undefined>(undefined);

  // Extract unique years from projects
  const availableYears = Array.from(
    new Set(['All Years', ...projects.map((p) => (p.monthYear ? p.monthYear.split('-')[0] : '2026'))])
  );

  // Extract unique month-years or list of months
  const monthOptions = [
    { value: 'All Months', label: 'All Months' },
    { value: '01', label: 'Jan (01)' },
    { value: '02', label: 'Feb (02)' },
    { value: '03', label: 'Mar (03)' },
    { value: '04', label: 'Apr (04)' },
    { value: '05', label: 'May (05)' },
    { value: '06', label: 'Jun (06)' },
    { value: '07', label: 'Jul (07)' },
    { value: '08', label: 'Aug (08)' },
    { value: '09', label: 'Sep (09)' },
    { value: '10', label: 'Oct (10)' },
    { value: '11', label: 'Nov (11)' },
    { value: '12', label: 'Dec (12)' },
  ];

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const mYear = p.monthYear || '2026-08';
    const [pYear, pMonth] = mYear.split('-');

    const matchesYear = selectedYear === 'All Years' || pYear === selectedYear;
    const matchesMonth =
      selectedMonth === 'All Months' ||
      pMonth === selectedMonth ||
      mYear === selectedMonth;

    return matchesSearch && matchesYear && matchesMonth;
  });

  // Calculate Days With Registered Attendance (Days where attendance was actually taken)
  const getDaysWithAttendanceTaken = (proj: ProjectFile) => {
    if (!proj.records || proj.records.length === 0) return 0;
    const daysWithRecords = new Set(
      proj.records
        .filter((r) => r.clockIn && r.clockIn.trim() !== '' && r.clockIn !== '--:--')
        .map((r) => r.dayNumber)
    );
    return daysWithRecords.size;
  };

  // 1. Staff Completeness Metric (IDs: checks if directory IDs are present in worksheet)
  const calculateStaffCompleteness = (proj: ProjectFile) => {
    const activeStaff = (staffList || []).filter((s) => s.status !== 'Exited');
    if (activeStaff.length === 0) {
      const projStaffCount = proj.staffCount || 0;
      return {
        percent: projStaffCount > 0 ? 100 : 0,
        matchedCount: projStaffCount,
        totalCount: projStaffCount,
      };
    }

    const projectStaffIds = new Set(
      (proj.records || []).map((r) => (r.employeeId || '').trim().toLowerCase()).filter(Boolean)
    );

    const matchedCount = activeStaff.filter((s) => {
      const sEmpId = (s.employeeId || '').trim().toLowerCase();
      const sId = (s.id || '').trim().toLowerCase();
      return (sEmpId && projectStaffIds.has(sEmpId)) || (sId && projectStaffIds.has(sId));
    }).length;

    const totalCount = activeStaff.length;
    const percent = totalCount > 0 ? Math.min(100, Math.round((matchedCount / totalCount) * 100)) : 100;

    return {
      percent,
      matchedCount,
      totalCount,
    };
  };

  // 2. Date / Timeline Completeness Metric (Checks if all days in the month have records logged)
  const calculateDateCompleteness = (proj: ProjectFile) => {
    const daysInMonth = proj.daysInMonth || 30;
    if (!proj.records || proj.records.length === 0 || daysInMonth === 0) {
      return {
        percent: 0,
        daysWithRecords: 0,
        totalDays: daysInMonth,
      };
    }

    const daysWithRecords = getDaysWithAttendanceTaken(proj);
    const percent = Math.min(100, Math.round((daysWithRecords / daysInMonth) * 100));

    return {
      percent,
      daysWithRecords,
      totalDays: daysInMonth,
    };
  };

  const handleStartRename = (proj: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (proj.isLocked) return;
    setEditingProjectId(proj.id);
    setEditingName(proj.name.replace(/\.csv$/, ''));
  };

  const handleSaveRename = (projectId: string) => {
    if (editingName.trim()) {
      onRenameProject(projectId, editingName.trim());
      emitGlobalToast(`Worksheet renamed to "${editingName.trim()}"`, 'success');
    }
    setEditingProjectId(null);
  };

  const handleOpenLockModal = (proj: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setLockModalProject(proj);
    setLockModalMode(proj.isLocked ? 'unlock' : 'lock');
  };

  const handleImportStaff = (importedStaff: StaffMember[]) => {
    const matchedCurrentIds = new Set<string>();
    const updatedRoster: StaffMember[] = [];

    const norm = (str?: string) => (str || '').trim().toLowerCase();

    // Map existing staff by normalized employeeId or ID
    const existingStaffMap = new Map<string, StaffMember>();
    staffList.forEach((s) => {
      if (s.employeeId && s.employeeId.toUpperCase() !== 'N/A') {
        existingStaffMap.set(norm(s.employeeId), s);
      }
      existingStaffMap.set(norm(s.id), s);
    });

    importedStaff.forEach((imp) => {
      const impId = norm(imp.employeeId);
      const impName = norm(imp.name);

      let existingMatch: StaffMember | undefined;
      if (impId && impId !== 'n/a' && existingStaffMap.has(impId)) {
        existingMatch = existingStaffMap.get(impId);
      } else {
        existingMatch = staffList.find((curr) => {
          const currName = norm(curr.name);
          return impName && currName && currName === impName;
        });
      }

      if (existingMatch) {
        matchedCurrentIds.add(existingMatch.id);
        updatedRoster.push({
          ...existingMatch,
          employeeId: imp.employeeId && imp.employeeId !== 'N/A' ? imp.employeeId : existingMatch.employeeId,
          name: imp.name || existingMatch.name,
          department: imp.department || existingMatch.department,
          role: imp.role || existingMatch.role,
          email: imp.email || existingMatch.email,
          phone: imp.phone || existingMatch.phone,
          payGrade: imp.payGrade || existingMatch.payGrade,
          estimatedMonthlySalary: imp.estimatedMonthlySalary !== undefined ? imp.estimatedMonthlySalary : existingMatch.estimatedMonthlySalary,
          shiftSchedule: imp.shiftSchedule || existingMatch.shiftSchedule,
          bankName: imp.bankName || existingMatch.bankName,
          accountNumber: imp.accountNumber || existingMatch.accountNumber,
          status: imp.status || existingMatch.status,
          joinDate: imp.joinDate || existingMatch.joinDate,
          exitDate: imp.exitDate || existingMatch.exitDate,
          exitReason: imp.exitReason || existingMatch.exitReason,
          suspensionEndTime: imp.suspensionEndTime || existingMatch.suspensionEndTime,
          suspensionReason: imp.suspensionReason || existingMatch.suspensionReason,
        });
      } else {
        updatedRoster.push(imp);
      }
    });

    // Retain all existing staff who were not in this imported batch
    staffList.forEach((curr) => {
      if (!matchedCurrentIds.has(curr.id)) {
        updatedRoster.push(curr);
      }
    });

    onUpdateStaffList(updatedRoster);
    emitGlobalToast(`Imported and synchronized ${importedStaff.length} staff records`, 'success');
  };

  const isLight = settings?.theme === 'light';

  // Dedicated Full-Page Payroll Workspace View (Clean without Dashboard top headers & tabs)
  if (activeTab === 'payroll') {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans transition-colors ${
          isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
        }`}
      >
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <PayrollView
            staffList={staffList}
            isLight={isLight}
            settings={settings}
            user={user}
            onBack={() => setActiveTab('directory')}
            onUpdateStaffList={onUpdateStaffList}
            onUpdateSettings={onSaveSettings}
          />
        </main>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Staff Upload Guide Modal */}
      <StaffUploadGuideModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImportStaff={handleImportStaff}
        existingStaffList={staffList}
        mode={uploadModalMode}
        settings={settings}
        onSaveSettings={onSaveSettings}
        companyName={activeCompanyName}
      />

      {/* Undo Last Move Confirmation Modal */}
      <UndoMoveConfirmModal
        isOpen={isUndoModalOpen}
        onClose={() => setIsUndoModalOpen(false)}
        moveDetails={lastMoveInfo}
        onConfirmUndo={handleExecuteUndo}
        isLight={isLight}
        currencySymbol={getCompanyCurrencySymbol(activeCompanyName)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={onSaveSettings}
        onClearAllData={onClearAllData}
        onNavigateToDepartments={() => setActiveTab('departments')}
        onOpenAccessControl={isAdmin ? () => setIsAccessControlOpen(true) : undefined}
        currentUser={user}
      />

      {/* Access Control Modal */}
      <AccessControlModal
        isOpen={isAccessControlOpen}
        onClose={() => setIsAccessControlOpen(false)}
        currentUser={user}
        theme={settings?.theme}
      />

      {/* Password Lock Modal */}
      {lockModalProject && (
        <LockPasswordModal
          isOpen={!!lockModalProject}
          mode={lockModalMode}
          fileName={lockModalProject.name}
          onClose={() => setLockModalProject(null)}
          onConfirmLock={(password) => {
            onToggleLockWithPassword(lockModalProject.id, password);
          }}
          onConfirmUnlock={(passwordAttempt) => {
            const success = onConfirmUnlockPassword(lockModalProject.id, passwordAttempt);
            if (success) {
              onToggleLockWithPassword(lockModalProject.id, '');
            }
            return success;
          }}
        />
      )}

      {/* Top Navigation Bar */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl px-4 lg:px-8 py-3.5 flex items-center justify-between border-b transition-colors ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-sm'
            : 'bg-slate-900/90 border-slate-800/80 text-white'
        }`}
      >
        <div className="flex items-center gap-4">
          <RheivatechLogo size="md" showSubtext theme={isLight ? 'light' : 'dark'} />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Undo Last Move Button (Icon-only) */}
          <button
            id="undo-last-move-header-btn"
            onClick={() => {
              if (lastMoveInfo) {
                setIsUndoModalOpen(true);
              } else {
                emitGlobalToast('No recent staff moves found to undo.', 'info');
              }
            }}
            disabled={!lastMoveInfo}
            title={lastMoveInfo ? 'Undo Last Move' : 'No recent staff moves to undo'}
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center transition cursor-pointer border ${
              lastMoveInfo
                ? isLight
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-sm active:scale-95'
                  : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border-amber-700/80 shadow-sm active:scale-95'
                : isLight
                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                  : 'opacity-40 cursor-not-allowed bg-slate-800/60 text-slate-500 border-slate-800'
            }`}
          >
            <Undo2 className="w-4 h-4 text-amber-500" />
          </button>

          <button
            onClick={() => {
              setUploadModalMode('scheme');
              setIsUploadModalOpen(true);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
              isLight
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-blue-950/60 text-blue-300 border-blue-800/80 hover:bg-blue-900/80'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Upload Scheme</span>
          </button>

          {/* Access Control Button - Only visible to Admin */}
          {isAdmin && (
            <button
              onClick={() => setIsAccessControlOpen(true)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-sm ${
                isLight
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-indigo-100/50'
                  : 'bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 hover:text-white border-indigo-800/80 shadow-indigo-950/50'
              }`}
              title="Organization Access & Team Permissions"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-xs font-bold">Access</span>
            </button>
          )}

          <button
            onClick={onRefreshTriggered}
            title="Trigger 3-Second Preloader Refresh"
            className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95 border ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <NotificationBell
            staffList={staffList}
            isLight={isLight}
            companyName={user?.company}
            onNavigateToPayroll={() => setActiveTab('payroll')}
            onNavigateToWelfare={() => setActiveTab('directory')}
            onOpenStaffQuery={(staffId, queryId) => {
              const matched = staffList.find((s) => s.id === staffId || s.employeeId === staffId);
              if (matched) {
                setSelectedQueryStaff(matched);
                setSelectedInitialQueryId(queryId);
                setIsQueryModalOpen(true);
              }
            }}
          />

          {/* Settings Button (Icon-only, positioned right beside notifications) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center border ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
            }`}
            title="Skima Configurations & Settings"
          >
            <Settings className="w-4 h-4 text-blue-500" />
          </button>

          <button
            onClick={() => {
              setActiveTab('help');
              onOpenHelp?.();
            }}
            className={`p-2.5 rounded-xl text-xs transition cursor-pointer border ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
            }`}
            title="System Guide"
          >
            <HelpCircle className="w-4 h-4 text-blue-500" />
          </button>

          <div
            className={`hidden md:flex items-center gap-2 pl-2 border-l ${
              isLight ? 'border-slate-200' : 'border-slate-800'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold font-mono text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col text-left">
              <span className={`text-xs font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {user.name}
              </span>
              <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {user.company}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center transition cursor-pointer ml-1 ${
              isLight
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                : 'bg-red-950/60 hover:bg-red-900/80 text-red-200 border-red-800/60'
            }`}
            title="Log Out of Skima"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Module Tab Switcher */}
        <div
          className={`p-1.5 rounded-2xl border flex items-center gap-1 overflow-x-auto ${
            isLight
              ? 'bg-slate-200/80 border-slate-300'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          {/* Tab 1: Staff Directory */}
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Directory</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'directory'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {staffList.length}
            </span>
          </button>

          {/* Tab: Departments */}
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'departments'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments</span>
          </button>

          {/* Tab 2: Attendance Matrices */}
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Attendance Worksheets</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'attendance'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {projects.length}
            </span>
          </button>

          {/* Tab 3: Shift Roster */}
          <button
            onClick={() => setActiveTab('shifts')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'shifts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Shifts & Rosters</span>
          </button>

          {/* Tab 4: Leaves & Offs */}
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'leaves'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Leaves & Offs</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'leaves'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {leaves.length}
            </span>
          </button>

          {/* Tab 5: Feeding Schedule */}
          <button
            onClick={() => setActiveTab('feeding')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'feeding'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Feeding Schedule</span>
          </button>

          {/* Tab 6: Help & Support */}
          <button
            onClick={() => setActiveTab('help')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'help'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Help & Support</span>
          </button>
        </div>

        {/* View Switching */}
        {activeTab === 'help' && (
          <HelpSupportView
            user={user}
            settings={settings}
            staffList={staffList}
            projects={projects}
            leaves={leaves}
            isLight={isLight}
            onNavigateTab={(tab) => setActiveTab(tab as HRModuleTab)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAccessControl={() => setIsAccessControlOpen(true)}
          />
        )}

        {activeTab === 'directory' && (
          <StaffDirectoryView
            staffList={staffList}
            projects={projects}
            leaves={leaves}
            onUpdateStaffList={onUpdateStaffList}
            onUpdateProjects={onUpdateProjects}
            onOpenUploadModal={(uploadMode) => {
              setUploadModalMode(uploadMode || 'active');
              setIsUploadModalOpen(true);
            }}
            onOpenPayrollWorkspace={() => setActiveTab('payroll')}
            isLight={isLight}
            settings={settings}
            onUpdateSettings={onSaveSettings}
            user={user}
          />
        )}

        {activeTab === 'departments' && (
          <DepartmentsView
            staffList={staffList}
            onUpdateStaffList={onUpdateStaffList}
            isLight={isLight}
            settings={settings}
            user={user}
          />
        )}

        {activeTab === 'shifts' && (
          <ShiftPlanningView
            staffList={staffList}
            onUpdateStaffList={onUpdateStaffList}
            isLight={isLight}
            settings={settings}
            onSaveSettings={onSaveSettings}
          />
        )}

        {activeTab === 'leaves' && (
          <LeavesManagementView
            staffList={staffList}
            leaves={leaves}
            onUpdateLeaves={onUpdateLeaves}
            onUpdateStaffList={onUpdateStaffList}
            isLight={isLight}
            settings={settings}
          />
        )}

        {activeTab === 'feeding' && (
          <FeedingScheduleView
            staffList={staffList}
            isLight={isLight}
            settings={settings}
            leaves={leaves}
            user={user}
          />
        )}

        {/* Tab 2: Attendance Worksheets Grid */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Banner Section */}
            <div
              className={`rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
                  : 'bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-slate-800 text-white shadow-2xl'
              }`}
            >
              <div className="space-y-2 max-w-2xl">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs border ${
                    isLight
                      ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Password Lock Access Control Active</span>
                </div>
                <h1
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Skima Time Attendance Worksheets
                </h1>
                <p
                  className={`text-xs sm:text-sm leading-relaxed font-sans ${
                    isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  Manage monthly staff attendance logs with rigid{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                    % Compiled
                  </span>{' '}
                  completeness metrics, customizable CSV/Excel headers, and password protection.
                </p>
              </div>

              <button
                onClick={onAddNewClick}
                className="shrink-0 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Add New File</span>
              </button>
            </div>

            {/* Search, Year & Month Filter Toolbar */}
            <div
              className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl border ${
                isLight
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="relative flex-1">
                <Search
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-400'
                  }`}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search file name or date..."
                  className={`w-full pl-10 pr-4 py-2 rounded-xl outline-none focus:border-blue-500 text-xs font-mono border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      : 'bg-slate-800/80 border-slate-700/80 text-white placeholder-slate-500'
                  }`}
                />
              </div>

              {/* Year & Month Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-xs font-mono text-slate-400 shrink-0">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono outline-none border cursor-pointer shrink-0 ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                <span className="text-xs font-mono text-slate-400 shrink-0 ml-1">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono outline-none border cursor-pointer shrink-0 ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Worksheets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => {
                const staffMetric = calculateStaffCompleteness(project);
                const dateMetric = calculateDateCompleteness(project);
                const isEditingThis = editingProjectId === project.id;

                return (
                  <motion.div
                    key={project.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      if (project.isLocked) {
                        setLockModalProject(project);
                        setLockModalMode('unlock');
                      } else {
                        onOpenProject(project);
                      }
                    }}
                    className={`group relative rounded-3xl p-5 border transition-all cursor-pointer flex flex-col justify-between space-y-4 shadow-xl ${
                      project.isLocked
                        ? isLight
                          ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                          : 'bg-slate-900/90 border-amber-500/40 hover:border-amber-500/60 shadow-amber-950/20'
                        : isLight
                        ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
                        : 'bg-slate-900/80 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 shadow-slate-950/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`p-3 rounded-2xl shrink-0 ${
                            project.isLocked
                              ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>

                        <div className="flex-1 min-w-0 pr-1">
                          {isEditingThis ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(project.id);
                                }}
                                className={`w-full px-2 py-1 rounded border text-xs font-mono outline-none ${
                                  isLight
                                    ? 'bg-slate-100 border-blue-500 text-slate-900'
                                    : 'bg-slate-800 border-blue-500 text-white'
                                }`}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRename(project.id)}
                                className="px-2 py-1 rounded bg-blue-600 text-white text-xs font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <h3 className={`font-bold text-sm transition-colors break-words leading-snug ${isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-300'}`}>
                              {project.name}
                            </h3>
                          )}
                          <p className={`text-[11px] font-mono mt-1 flex items-center gap-2 flex-wrap ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3 text-blue-500" />
                            <span>Month: {project.monthYear || '2026-08'}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                              {dateMetric.daysWithRecords}/{dateMetric.totalDays} days
                            </span>
                          </p>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleOpenLockModal(project, e)}
                          title={
                            project.isLocked
                              ? 'Locked (Click to Unlock)'
                              : 'Unlocked (Click to Lock)'
                          }
                          className={`p-2 rounded-xl transition-colors ${
                            project.isLocked
                              ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 hover:bg-amber-500/30 border border-amber-500/40'
                              : isLight
                              ? 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {project.isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>

                        {!project.isLocked && (
                          <>
                            <button
                              onClick={(e) => handleStartRename(project, e)}
                              title="Rename File"
                              className={`p-2 rounded-xl transition-colors ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmProject(project);
                              }}
                              title="Delete File"
                              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600'
                                  : 'bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dual Completeness Metric Bars */}
                    <div className={`pt-3 border-t space-y-3 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                      {/* Bar 1: Staff Completeness (IDs) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className={`uppercase tracking-wider text-[10px] font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Users className="w-3 h-3 text-blue-500" />
                            Staff Completeness (IDs)
                          </span>
                          <span
                            className={`font-extrabold text-xs ${
                              staffMetric.percent === 100
                                ? 'text-emerald-500 dark:text-emerald-400'
                                : staffMetric.percent >= 50
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-amber-500 dark:text-amber-400'
                            }`}
                          >
                            {staffMetric.matchedCount}/{staffMetric.totalCount} IDs ({staffMetric.percent}%)
                          </span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700/50'}`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              staffMetric.percent === 100
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : staffMetric.percent >= 50
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-400'
                                : 'bg-gradient-to-r from-amber-500 to-orange-400'
                            }`}
                            style={{ width: `${staffMetric.percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Bar 2: Date Completeness (Days with Attendance Logged) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className={`uppercase tracking-wider text-[10px] font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3 text-emerald-500" />
                            Days Logged / Passed
                          </span>
                          <span
                            className={`font-extrabold text-xs ${
                              dateMetric.percent >= 80
                                ? 'text-emerald-500 dark:text-emerald-400'
                                : dateMetric.percent >= 40
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-amber-500 dark:text-amber-400'
                            }`}
                          >
                            {dateMetric.daysWithRecords}/{dateMetric.totalDays} Days ({dateMetric.percent}%)
                          </span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700/50'}`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              dateMetric.percent >= 80
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : dateMetric.percent >= 40
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-400'
                                : 'bg-gradient-to-r from-amber-500 to-orange-400'
                            }`}
                            style={{ width: `${dateMetric.percent}%` }}
                          />
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-mono pt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          {project.staffCount || staffMetric.totalCount || 5} Worksheet Staff
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'}`}>
                          {project.category || 'HQ Operations'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-4">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-white">No Worksheet Files Found</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Create a new Skima time attendance file to begin logging monthly matrix sheets.
                  </p>
                </div>
                <button
                  onClick={onAddNewClick}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New File</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-5 text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Delete Attendance Worksheet</h3>
                    <p className="text-xs font-mono text-slate-400">Irreversible Action</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirmProject(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <p>
                  Are you sure you want to permanently delete the attendance worksheet <strong className="text-white font-mono">{deleteConfirmProject.name}</strong>?
                </p>
                <p className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-400">
                  This will erase all logged daily attendance matrix entries, staff counts, and completeness metrics for this file.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmProject(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProject(deleteConfirmProject.id);
                    setDeleteConfirmProject(null);
                  }}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Worksheet</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disciplinary Manage Query Modal */}
        {selectedQueryStaff && (
          <ManageQueryModal
            isOpen={isQueryModalOpen}
            onClose={() => {
              setIsQueryModalOpen(false);
              setSelectedQueryStaff(null);
              setSelectedInitialQueryId(undefined);
            }}
            staff={selectedQueryStaff}
            companyName={user?.company || 'Rheivatech'}
            currentUser={user}
            settings={settings}
            isLight={isLight}
            initialQueryId={selectedInitialQueryId}
            onStaffUpdated={(updated) => {
              const updatedList = staffList.map((s) => (s.id === updated.id ? updated : s));
              onUpdateStaffList(updatedList);
              setSelectedQueryStaff(updated);
            }}
          />
        )}
      </main>
    </div>
  );
};
