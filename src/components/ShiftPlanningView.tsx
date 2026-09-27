import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Users,
  Sun,
  Moon,
  Sunset,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Building2,
  Sliders,
  Sparkles,
  X,
  Save,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Layers,
  ChevronDown,
  Search,
  CalendarCheck,
} from 'lucide-react';
import { StaffMember, AppSettings, ShiftRosterTemplate } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { getActiveOrganizationName } from '../utils/documentTemplates';
import { emitGlobalToast } from '../context/ToastContext';

interface ShiftPlanningViewProps {
  staffList: StaffMember[];
  onUpdateStaffList: (updated: StaffMember[]) => void;
  isLight?: boolean;
  settings?: AppSettings;
  onSaveSettings?: (updated: AppSettings) => void;
}

export const ShiftPlanningView: React.FC<ShiftPlanningViewProps> = ({
  staffList,
  onUpdateStaffList,
  isLight = false,
  settings,
  onSaveSettings,
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [selectedShift, setSelectedShift] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      emitGlobalToast(notification, 'info');
    }
  }, [notification]);

  const [bulkShiftTarget, setBulkShiftTarget] = useState<string>('Morning Shift');

  // Shift Template UI states
  const [isSaveAsDropdownOpen, setIsSaveAsDropdownOpen] = useState(false);
  const [isNewTemplateModalOpen, setIsNewTemplateModalOpen] = useState(false);
  const [newTemplateNameInput, setNewTemplateNameInput] = useState('');
  const [isRenameTemplateModalOpen, setIsRenameTemplateModalOpen] = useState(false);
  const [renameTemplateInput, setRenameTemplateInput] = useState('');
  const [templateToDelete, setTemplateToDelete] = useState<ShiftRosterTemplate | null>(null);

  // Unsaved Switch Modal State
  const [isUnsavedSwitchModalOpen, setIsUnsavedSwitchModalOpen] = useState(false);
  const [pendingSwitchTemplateId, setPendingSwitchTemplateId] = useState<string | null>(null);

  // Import Modal State
  const [isImportShiftModalOpen, setIsImportShiftModalOpen] = useState(false);
  const [shiftImportInput, setShiftImportInput] = useState('');

  const baseShifts = settings?.shifts && settings.shifts.length > 0
    ? settings.shifts
    : [
        { id: '1', name: 'Morning Shift', startTime: '08:00', endTime: '17:00', gracePeriodMinutes: 15, color: '#f59e0b' },
        { id: '2', name: 'Afternoon Shift', startTime: '14:00', endTime: '22:00', gracePeriodMinutes: 15, color: '#f97316' },
        { id: '3', name: 'Night Shift', startTime: '22:00', endTime: '06:00', gracePeriodMinutes: 15, color: '#6366f1' },
      ];

  const availableShifts = [
    ...baseShifts,
    { id: 'na', name: 'N/A', startTime: 'N/A', endTime: 'N/A', gracePeriodMinutes: 0, color: '#94a3b8' },
  ];

  const defaultShiftName = availableShifts[0]?.name || 'Morning Shift';

  // EXITED STAFF FILTER: Exited personnel are strictly excluded from shifts and rosters!
  const activeStaffList = staffList.filter((s) => s.status !== 'Exited');

  const getMatchedShift = (staffShift: string) => {
    if (!staffShift || staffShift === 'N/A') return 'N/A';
    const sTrim = staffShift.trim().toLowerCase();
    const found = availableShifts.find((s) => {
      const aTrim = s.name.trim().toLowerCase();
      if (aTrim === sTrim) return true;
      if (sTrim.length >= 3 && (aTrim.includes(sTrim) || sTrim.includes(aTrim))) return true;
      return false;
    });
    return found ? found.name : staffShift;
  };

  const departments = ['All', ...Array.from(new Set(activeStaffList.map((s) => s.department)))];

  // Template State & Handlers
  const savedTemplates: ShiftRosterTemplate[] = React.useMemo(() => {
    if (settings?.savedRosterTemplates && settings.savedRosterTemplates.length > 0) {
      return settings.savedRosterTemplates;
    }
    const currentAssignments: Record<string, string> = {};
    activeStaffList.forEach((s) => {
      if (s.employeeId) currentAssignments[s.employeeId] = s.shiftSchedule || defaultShiftName;
      if (s.id) currentAssignments[s.id] = s.shiftSchedule || defaultShiftName;
    });
    return [
      {
        id: 'template-1',
        name: 'Template 1',
        assignments: currentAssignments,
        createdAt: new Date().toISOString().split('T')[0],
      },
    ];
  }, [settings?.savedRosterTemplates, activeStaffList, defaultShiftName]);

  const [currentTemplateId, setCurrentTemplateId] = useState<string>(() => {
    return settings?.activeTemplateId || savedTemplates[0]?.id || 'template-1';
  });

  const activeTemplateId = currentTemplateId || settings?.activeTemplateId || savedTemplates[0]?.id || 'template-1';
  const activeTemplate = savedTemplates.find((t) => t.id === activeTemplateId) || savedTemplates[0];

  // Helper to extract baseline assignments for a given template
  const getTemplateAssignmentsMap = (tmpl: ShiftRosterTemplate | undefined): Record<string, string> => {
    const map: Record<string, string> = {};
    if (tmpl?.assignments && Object.keys(tmpl.assignments).length > 0) {
      Object.assign(map, tmpl.assignments);
    }
    activeStaffList.forEach((s) => {
      const key = s.employeeId || s.id;
      if (!map[key] && !map[s.id] && !map[s.employeeId]) {
        map[key] = s.shiftSchedule || defaultShiftName;
      }
    });
    return map;
  };

  // Draft and Saved Assignment Maps
  const [savedAssignments, setSavedAssignments] = useState<Record<string, string>>(() =>
    getTemplateAssignmentsMap(activeTemplate)
  );
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string>>(() =>
    getTemplateAssignmentsMap(activeTemplate)
  );

  // Sync if activeTemplate changes externally
  React.useEffect(() => {
    if (settings?.activeTemplateId && settings.activeTemplateId !== currentTemplateId) {
      const target = savedTemplates.find((t) => t.id === settings.activeTemplateId);
      if (target) {
        setCurrentTemplateId(target.id);
        const map = getTemplateAssignmentsMap(target);
        setSavedAssignments(map);
        setDraftAssignments(map);
      }
    }
  }, [settings?.activeTemplateId]);

  const getStaffDraftShift = (staff: StaffMember): string => {
    const key = staff.employeeId || staff.id;
    if (draftAssignments[key] !== undefined) return draftAssignments[key];
    if (staff.id && draftAssignments[staff.id] !== undefined) return draftAssignments[staff.id];
    if (staff.employeeId && draftAssignments[staff.employeeId] !== undefined) return draftAssignments[staff.employeeId];
    return staff.shiftSchedule || defaultShiftName;
  };

  const getStaffSavedShift = (staff: StaffMember): string => {
    const key = staff.employeeId || staff.id;
    if (savedAssignments[key] !== undefined) return savedAssignments[key];
    if (staff.id && savedAssignments[staff.id] !== undefined) return savedAssignments[staff.id];
    if (staff.employeeId && savedAssignments[staff.employeeId] !== undefined) return savedAssignments[staff.employeeId];
    return staff.shiftSchedule || defaultShiftName;
  };

  // Calculate unsaved changes count
  const unsavedChangesCount = React.useMemo(() => {
    let count = 0;
    for (const staff of activeStaffList) {
      const draft = getStaffDraftShift(staff);
      const saved = getStaffSavedShift(staff);
      if (draft !== saved) {
        count++;
      }
    }
    return count;
  }, [activeStaffList, draftAssignments, savedAssignments]);

  // Window beforeunload listener when unsaved changes exist
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChangesCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChangesCount]);

  // Auto-record today's template entity snapshot if today has not been locked yet
  React.useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (
      activeTemplate &&
      onSaveSettings &&
      settings &&
      (!settings.dailyShiftRosterHistory || !settings.dailyShiftRosterHistory[todayStr])
    ) {
      const targetAssignments = getTemplateAssignmentsMap(activeTemplate);
      const updatedDailyHistory = recordDailySnapshot(
        activeTemplate.id,
        activeTemplate.name,
        targetAssignments,
        settings
      );
      onSaveSettings({
        ...settings,
        dailyShiftRosterHistory: updatedDailyHistory,
      });
    }
  }, [activeTemplate?.id]);

  // Working Staff List for UI, search, and distribution metrics
  const workingStaffList = React.useMemo(() => {
    return activeStaffList.map((s) => ({
      ...s,
      shiftSchedule: getStaffDraftShift(s),
    }));
  }, [activeStaffList, draftAssignments, savedAssignments]);

  const filteredStaff = workingStaffList.filter((s) => {
    const matchesDept = selectedDepartment === 'All' || s.department === selectedDepartment;
    const matchesShift =
      selectedShift === 'All' ||
      getMatchedShift(s.shiftSchedule).toLowerCase() === selectedShift.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.employeeId.toLowerCase().includes(query) ||
      (s.department || '').toLowerCase().includes(query) ||
      (s.role || '').toLowerCase().includes(query);
    return matchesDept && matchesShift && matchesSearch;
  });

  // Switch template handler (checks for unsaved changes first)
  const handleRequestSwitchTemplate = (targetTemplateId: string) => {
    if (targetTemplateId === activeTemplateId) return;

    if (unsavedChangesCount > 0) {
      setPendingSwitchTemplateId(targetTemplateId);
      setIsUnsavedSwitchModalOpen(true);
      return;
    }

    doApplyTemplate(targetTemplateId);
  };

  // Helper to record date-locked template entity for tight worksheet accuracy (overrides today, preserves history)
  const recordDailySnapshot = (
    templateId: string,
    templateName: string,
    assignments: Record<string, string>,
    baseSettings?: AppSettings
  ): Record<string, any> => {
    const todayStr = new Date().toISOString().split('T')[0];
    const prevHistory = { ...(baseSettings?.dailyShiftRosterHistory || settings?.dailyShiftRosterHistory || {}) };
    prevHistory[todayStr] = {
      date: todayStr,
      templateId,
      templateName,
      assignments: { ...assignments },
      savedAt: new Date().toISOString(),
    };
    return prevHistory;
  };

  // Perform actual switch to a template
  const doApplyTemplate = (templateId: string) => {
    const targetTmpl = savedTemplates.find((t) => t.id === templateId);
    if (!targetTmpl) return;

    const targetAssignments = getTemplateAssignmentsMap(targetTmpl);

    let updatedCount = 0;
    const updatedStaff = staffList.map((s) => {
      if (s.status === 'Exited') return s;
      const assignedShift =
        targetAssignments[s.employeeId] ||
        targetAssignments[s.id] ||
        (s.name ? targetAssignments[s.name] : undefined);

      if (assignedShift) {
        if (assignedShift !== s.shiftSchedule) updatedCount++;
        return { ...s, shiftSchedule: assignedShift };
      } else if (Object.keys(targetAssignments).length > 0) {
        if (s.shiftSchedule !== defaultShiftName) updatedCount++;
        return { ...s, shiftSchedule: defaultShiftName };
      }
      return s;
    });

    onUpdateStaffList(updatedStaff);

    const updatedDailyHistory = recordDailySnapshot(targetTmpl.id, targetTmpl.name, targetAssignments);

    if (onSaveSettings && settings) {
      onSaveSettings({
        ...settings,
        activeTemplateId: templateId,
        dailyShiftRosterHistory: updatedDailyHistory,
      });
    }

    setCurrentTemplateId(templateId);
    setSavedAssignments({ ...targetAssignments });
    setDraftAssignments({ ...targetAssignments });
    setIsUnsavedSwitchModalOpen(false);
    setPendingSwitchTemplateId(null);
    setNotification(`Switched to "${targetTmpl.name}" (Active & locked for today's worksheet entity).`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Discard all staged draft changes and revert to saved assignments
  const handleDiscardChanges = () => {
    setDraftAssignments({ ...savedAssignments });
    setNotification('Discarded all unsaved shift changes.');
    setTimeout(() => setNotification(null), 3000);
  };

  // Save current draft roster assignments to the active template
  const handleSaveToCurrentTemplate = () => {
    if (!onSaveSettings || !settings || !activeTemplate) return;

    const currentAssignments: Record<string, string> = {};
    const updatedStaffList = staffList.map((s) => {
      if (s.status === 'Exited') return s;
      const assignedShift = getStaffDraftShift(s);
      if (s.employeeId) currentAssignments[s.employeeId] = assignedShift;
      if (s.id) currentAssignments[s.id] = assignedShift;
      return { ...s, shiftSchedule: assignedShift };
    });

    const updatedTemplates = savedTemplates.map((t) =>
      t.id === activeTemplate.id ? { ...t, assignments: currentAssignments } : t
    );

    const updatedDailyHistory = recordDailySnapshot(activeTemplate.id, activeTemplate.name, currentAssignments);

    onSaveSettings({
      ...settings,
      savedRosterTemplates: updatedTemplates,
      activeTemplateId: activeTemplate.id,
      dailyShiftRosterHistory: updatedDailyHistory,
    });

    onUpdateStaffList(updatedStaffList);

    setSavedAssignments({ ...currentAssignments });
    setDraftAssignments({ ...currentAssignments });
    setIsSaveAsDropdownOpen(false);
    setNotification(`Saved all shift changes to "${activeTemplate.name}" & updated today's worksheet baseline.`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Save current draft roster assignments as a new template
  const handleSaveAsNewTemplate = (customName?: string) => {
    if (!onSaveSettings || !settings) return;

    const currentAssignments: Record<string, string> = {};
    const updatedStaffList = staffList.map((s) => {
      if (s.status === 'Exited') return s;
      const assignedShift = getStaffDraftShift(s);
      if (s.employeeId) currentAssignments[s.employeeId] = assignedShift;
      if (s.id) currentAssignments[s.id] = assignedShift;
      return { ...s, shiftSchedule: assignedShift };
    });

    const templateNumber = savedTemplates.length + 1;
    const finalName = customName?.trim() || `Template ${templateNumber}`;

    const newTemplate: ShiftRosterTemplate = {
      id: `template-${Date.now()}`,
      name: finalName,
      assignments: currentAssignments,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedTemplates = [...savedTemplates, newTemplate];
    const updatedDailyHistory = recordDailySnapshot(newTemplate.id, finalName, currentAssignments);

    onSaveSettings({
      ...settings,
      savedRosterTemplates: updatedTemplates,
      activeTemplateId: newTemplate.id,
      dailyShiftRosterHistory: updatedDailyHistory,
    });

    onUpdateStaffList(updatedStaffList);

    setCurrentTemplateId(newTemplate.id);
    setSavedAssignments({ ...currentAssignments });
    setDraftAssignments({ ...currentAssignments });
    setIsSaveAsDropdownOpen(false);
    setIsNewTemplateModalOpen(false);
    setNewTemplateNameInput('');
    setNotification(`Created and activated "${finalName}" with saved shift assignments!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Duplicate current template
  const handleDuplicateTemplate = () => {
    if (!onSaveSettings || !settings || !activeTemplate) return;

    const currentAssignments: Record<string, string> = { ...(activeTemplate.assignments || {}) };
    activeStaffList.forEach((s) => {
      const assignedShift = getStaffDraftShift(s);
      if (s.employeeId) currentAssignments[s.employeeId] = assignedShift;
      if (s.id) currentAssignments[s.id] = assignedShift;
    });

    const newTemplate: ShiftRosterTemplate = {
      id: `template-${Date.now()}`,
      name: `${activeTemplate.name} (Copy)`,
      assignments: currentAssignments,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedTemplates = [...savedTemplates, newTemplate];
    const updatedDailyHistory = recordDailySnapshot(newTemplate.id, newTemplate.name, currentAssignments);

    onSaveSettings({
      ...settings,
      savedRosterTemplates: updatedTemplates,
      activeTemplateId: newTemplate.id,
      dailyShiftRosterHistory: updatedDailyHistory,
    });

    setCurrentTemplateId(newTemplate.id);
    setSavedAssignments({ ...currentAssignments });
    setDraftAssignments({ ...currentAssignments });
    setNotification(`Duplicated template as "${newTemplate.name}".`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Delete current template
  const handleDeleteTemplate = (templateId: string) => {
    if (savedTemplates.length <= 1) {
      setNotification('Cannot delete the only remaining template.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const targetTmpl = savedTemplates.find((t) => t.id === templateId);
    if (!targetTmpl) return;

    const remainingTemplates = savedTemplates.filter((t) => t.id !== templateId);
    const nextActive = remainingTemplates[0];

    if (onSaveSettings && settings) {
      onSaveSettings({
        ...settings,
        savedRosterTemplates: remainingTemplates,
        activeTemplateId: nextActive.id,
      });
    }

    // Apply next template to staff list
    const nextAssignments = getTemplateAssignmentsMap(nextActive);
    const updatedStaff = staffList.map((s) => {
      if (s.status === 'Exited') return s;
      const assignedShift =
        nextAssignments[s.employeeId] ||
        nextAssignments[s.id] ||
        (s.name ? nextAssignments[s.name] : undefined);
      return assignedShift ? { ...s, shiftSchedule: assignedShift } : s;
    });

    onUpdateStaffList(updatedStaff);
    setCurrentTemplateId(nextActive.id);
    setSavedAssignments({ ...nextAssignments });
    setDraftAssignments({ ...nextAssignments });
    setNotification(`Deleted template "${targetTmpl.name}" and switched to "${nextActive.name}".`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Rename current template
  const handleRenameTemplate = (newName: string) => {
    if (!onSaveSettings || !settings || !activeTemplate || !newName.trim()) return;

    const updatedTemplates = savedTemplates.map((t) =>
      t.id === activeTemplate.id ? { ...t, name: newName.trim() } : t
    );

    onSaveSettings({
      ...settings,
      savedRosterTemplates: updatedTemplates,
      activeTemplateId: activeTemplate.id,
    });

    setIsRenameTemplateModalOpen(false);
    setRenameTemplateInput('');
    setNotification(`Renamed template to "${newName.trim()}".`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Staged local shift change in draft only (not saved until user explicitly saves)
  const handleShiftChange = (employeeId: string, newShift: string) => {
    const targetStaff = staffList.find((s) => s.id === employeeId || s.employeeId === employeeId);
    const key = targetStaff?.employeeId || employeeId;
    setDraftAssignments((prev) => ({
      ...prev,
      [key]: newShift,
      [employeeId]: newShift,
    }));
  };

  // Staged bulk shift update in draft only (not saved until user explicitly saves)
  const handleApplyBulkShift = () => {
    if (filteredStaff.length === 0) {
      setNotification('No staff members match the current filter selection.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setDraftAssignments((prev) => {
      const next = { ...prev };
      filteredStaff.forEach((s) => {
        if (s.employeeId) next[s.employeeId] = bulkShiftTarget;
        if (s.id) next[s.id] = bulkShiftTarget;
      });
      return next;
    });

    setNotification(
      `Set draft shift for ${filteredStaff.length} staff member(s) to "${bulkShiftTarget}". Click "Save to Current Shift" to apply.`
    );
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteStaffFromRoster = (employeeId: string, name: string) => {
    const updated = staffList.filter((s) => s.id !== employeeId && s.employeeId !== employeeId);
    onUpdateStaffList(updated);
    setNotification(`Removed ${name} from roster.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleImportShiftSchedule = (pastedText: string) => {
    const lines = pastedText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) {
      setNotification('Please enter or paste at least one row of CSV data.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    let matchCount = 0;
    const startIdx =
      lines[0].toLowerCase().includes('employee') ||
      lines[0].toLowerCase().includes('name') ||
      lines[0].toLowerCase().includes('shift')
        ? 1
        : 0;

    const nextDraft = { ...draftAssignments };

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/[,;\t|]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        const identifier = parts[0];
        const shiftName = parts[1] || parts[parts.length - 1];

        const target = activeStaffList.find(
          (s) =>
            (s.employeeId && s.employeeId.toLowerCase() === identifier.toLowerCase()) ||
            (s.name && s.name.toLowerCase() === identifier.toLowerCase()) ||
            (s.id && s.id.toLowerCase() === identifier.toLowerCase())
        );

        if (target) {
          if (target.employeeId) nextDraft[target.employeeId] = shiftName;
          if (target.id) nextDraft[target.id] = shiftName;
          matchCount++;
        }
      }
    }

    if (matchCount > 0) {
      setDraftAssignments(nextDraft);
      setNotification(`Imported shift assignments for ${matchCount} staff into draft. Click "Save to Current Shift" to apply.`);
      setTimeout(() => setNotification(null), 4000);
      setShiftImportInput('');
      setIsImportShiftModalOpen(false);
    } else {
      setNotification('No matching staff members found for the provided Employee IDs or Names.');
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const handleExportShiftRoster = () => {
    const headers = ['Employee ID', 'Full Name', 'Department', 'Role', 'Assigned Shift', 'Status'];
    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = workingStaffList.map((s) => {
      const displayName = s.status === 'Suspended' && !s.name.includes('(suspended)')
        ? `${s.name} (suspended)`
        : s.name;
      return [
        escapeCsv(s.employeeId || ''),
        escapeCsv(displayName),
        escapeCsv(s.department || ''),
        escapeCsv(s.role || ''),
        escapeCsv(s.shiftSchedule || ''),
        escapeCsv(s.status || 'Active'),
      ];
    });

    const companyName = getActiveOrganizationName(settings);
    const csvContent = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${companyName.replace(/\s+/g, '_')}_Shift_Roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotification('Exported shift roster to CSV successfully.');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            Skima Workforce Shift Planner
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Shift Scheduling & Roster Management
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Organize Morning, Afternoon, and Night rotational shifts across departments. Scheduled shift times seamlessly link with Skima Attendance Analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportShiftModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-teal-600/30 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Import Shift Schedule
          </button>
          <button
            onClick={handleExportShiftRoster}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Shift Roster
          </button>
        </div>
      </div>

      {/* UNSAVED CHANGES ALERT BANNER & COUNTER */}
      {unsavedChangesCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/80 text-amber-950 dark:text-amber-100 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <span>Unsaved Shift Configuration</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-extrabold border border-amber-500/30">
                  {unsavedChangesCount} {unsavedChangesCount === 1 ? 'change' : 'changes'} pending
                </span>
              </div>
              <p className="text-sm font-bold text-amber-950 dark:text-amber-100 mt-0.5">
                There {unsavedChangesCount === 1 ? 'is 1 unsaved change' : `are ${unsavedChangesCount} unsaved changes`} made to this shift, please save.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveToCurrentTemplate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save to Current Shift ("{activeTemplate?.name || 'Active'}")</span>
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          {notification}
        </div>
      )}

      {/* SHIFT ROSTER TEMPLATE CONTROL BAR */}
      <div className="p-4 rounded-2xl bg-indigo-950/70 border border-indigo-800/80 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                Shift Scheme & Rotation Templates
              </h4>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                {savedTemplates.length} Scheme{savedTemplates.length > 1 ? 's' : ''} Available
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Active scheme: <span className="font-bold text-indigo-200">{activeTemplate?.name || 'Standard'}</span>. Switch between templates or duplicate to create alternate morning/night shift rotations.
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                <CalendarCheck className="w-3 h-3 text-emerald-400" />
                Worksheet Entity Locked for Today ({new Date().toISOString().split('T')[0]})
              </span>
              <span className="text-[10px] text-slate-300">
                Switching templates today overrides today's worksheet baseline while past days remain date-locked.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Template Selector */}
          <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-indigo-800/80">
            <span className="text-[11px] font-bold text-slate-400 pl-2">Template:</span>
            <select
              value={activeTemplateId}
              onChange={(e) => handleRequestSwitchTemplate(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-indigo-200 border border-indigo-700/80 outline-none cursor-pointer hover:bg-slate-750"
            >
              {savedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Actions: Duplicate & Rename */}
          <button
            type="button"
            title="Duplicate current template"
            onClick={handleDuplicateTemplate}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline font-semibold">Duplicate</span>
          </button>

          <button
            type="button"
            title="Rename current template"
            onClick={() => {
              setRenameTemplateInput(activeTemplate?.name || '');
              setIsRenameTemplateModalOpen(true);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline font-semibold">Rename</span>
          </button>

          {savedTemplates.length > 1 && (
            <button
              type="button"
              title="Delete active template"
              onClick={() => {
                const target = savedTemplates.find((t) => t.id === activeTemplateId);
                if (target) setTemplateToDelete(target);
              }}
              className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Save As... Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSaveAsDropdownOpen(!isSaveAsDropdownOpen)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Scheme</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isSaveAsDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSaveAsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={handleSaveToCurrentTemplate}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-900/60 text-slate-200 font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>Save Changes to "{activeTemplate?.name || 'Active'}"</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveAsDropdownOpen(false);
                      setIsNewTemplateModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-900/60 text-slate-200 font-semibold flex items-center gap-2.5 border-t border-slate-800 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-teal-400" />
                    <span>Save as New Template</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Shift Overview Distribution - Clickable Filter Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5" />
            Filter Roster by Shift (Click any card to filter view)
          </h4>
          {selectedShift !== 'All' && (
            <button
              onClick={() => setSelectedShift('All')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear Shift Filter (Showing {selectedShift})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* All Shifts Card */}
          <button
            type="button"
            onClick={() => setSelectedShift('All')}
            className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between border ${
              selectedShift === 'All'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-500/50'
                : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
            }`}
          >
            <div className="space-y-1">
              <div
                className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                  selectedShift === 'All' ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All Shifts
              </div>
              <div className="text-2xl font-bold font-mono">
                {workingStaffList.length}{' '}
                <span
                  className={`text-xs font-normal ${
                    selectedShift === 'All' ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  staff
                </span>
              </div>
              <p
                className={`text-[10px] font-mono ${
                  selectedShift === 'All' ? 'text-indigo-200/80' : 'text-slate-400'
                }`}
              >
                Full Active Roster
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                selectedShift === 'All'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              100%
            </div>
          </button>

          {/* Individual Configured Shift Cards */}
          {availableShifts.map((shift, idx) => {
            const count = workingStaffList.filter(
              (s) => getMatchedShift(s.shiftSchedule) === shift.name
            ).length;
            const percentage =
              workingStaffList.length > 0 ? Math.round((count / workingStaffList.length) * 100) : 0;
            const accentColor =
              shift.color || (idx === 0 ? '#f59e0b' : idx === 1 ? '#f97316' : '#6366f1');
            const isSelected = selectedShift.toLowerCase() === shift.name.toLowerCase();

            return (
              <button
                key={shift.id || shift.name}
                type="button"
                onClick={() => setSelectedShift(isSelected ? 'All' : shift.name)}
                className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between border relative overflow-hidden ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border-2 border-indigo-500 ring-2 ring-indigo-500/40 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                }`}
              >
                <div className="space-y-1">
                  <div
                    className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 font-bold"
                    style={{ color: isSelected ? undefined : accentColor }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className={isSelected ? 'text-indigo-700 dark:text-indigo-300 font-bold' : ''}>
                      {shift.name}
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                    {count} <span className="text-xs font-normal text-slate-400">staff</span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    {shift.startTime} – {shift.endTime}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
                  style={{
                    backgroundColor: `${accentColor}20`,
                    color: accentColor,
                  }}
                >
                  {percentage}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sync Toggle & Department/Shift Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Attendance Analysis Auto-Sync
            </h4>
            <p className="text-[11px] text-slate-500">
              When enabled, scheduled shift hours automatically serve as expected resumption parameters.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Searchbar for Shifts and Rosters */}
          <div className="relative min-w-[210px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff name, ID, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
            <span className="text-xs font-semibold text-slate-500">Shift:</span>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value="All">All Shifts</option>
              {availableShifts.map((s) => (
                <option key={s.id || s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
            <span className="text-xs font-semibold text-slate-500">Dept:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Update Filter-Aware Control */}
          <div className="flex items-center gap-2 border-l border-indigo-200 dark:border-indigo-800/80 pl-3 bg-indigo-50/50 dark:bg-indigo-950/30 py-1 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">set all to:</span>
            <select
              value={bulkShiftTarget}
              onChange={(e) => setBulkShiftTarget(e.target.value)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {availableShifts.map((s) => (
                <option key={s.id || s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApplyBulkShift}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
              title="Apply selected shift to all currently filtered staff members"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Staff Shift Roster Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Staff Shift Assignments ({filteredStaff.length} Active Employees)
            </h3>
            {selectedShift !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1">
                Shift: {selectedShift}
                <button
                  onClick={() => setSelectedShift('All')}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                  title="Clear shift filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800 text-[11px] font-bold flex items-center gap-1">
                Search: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                  title="Clear search query"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            Exited employees are hidden. Click shift selector to reassign schedule.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Staff Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Work Days</th>
                <th className="px-4 py-3">Current Shift</th>
                <th className="px-4 py-3">Expected Hours</th>
                <th className="px-4 py-3 text-right">Reassign Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredStaff.map((staff, idx) => (
                <tr key={`${staff.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {staff.employeeId}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                    {staff.name}
                  </td>
                  <td className="px-4 py-3">{staff.department}</td>
                  <td className="px-4 py-3 text-slate-500">{staff.role}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    Mon – Fri
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const matchedName = getMatchedShift(staff.shiftSchedule);
                      const currentS = availableShifts.find((s) => s.name === matchedName);
                      const draftShift = getStaffDraftShift(staff);
                      const savedShift = getStaffSavedShift(staff);
                      const isUnsaved = draftShift !== savedShift;

                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5"
                            style={{
                              backgroundColor: currentS?.color ? `${currentS.color}20` : '#6366f120',
                              color: currentS?.color || '#6366f1',
                            }}
                          >
                            <Clock className="w-3 h-3" />
                            {matchedName}
                          </span>
                          {isUnsaved && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                              unsaved
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {(() => {
                      const matchedName = getMatchedShift(staff.shiftSchedule);
                      const currentS = availableShifts.find((s) => s.name === matchedName);
                      if (matchedName === 'N/A') return 'No Shift / N/A';
                      return currentS && currentS.startTime !== 'N/A'
                        ? `${currentS.startTime} – ${currentS.endTime}`
                        : 'Custom Schedule';
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const matchedName = getMatchedShift(staff.shiftSchedule);
                      const isKnown = availableShifts.some(s => s.name === matchedName);
                      const optionsList = isKnown 
                        ? availableShifts 
                        : [...availableShifts, { id: 'custom', name: matchedName, startTime: 'Custom', endTime: 'Custom' }];
                      return (
                        <select
                          value={matchedName}
                          onChange={(e) => handleShiftChange(staff.id, e.target.value)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                        >
                          {optionsList.map((s) => (
                            <option key={s.id || s.name} value={s.name}>
                              {s.name} {s.startTime !== 'N/A' && s.startTime !== 'Custom' ? `(${s.startTime} - ${s.endTime})` : ''}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Template Save Modal */}
      {isNewTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Save Roster as New Shift Template
              </h3>
              <button onClick={() => setIsNewTemplateModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Template Name
              </label>
              <input
                type="text"
                value={newTemplateNameInput}
                onChange={(e) => setNewTemplateNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveAsNewTemplate(newTemplateNameInput);
                  }
                }}
                placeholder={`template ${savedTemplates.length + 1}`}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Default name will be "template {savedTemplates.length + 1}".
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewTemplateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveAsNewTemplate(newTemplateNameInput)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow cursor-pointer"
              >
                Save Shift Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Template Modal */}
      {isRenameTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-500" />
                Rename Shift Template
              </h3>
              <button onClick={() => setIsRenameTemplateModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                New Template Name
              </label>
              <input
                type="text"
                value={renameTemplateInput}
                onChange={(e) => setRenameTemplateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameTemplate(renameTemplateInput);
                  }
                }}
                placeholder="Enter template name..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none focus:border-sky-500"
              />
              {unsavedChangesCount > 0 && (
                <p className="text-[11px] text-amber-500 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Note: You have {unsavedChangesCount} unsaved shift changes pending in this template.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsRenameTemplateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRenameTemplate(renameTemplateInput)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow cursor-pointer"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Switch Template Modal */}
      {isUnsavedSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Unsaved Shift Changes
                </h3>
                <p className="text-xs text-slate-500">
                  {unsavedChangesCount} unsaved change{unsavedChangesCount === 1 ? '' : 's'} in "{activeTemplate?.name}"
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You have <span className="font-bold text-amber-600 dark:text-amber-400">{unsavedChangesCount} unsaved change{unsavedChangesCount === 1 ? '' : 's'}</span> made to this shift. If you switch templates without saving first, your pending changes will be discarded.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsUnsavedSwitchModalOpen(false);
                  setPendingSwitchTemplateId(null);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingSwitchTemplateId) {
                    doApplyTemplate(pendingSwitchTemplateId);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Discard & Switch
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingSwitchTemplateId) {
                    handleSaveToCurrentTemplate();
                    doApplyTemplate(pendingSwitchTemplateId);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                Save & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Shift Schedule Modal */}
      {isImportShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-500" />
                Import Shift Schedule Assignments
              </h3>
              <button
                onClick={() => setIsImportShiftModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Batch update shift assignments for employees. Upload or paste CSV/Excel rows mapping Employee ID or Name to a Shift Name:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              Employee ID (or Name), Shift Name
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Paste CSV or Excel Rows
              </label>
              <textarea
                rows={6}
                value={shiftImportInput}
                onChange={(e) => setShiftImportInput(e.target.value)}
                placeholder={`SKM-101, Night\nSKM-102, Morning\nJane Doe, Afternoon`}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 border border-slate-300 dark:border-slate-700">
                <Upload className="w-3.5 h-3.5 text-teal-500" />
                <span>Choose CSV / File</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const content = evt.target?.result as string;
                        if (content) setShiftImportInput(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportShiftModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleImportShiftSchedule(shiftImportInput)}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/30 cursor-pointer"
                >
                  Apply Shift Imports
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Template Modal */}
      <ConfirmDeleteModal
        isOpen={!!templateToDelete}
        title="Delete Shift Scheme Template"
        itemName={templateToDelete?.name}
        message="Are you sure you want to delete this shift roster template scheme?"
        subMessage="This rotation template will be deleted and the active roster will switch to the next available shift scheme."
        confirmButtonText="Yes, Delete Scheme"
        onConfirm={() => {
          if (templateToDelete) {
            handleDeleteTemplate(templateToDelete.id);
            setTemplateToDelete(null);
          }
        }}
        onClose={() => setTemplateToDelete(null)}
        isLight={isLight}
      />
    </div>
  );
};
