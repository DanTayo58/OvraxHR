import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
  UserCheck,
  Building2,
  Sparkles,
  Paperclip,
  Upload,
  Eye,
  Trash2,
  X,
  FileCheck,
  FileSpreadsheet,
  Download,
  Printer,
  Edit2,
  Check,
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  Settings as SettingsIcon,
  Database,
} from 'lucide-react';
import { StaffMember, LeaveRequest, AppSettings } from '../types';
import { SearchableStaffSelect } from './SearchableStaffSelect';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AdvancedRecurringOffsModal } from './AdvancedRecurringOffsModal';
import { getActiveOrganizationName } from '../utils/documentTemplates';
import {
  isLeaveEnded,
  isLeaveOngoing,
  isLeaveCurrentlyActive,
  isLeavePending,
  isLeaveUpcoming,
  getComputedLeaveStatus,
  reconcileStaffAndLeaves,
  getTodayDateString,
} from '../utils/leaveUtils';
import { emitGlobalToast } from '../context/ToastContext';

interface LeavesManagementViewProps {
  staffList: StaffMember[];
  leaves: LeaveRequest[];
  onUpdateLeaves: (updatedLeaves: LeaveRequest[]) => void;
  onUpdateStaffList: (updatedStaff: StaffMember[]) => void;
  isLight?: boolean;
  settings?: AppSettings;
}

type LeaveSortField =
  | 'employeeName'
  | 'employeeId'
  | 'department'
  | 'leaveType'
  | 'startDate'
  | 'endDate'
  | 'daysCount';

interface LeaveSortRule {
  id: string;
  field: LeaveSortField;
  direction: 'asc' | 'desc';
}

const LEAVE_FIELD_LABELS: Record<LeaveSortField, string> = {
  employeeName: 'Staff Member Name',
  employeeId: 'Employee ID',
  department: 'Department',
  leaveType: 'Leave Category',
  startDate: 'Start Date',
  endDate: 'End Date',
  daysCount: 'Duration (Days)',
};

export const LeavesManagementView: React.FC<LeavesManagementViewProps> = ({
  staffList,
  leaves,
  onUpdateLeaves,
  onUpdateStaffList,
  isLight = false,
  settings,
}) => {
  const [isAddLeaveModalOpen, setIsAddLeaveModalOpen] = useState(false);
  const [isRecurringOffsModalOpen, setIsRecurringOffsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('All');
  const [lifecycleTab, setLifecycleTab] = useState<'all' | 'ongoing' | 'pending' | 'ended' | 'active'>('all');
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [sortRules, setSortRules] = useState<LeaveSortRule[]>([]);
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
  const [selectedDocPreview, setSelectedDocPreview] = useState<{
    title: string;
    employeeName: string;
    attachmentName: string;
    attachmentUrl?: string;
    reason?: string;
  } | null>(null);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
  const [editingLeaveReasonId, setEditingLeaveReasonId] = useState<string | null>(null);
  const [editingReasonText, setEditingReasonText] = useState<string>('');

  const todayStr = getTodayDateString();

  // Form State for new leave
  const [newLeave, setNewLeave] = useState<Partial<LeaveRequest>>({
    employeeId: staffList[0]?.employeeId || '',
    leaveType: 'Annual',
    startDate: todayStr,
    endDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    reason: '',
    attachmentName: '',
    attachmentUrl: '',
    leaveStatus: 'Ongoing',
  });

  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileDataUrl, setUploadedFileDataUrl] = useState<string>('');

  const departments = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department?.trim()) set.add(s.department.trim());
    });
    if (set.size === 0) {
      return ['General Operations', 'Security', 'Management', 'Field Staff', 'Administration'];
    }
    return Array.from(set).sort();
  }, [staffList]);

  // Auto-reconcile leave statuses and staff status on load or when day shifts
  useEffect(() => {
    const { updatedStaff, updatedLeaves, hasStaffChanged, hasLeavesChanged } = reconcileStaffAndLeaves(
      staffList,
      leaves,
      todayStr
    );
    if (hasStaffChanged) onUpdateStaffList(updatedStaff);
    if (hasLeavesChanged) onUpdateLeaves(updatedLeaves);
  }, []);

  const ongoingLeavesList = leaves.filter((l) => isLeaveOngoing(l, todayStr));
  const pendingLeavesList = leaves.filter((l) => isLeavePending(l, todayStr));
  const endedLeavesList = leaves.filter((l) => isLeaveEnded(l, todayStr));
  const activeLeavesList = ongoingLeavesList; // backwards compatibility

  const filteredLeaves = leaves.filter((l) => {
    // 1. Lifecycle tab filter
    if ((lifecycleTab === 'ongoing' || lifecycleTab === 'active') && !isLeaveOngoing(l, todayStr)) return false;
    if (lifecycleTab === 'pending' && !isLeavePending(l, todayStr)) return false;
    if (lifecycleTab === 'ended' && !isLeaveEnded(l, todayStr)) return false;

    // 2. Category / Timeframe filter
    if (filterType === 'THIS_WEEK') {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = (day + 6) % 7;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMon);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
      const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

      const lStart = (l.startDate || '').split('T')[0];
      const lEnd = (l.endDate || l.startDate || '').split('T')[0];
      if (lEnd < startOfWeekStr || lStart > endOfWeekStr) return false;
    } else if (filterType === 'THIS_MONTH') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
      const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

      const lStart = (l.startDate || '').split('T')[0];
      const lEnd = (l.endDate || l.startDate || '').split('T')[0];
      if (lEnd < startOfMonthStr || lStart > endOfMonthStr) return false;
    } else if (filterType !== 'All' && l.leaveType !== filterType) {
      return false;
    }

    return true;
  });

  const sortedLeaves = [...filteredLeaves].sort((a, b) => {
    for (const rule of sortRules) {
      const dirMult = rule.direction === 'asc' ? 1 : -1;
      let res = 0;

      if (rule.field === 'employeeName') {
        res = (a.employeeName || '').trim().localeCompare((b.employeeName || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'employeeId') {
        res = (a.employeeId || '').trim().localeCompare((b.employeeId || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
      } else if (rule.field === 'department') {
        res = (a.department || '').trim().localeCompare((b.department || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'leaveType') {
        res = (a.leaveType || '').trim().localeCompare((b.leaveType || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'startDate') {
        res = (a.startDate || '').localeCompare(b.startDate || '');
      } else if (rule.field === 'endDate') {
        res = (a.endDate || '').localeCompare(b.endDate || '');
      } else if (rule.field === 'daysCount') {
        res = (a.daysCount || 0) - (b.daysCount || 0);
      }

      if (res !== 0) {
        return res * dirMult;
      }
    }
    return 0;
  });

  const handleAddSortRule = () => {
    if (sortRules.length >= 2) return;
    const availableFields: LeaveSortField[] = [
      'employeeName',
      'employeeId',
      'department',
      'leaveType',
      'startDate',
      'endDate',
      'daysCount',
    ];
    const unused = availableFields.find((f) => !sortRules.some((r) => r.field === f)) || 'employeeName';
    setSortRules((prev) => [
      ...prev,
      { id: `sort-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, field: unused, direction: 'asc' },
    ]);
  };

  const handleUpdateSortRule = (index: number, updates: Partial<LeaveSortRule>) => {
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

  const leavesWithDocCount = leaves.filter((l) => !!l.attachmentName).length;

  const handleManualReconcile = () => {
    const { updatedStaff, updatedLeaves, hasStaffChanged, hasLeavesChanged } = reconcileStaffAndLeaves(
      staffList,
      leaves,
      todayStr
    );
    if (hasStaffChanged) onUpdateStaffList(updatedStaff);
    if (hasLeavesChanged) onUpdateLeaves(updatedLeaves);

    const onLeaveCount = updatedStaff.filter((s) => s.status === 'On Leave').length;
    const syncMsg = `Roster synchronized: ${onLeaveCount} staff member(s) currently marked as On Leave.`;
    setStatusNotification(syncMsg);
    emitGlobalToast(syncMsg, 'info');
    setTimeout(() => setStatusNotification(null), 4500);
  };

  const handleSaveReasonNote = (leaveId: string) => {
    const updatedLeaves = leaves.map((l) =>
      l.id === leaveId ? { ...l, reason: editingReasonText.trim() || 'Standard Leave Log' } : l
    );
    onUpdateLeaves(updatedLeaves);
    setEditingLeaveReasonId(null);
    setEditingReasonText('');
    setStatusNotification('Leave reason notes successfully updated.');
    emitGlobalToast('Leave reason notes successfully updated', 'success');
    setTimeout(() => setStatusNotification(null), 3000);
  };

  const handleToggleLeaveStatus = (leaveId: string) => {
    const target = leaves.find((l) => l.id === leaveId);
    if (!target) return;

    const currentlyEnded = isLeaveEnded(target, todayStr);
    const newStatus: 'Ongoing' | 'Pending' | 'Ended' | 'Restored' = currentlyEnded
      ? getComputedLeaveStatus(target.startDate, target.endDate, todayStr)
      : 'Restored';

    const updatedLeaves = leaves.map((l) =>
      l.id === leaveId ? { ...l, leaveStatus: newStatus } : l
    );
    onUpdateLeaves(updatedLeaves);

    // Reconcile staff list according to updated leaves
    const { updatedStaff } = reconcileStaffAndLeaves(staffList, updatedLeaves, todayStr);
    onUpdateStaffList(updatedStaff);

    if (newStatus === 'Restored') {
      const msg = `Leave for ${target.employeeName} restored early to Active status.`;
      setStatusNotification(msg);
      emitGlobalToast(msg, 'success');
    } else if (newStatus === 'Ended') {
      const msg = `Leave for ${target.employeeName} marked as "Ended". Staff status returned to Active.`;
      setStatusNotification(msg);
      emitGlobalToast(msg, 'info');
    } else if (newStatus === 'Ongoing') {
      const msg = `Leave for ${target.employeeName} marked as "Ongoing". Staff status updated to "On Leave".`;
      setStatusNotification(msg);
      emitGlobalToast(msg, 'success');
    } else {
      const msg = `Leave for ${target.employeeName} marked as "Pending" (starts ${target.startDate}). Staff status remains Active.`;
      setStatusNotification(msg);
      emitGlobalToast(msg, 'info');
    }

    setTimeout(() => setStatusNotification(null), 4000);
  };

  const handleStartDateChange = (val: string) => {
    let nextEndDate = newLeave.endDate;
    if (nextEndDate && nextEndDate < val) {
      nextEndDate = val;
    }
    const autoStatus = getComputedLeaveStatus(val, nextEndDate, todayStr);
    setNewLeave((prev) => ({
      ...prev,
      startDate: val,
      endDate: nextEndDate,
      leaveStatus: autoStatus,
    }));
  };

  const handleEndDateChange = (val: string) => {
    let nextStartDate = newLeave.startDate;
    if (nextStartDate && nextStartDate > val) {
      nextStartDate = val;
    }
    const autoStatus = getComputedLeaveStatus(nextStartDate, val, todayStr);
    setNewLeave((prev) => ({
      ...prev,
      startDate: nextStartDate,
      endDate: val,
      leaveStatus: autoStatus,
    }));
  };

  const handleStatusDropdownChange = (status: 'Ongoing' | 'Pending' | 'Ended') => {
    if (status === 'Pending') {
      // Pending requires startDate > todayStr
      const currentStart = newLeave.startDate || todayStr;
      let newStart = currentStart;
      if (newStart <= todayStr) {
        newStart = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      }
      let newEnd = newLeave.endDate || newStart;
      if (newEnd < newStart) {
        newEnd = new Date(new Date(newStart).getTime() + 5 * 86400000).toISOString().split('T')[0];
      }
      setNewLeave((prev) => ({
        ...prev,
        startDate: newStart,
        endDate: newEnd,
        leaveStatus: 'Pending',
      }));
    } else if (status === 'Ongoing') {
      // Ongoing requires startDate <= todayStr and endDate >= todayStr
      let newStart = newLeave.startDate || todayStr;
      if (newStart > todayStr) {
        newStart = todayStr;
      }
      let newEnd = newLeave.endDate || todayStr;
      if (newEnd < todayStr) {
        newEnd = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      }
      setNewLeave((prev) => ({
        ...prev,
        startDate: newStart,
        endDate: newEnd,
        leaveStatus: 'Ongoing',
      }));
    } else if (status === 'Ended') {
      // Ended requires endDate < todayStr
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let newEnd = newLeave.endDate || yesterday;
      if (newEnd >= todayStr) {
        newEnd = yesterday;
      }
      let newStart = newLeave.startDate || newEnd;
      if (newStart > newEnd) {
        newStart = new Date(new Date(newEnd).getTime() - 4 * 86400000).toISOString().split('T')[0];
      }
      setNewLeave((prev) => ({
        ...prev,
        startDate: newStart,
        endDate: newEnd,
        leaveStatus: 'Ended',
      }));
    }
  };

  const handleOpenAddLeaveModal = () => {
    const defaultStart = todayStr;
    const defaultEnd = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    const initialStatus = getComputedLeaveStatus(defaultStart, defaultEnd, todayStr);
    setNewLeave({
      employeeId: staffList.find((s) => s.status !== 'Exited')?.employeeId || staffList[0]?.employeeId || '',
      leaveType: 'Annual',
      startDate: defaultStart,
      endDate: defaultEnd,
      reason: '',
      attachmentName: '',
      attachmentUrl: '',
      leaveStatus: initialStatus,
    });
    setUploadedFileName('');
    setUploadedFileDataUrl('');
    setIsAddLeaveModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFileDataUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find((s) => s.employeeId === newLeave.employeeId);
    if (!staff) return;

    const start = new Date(newLeave.startDate || Date.now());
    const end = new Date(newLeave.endDate || Date.now());
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));

    // Date-sensitive status computation strictly adhering to the set date range
    const computedStatus = getComputedLeaveStatus(newLeave.startDate, newLeave.endDate, todayStr);
    const finalLeaveStatus = computedStatus;

    const leaveObj: LeaveRequest = {
      id: `LV-${Math.floor(1000 + Math.random() * 9000)}`,
      employeeId: staff.employeeId,
      employeeName: staff.name,
      department: staff.department,
      leaveType: (newLeave.leaveType as any) || 'Annual',
      startDate: newLeave.startDate || '',
      endDate: newLeave.endDate || '',
      daysCount: days,
      status: 'Approved',
      leaveStatus: finalLeaveStatus,
      reason: newLeave.reason || 'Registered Leave Record',
      attachmentName: uploadedFileName || newLeave.attachmentName || undefined,
      attachmentUrl: uploadedFileDataUrl || newLeave.attachmentUrl || undefined,
    };

    const updatedLeaves = [leaveObj, ...leaves];
    onUpdateLeaves(updatedLeaves);

    // Automatically reconcile staff status
    const { updatedStaff } = reconcileStaffAndLeaves(staffList, updatedLeaves, todayStr);
    onUpdateStaffList(updatedStaff);

    const logMsg = finalLeaveStatus === 'Ended'
      ? `Leave for ${staff.name} logged as a completed past leave (Ended). Staff status remains Active.`
      : finalLeaveStatus === 'Ongoing'
      ? `Leave for ${staff.name} logged as Ongoing. Staff status updated to "On Leave".`
      : `Leave for ${staff.name} scheduled as Pending (${leaveObj.startDate} to ${leaveObj.endDate}). Will automatically transition to Ongoing when the date arrives.`;
    setStatusNotification(logMsg);
    emitGlobalToast(logMsg, 'success');
    setTimeout(() => setStatusNotification(null), 4500);

    // Reset Form
    setUploadedFileName('');
    setUploadedFileDataUrl('');
    setIsAddLeaveModalOpen(false);
  };

  const handleDeleteLeave = (id: string) => {
    const target = leaves.find((l) => l.id === id);
    const updated = leaves.filter((l) => l.id !== id);
    onUpdateLeaves(updated);

    const { updatedStaff } = reconcileStaffAndLeaves(staffList, updated, todayStr);
    onUpdateStaffList(updatedStaff);

    if (target) {
      const delMsg = `Leave record for ${target.employeeName} deleted. Staff roster synchronized.`;
      setStatusNotification(delMsg);
      emitGlobalToast(delMsg, 'warning');
      setTimeout(() => setStatusNotification(null), 3000);
    }
  };

  const handlePrintDocument = (doc: {
    employeeName: string;
    attachmentName?: string;
    attachmentUrl?: string;
    reason?: string;
    title?: string;
  }) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Leave Proof Document - ${doc.employeeName}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #1e293b; background: #fff; }
            .header { border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 18px; color: #0f766e; }
            .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
            .badge { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
            .field { font-size: 12px; }
            .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
            .val { font-weight: 600; color: #0f172a; }
            .doc-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; text-align: center; margin-top: 15px; }
            .doc-img { max-width: 100%; max-height: 480px; border-radius: 6px; object-fit: contain; }
            .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>OFFICIAL LEAVE PROOF DOCUMENT RECORD</h1>
              <p>Skima Workforce Management System • Logged Proof Verification</p>
            </div>
            <span class="badge">DOCUMENTED RECORD</span>
          </div>
          <div class="grid">
            <div class="field"><div class="label">Employee Name</div><div class="val">${doc.employeeName}</div></div>
            <div class="field"><div class="label">Record Category</div><div class="val">${doc.title || 'Leave Documentation'}</div></div>
            <div class="field"><div class="label">Document File Name</div><div class="val">${doc.attachmentName || 'Proof File'}</div></div>
            <div class="field"><div class="label">Verification Date</div><div class="val">${new Date().toLocaleDateString()}</div></div>
          </div>
          ${doc.reason ? `<div style="margin-bottom:15px;"><div class="label">Reason / Notes</div><div class="val" style="background:#f1f5f9;padding:10px;border-radius:6px;font-size:12px;">${doc.reason}</div></div>` : ''}
          <div class="doc-box">
            <div class="label" style="margin-bottom:10px;">Attached Proof Visual Document</div>
            ${doc.attachmentUrl && doc.attachmentUrl.startsWith('data:image') 
              ? `<img src="${doc.attachmentUrl}" class="doc-img" alt="Proof Document" />` 
              : `<div style="padding:40px;background:#f8fafc;border-radius:6px;font-weight:600;color:#334155;">📄 Document Attached: ${doc.attachmentName || 'Official File Document'}</div>`
            }
          </div>
          <div class="footer">
            <div>Generated & Printed: ${new Date().toLocaleString()}</div>
            <div>Official HR Verification Log Stamp</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportLeavesCSV = () => {
    const headers = [
      'Leave ID',
      'Employee ID',
      'Employee Name',
      'Department',
      'Leave Type',
      'Start Date',
      'End Date',
      'Duration (Days)',
      'Status',
      'Reason',
      'Document Attached',
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = leaves.map((l) => [
      escapeCsv(l.id),
      escapeCsv(l.employeeId),
      escapeCsv(l.employeeName),
      escapeCsv(l.department),
      escapeCsv(l.leaveType),
      escapeCsv(l.startDate),
      escapeCsv(l.endDate),
      escapeCsv(l.daysCount),
      escapeCsv(l.status),
      escapeCsv(l.reason),
      escapeCsv(l.attachmentName ? `Yes (${l.attachmentName})` : 'None'),
    ]);

    const companyName = getActiveOrganizationName(settings);
    const csvContent = '\ufeff' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${companyName.replace(/\s+/g, '_')}_Leave_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    emitGlobalToast(`Exported ${leaves.length} leave records to CSV`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shadow-xl border border-teal-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-teal-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            Skima Staff Leave Documentation
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Staff Leave Records & Proof Files
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Log employee leave periods and upload supporting proof files (Doctor Notes, Medical Forms, Application Documents). Logged leaves automatically synchronize with Skima Attendance Analysis.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportLeavesCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-800/60 text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-md"
            title="Export leave records to CSV spreadsheet"
          >
            <Download className="w-4 h-4 text-teal-400" />
            Export Records
          </button>
          <button
            onClick={() => setIsRecurringOffsModalOpen(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-800/60 transition cursor-pointer shadow-md flex items-center justify-center"
            title="Advanced Leave / Special Recurring Off Settings"
            aria-label="Advanced Leave / Special Recurring Off Settings"
          >
            <SettingsIcon className="w-4 h-4 text-teal-400" />
          </button>
          <button
            onClick={handleOpenAddLeaveModal}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-teal-600/30 transition shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Log Leave
          </button>
        </div>
      </div>

      {/* Status Notification Toast */}
      {statusNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button
            onClick={() => setStatusNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {staffList.filter((s) => s.status === 'On Leave').length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Staff On Leave</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {ongoingLeavesList.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Ongoing Leaves</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {pendingLeavesList.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Pending Leaves</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">
              {endedLeavesList.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Ended Leaves</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {leavesWithDocCount}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">With Proof Docs</div>
          </div>
        </div>
      </div>

      {/* Leave Records Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Tabs for All, Ongoing, Pending, Ended Leaves */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setLifecycleTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  lifecycleTab === 'all'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>All Leaves</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                  {leaves.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLifecycleTab('ongoing')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  lifecycleTab === 'ongoing' || lifecycleTab === 'active'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Ongoing Leaves</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono">
                  {ongoingLeavesList.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLifecycleTab('pending')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  lifecycleTab === 'pending'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Pending Leaves</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-mono">
                  {pendingLeavesList.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLifecycleTab('ended')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  lifecycleTab === 'ended'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Ended Leaves</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                  {endedLeavesList.length}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Leave Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="All">All Categories</option>
                <option value="THIS_WEEK">📅 This Week</option>
                <option value="THIS_MONTH">🗓️ This Month</option>
                <option value="Annual">Annual Paid Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Maternity">Maternity / Paternity</option>
                <option value="Casual">Casual Leave</option>
                <option value="Unpaid Off">Unpaid Off</option>
              </select>
            </div>

            {/* Sort Dropdown Controls */}
            <div className="relative border-l border-slate-200 dark:border-slate-800 pl-3" ref={sortContainerRef}>
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  sortRules.length > 0
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
                title="Sort Leave Records"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Sort</span>
                {sortRules.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-mono shrink-0">
                    {sortRules.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-teal-500" />
                      <span>Leave Sorting Rules</span>
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
                                  field: e.target.value as LeaveSortField,
                                })
                              }
                              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                            >
                              <option value="employeeName">Staff Member Name</option>
                              <option value="employeeId">Employee ID</option>
                              <option value="department">Department</option>
                              <option value="leaveType">Leave Category</option>
                              <option value="startDate">Start Date</option>
                              <option value="endDate">End Date</option>
                              <option value="daysCount">Duration (Days)</option>
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

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                    {sortRules.length < 2 && (
                      <button
                        type="button"
                        onClick={handleAddSortRule}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center gap-1 border border-teal-200 dark:border-teal-800 cursor-pointer"
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Employee ID</th>
                <th className="px-4 py-3 whitespace-nowrap">Staff Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Department</th>
                <th className="px-4 py-3 whitespace-nowrap">Leave Category</th>
                <th className="px-4 py-3 whitespace-nowrap">Leave Period</th>
                <th className="px-4 py-3 whitespace-nowrap">Duration</th>
                <th className="px-4 py-3 whitespace-nowrap">Leave Status & Reason Notes</th>
                <th className="px-4 py-3 whitespace-nowrap">Supporting Document</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {sortedLeaves.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FileText className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {lifecycleTab === 'ended'
                          ? 'No ended leaves found'
                          : lifecycleTab === 'pending'
                          ? 'No pending leaves scheduled'
                          : lifecycleTab === 'ongoing' || lifecycleTab === 'active'
                          ? 'No ongoing leaves currently'
                          : 'No leave records logged'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {lifecycleTab === 'ended'
                          ? 'Completed leaves will appear here once ended.'
                          : lifecycleTab === 'pending'
                          ? 'Future leaves scheduled ahead of time will appear here.'
                          : 'Click "Log Leave" to register employee leaves.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedLeaves.map((leave) => {
                  const ended = isLeaveEnded(leave, todayStr);
                  const isOngoing = isLeaveOngoing(leave, todayStr);
                  const isPending = isLeavePending(leave, todayStr);

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                        {leave.employeeId}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {leave.employeeName}
                      </td>
                      <td className="px-4 py-3">{leave.department}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-semibold text-[11px]">
                          {leave.leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {leave.startDate} to {leave.endDate}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {leave.daysCount} Days
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 max-w-xs">
                          {/* Toggleable Status Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleLeaveStatus(leave.id)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer border ${
                                leave.leaveStatus === 'Restored'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 hover:bg-blue-100'
                                  : ended
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                                  : isOngoing
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 hover:bg-amber-100'
                              }`}
                              title={ended ? 'Click to reactivate this leave based on date schedule' : 'Click to restore staff member to Active'}
                            >
                              {leave.leaveStatus === 'Restored' ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                  <span>Restored</span>
                                </>
                              ) : ended ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                  <span>Ended</span>
                                </>
                              ) : isOngoing ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span>Ongoing</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  <span>Pending</span>
                                </>
                              )}
                            </button>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {leave.leaveStatus === 'Restored' ? '(Restored Early)' : ended ? '(Past / Completed)' : isOngoing ? '(Active Today)' : `(Starts ${leave.startDate})`}
                            </span>
                          </div>

                          {/* Reason Notes Display & In-line Editor */}
                          {editingLeaveReasonId === leave.id ? (
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                autoFocus
                                value={editingReasonText}
                                onChange={(e) => setEditingReasonText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveReasonNote(leave.id);
                                  if (e.key === 'Escape') setEditingLeaveReasonId(null);
                                }}
                                placeholder="Enter reason notes..."
                                className="px-2 py-1 text-[11px] rounded-lg bg-white dark:bg-slate-800 border border-teal-500 text-slate-900 dark:text-white w-full outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveReasonNote(leave.id)}
                                className="p-1 rounded-lg bg-teal-600 text-white hover:bg-teal-500 cursor-pointer shrink-0"
                                title="Save reason notes"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingLeaveReasonId(null)}
                                className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer shrink-0"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-1 group/reason">
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium line-clamp-2">
                                {leave.reason || 'Standard Leave Log'}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLeaveReasonId(leave.id);
                                  setEditingReasonText(leave.reason || '');
                                }}
                                className="opacity-0 group-hover/reason:opacity-100 p-0.5 rounded text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer transition shrink-0"
                                title="Edit reason notes"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {leave.attachmentName ? (
                          <button
                            onClick={() =>
                              setSelectedDocPreview({
                                title: `${leave.leaveType} Leave Proof - ${leave.employeeName}`,
                                employeeName: leave.employeeName,
                                attachmentName: leave.attachmentName || 'Proof Document',
                                attachmentUrl: leave.attachmentUrl,
                                reason: leave.reason,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                            <span className="max-w-[120px] truncate">{leave.attachmentName}</span>
                            <Eye className="w-3 h-3 text-blue-400 ml-1" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No document</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setLeaveToDelete(leave)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Delete Leave Record"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Document Preview Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-500" />
                Attached Proof Document
              </h3>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block">Employee:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedDocPreview.employeeName}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Document File Name:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  {selectedDocPreview.attachmentName}
                </span>
              </div>

              {selectedDocPreview.reason && (
                <div>
                  <span className="text-slate-400 font-semibold block">Reason / Notes:</span>
                  <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    {selectedDocPreview.reason}
                  </p>
                </div>
              )}

              {selectedDocPreview.attachmentUrl ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center space-y-2">
                  {selectedDocPreview.attachmentUrl.startsWith('data:image') ? (
                    <img
                      src={selectedDocPreview.attachmentUrl}
                      alt="Proof Attachment"
                      className="max-h-48 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <FileText className="w-10 h-10 text-blue-500 mx-auto" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-2">
                        {selectedDocPreview.attachmentName}
                      </span>
                    </div>
                  )}
                  <a
                    href={selectedDocPreview.attachmentUrl}
                    download={selectedDocPreview.attachmentName}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download File
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                  <FileText className="w-8 h-8 text-blue-500 mx-auto opacity-70" />
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    File Reference Registered
                  </p>
                  <p className="text-[11px] text-slate-400">
                    This leave record was logged with documented proof: "{selectedDocPreview.attachmentName}".
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handlePrintDocument(selectedDocPreview)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-teal-600/30 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document & Record</span>
              </button>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Leave Modal */}
      {isAddLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-500" />
                Log Leave
              </h3>
              <button
                onClick={() => setIsAddLeaveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="space-y-4 text-xs">
              <div>
                <SearchableStaffSelect
                  label="Select Employee *"
                  staffList={staffList}
                  selectedEmployeeId={newLeave.employeeId || ''}
                  onSelect={(empId) => setNewLeave({ ...newLeave, employeeId: empId })}
                  placeholder="Search staff by name, ID, or department..."
                  filterExited={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Leave Category *
                  </label>
                  <select
                    value={newLeave.leaveType}
                    onChange={(e) => setNewLeave({ ...newLeave, leaveType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="Annual">Annual Paid Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Maternity">Maternity / Paternity</option>
                    <option value="Casual">Casual Leave</option>
                    <option value="Unpaid Off">Unpaid Off</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Leave Status</span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                      Auto-computed by dates
                    </span>
                  </label>
                  <div
                    className={`w-full px-3.5 py-2 rounded-xl border flex items-center justify-between transition-colors min-h-[38px] ${
                      newLeave.leaveStatus === 'Pending'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                        : newLeave.leaveStatus === 'Ended'
                        ? 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          newLeave.leaveStatus === 'Pending'
                            ? 'bg-amber-500 animate-pulse'
                            : newLeave.leaveStatus === 'Ended'
                            ? 'bg-slate-400'
                            : 'bg-emerald-500 animate-pulse'
                        }`}
                      />
                      <span className="font-bold text-xs">
                        {newLeave.leaveStatus === 'Pending' && 'Pending (Ahead)'}
                        {newLeave.leaveStatus === 'Ended' && 'Ended (Past)'}
                        {(!newLeave.leaveStatus || newLeave.leaveStatus === 'Ongoing') && 'Ongoing (Active)'}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono uppercase tracking-wider font-semibold opacity-75">
                      Auto
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newLeave.endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Reason / Description
                </label>
                <textarea
                  rows={2}
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                  placeholder="E.g. Approved medical recovery, family event, or signed leave form..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Attach Document Proof Field */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-teal-500" />
                    Attach Supporting Document / Proof File
                  </span>
                  <span className="text-[10px] text-slate-400">(Optional - Doctor's note, image, PDF)</span>
                </label>

                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5 shadow transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {uploadedFileName ? (
                    <div className="flex items-center gap-2 text-xs font-mono text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2.5 py-1.5 rounded-lg border border-teal-500/20 max-w-[220px] truncate">
                      <FileCheck className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{uploadedFileName}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No file selected</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddLeaveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow"
                >
                  Log & Register Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advanced Recurring Off Settings Modal */}
      <AdvancedRecurringOffsModal
        isOpen={isRecurringOffsModalOpen}
        onClose={() => setIsRecurringOffsModalOpen(false)}
        staffList={staffList}
        departments={departments}
        companyName={settings?.companyName}
        isLight={isLight}
      />

      {/* Confirm Delete Leave Modal */}
      <ConfirmDeleteModal
        isOpen={!!leaveToDelete}
        title="Delete Leave Record"
        itemName={leaveToDelete ? `${leaveToDelete.leaveType} Leave - ${leaveToDelete.employeeName} (${leaveToDelete.startDate} to ${leaveToDelete.endDate})` : ''}
        message="Are you sure you want to delete this staff leave record?"
        subMessage="This will remove the logged leave dates and make the employee available on active roster and feeding schedules."
        confirmButtonText="Yes, Delete Leave Record"
        onConfirm={() => {
          if (leaveToDelete) {
            handleDeleteLeave(leaveToDelete.id);
            setLeaveToDelete(null);
          }
        }}
        onClose={() => setLeaveToDelete(null)}
        isLight={isLight}
      />
    </div>
  );
};
