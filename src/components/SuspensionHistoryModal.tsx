import React, { useState, useMemo, useCallback } from 'react';
import {
  History,
  X,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  UserMinus,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Building2,
  FileText,
  Trash2,
  AlertOctagon,
  ChevronsUpDown,
  Layers,
} from 'lucide-react';
import { StaffMember, SuspensionHistoryRecord } from '../types';
import { getAllCompanySuspensionHistory, deleteCompanySuspensionRecord } from '../utils/staffUtils';
import { loadCompanyPayrollConfig } from '../utils/payrollUtils';
import { STORAGE_KEYS, loadCompanyData } from '../utils/companyStorage';

interface SuspensionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  companyName?: string;
  currentUser?: { role?: string; isAdmin?: boolean; isSuperAdmin?: boolean; name?: string };
  canManage?: boolean;
  onSelectStaff?: (staff: StaffMember) => void;
  onRecordsUpdated?: (updatedStaff?: StaffMember[]) => void;
}

export const SuspensionHistoryModal: React.FC<SuspensionHistoryModalProps> = ({
  isOpen,
  onClose,
  staffList,
  companyName,
  currentUser,
  canManage,
  onSelectStaff,
  onRecordsUpdated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Currently Suspended' | 'Concluded' | 'Restored' | 'Pardoned'>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());
  const [recordToDelete, setRecordToDelete] = useState<SuspensionHistoryRecord | null>(null);
  const [deletedRecordIds, setDeletedRecordIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const payrollConfig = useMemo(() => loadCompanyPayrollConfig(companyName), [companyName, isOpen, refreshTrigger]);
  const currencySymbol = payrollConfig.currencySymbol || '$';

  // Check if current user is authorized to delete (Admin / Manager role)
  const isAuthorizedToDelete = useMemo(() => {
    if (canManage !== undefined) return canManage;
    if (!currentUser) return true; // Default admin in single-user mode
    const role = (currentUser.role || '').toLowerCase();
    return (
      currentUser.isAdmin === true ||
      currentUser.isSuperAdmin === true ||
      role.includes('admin') ||
      role.includes('manager') ||
      role.includes('lead') ||
      role.includes('director') ||
      role.includes('hr') ||
      role.includes('officer') ||
      role === ''
    );
  }, [currentUser, canManage]);

  // Load all suspension history records
  const allHistoryRecords = useMemo(() => {
    if (!isOpen) return [];
    // Read directly from storage to ensure we have the freshly restored staff status
    const currentStaff = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, companyName, staffList);
    const records = getAllCompanySuspensionHistory(companyName, currentStaff);
    return records.filter((r) => !deletedRecordIds.has(r.id) && !deletedRecordIds.has(`active-susp-${r.staffId}`));
  }, [isOpen, companyName, staffList, refreshTrigger, deletedRecordIds]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    allHistoryRecords.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    staffList.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return ['All', ...Array.from(set).sort()];
  }, [allHistoryRecords, staffList]);

  // Helper to determine if a suspension record is active based on dates:
  // "If the date spans beyond or on the current date, it is active. If not, it is completed/inactive."
  const isRecordCurrentlyActive = (rec: SuspensionHistoryRecord): boolean => {
    if (rec.status === 'Restored' || rec.type === 'restored' || rec.title?.toLowerCase().includes('restored')) {
      return false;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const sDate = (rec.startDate || rec.date || '').split('T')[0].trim();
    const eDate = (rec.endDate || '').split('T')[0].trim();
    if (eDate) {
      return eDate >= todayStr;
    }
    if (sDate) {
      return sDate <= todayStr;
    }
    return false;
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return allHistoryRecords.filter((rec) => {
      const isRestored = rec.status === 'Restored' || rec.type === 'restored' || rec.title?.toLowerCase().includes('restored');
      const isActive = isRecordCurrentlyActive(rec);

      // Status filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Currently Suspended' && !isActive) return false;
        if (statusFilter === 'Concluded' && (isActive || isRestored)) return false;
        if (statusFilter === 'Restored' && !isRestored) return false;
        if (statusFilter === 'Pardoned' && rec.status !== 'Pardoned' && !rec.deductionPolicy?.toLowerCase().includes('pardon')) return false;
      }

      // Department filter
      if (departmentFilter !== 'All' && rec.department !== departmentFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = rec.staffName.toLowerCase().includes(q);
        const matchId = (rec.employeeId || '').toLowerCase().includes(q);
        const matchDept = (rec.department || '').toLowerCase().includes(q);
        const matchReason = (rec.reason || '').toLowerCase().includes(q);
        const matchPolicy = (rec.deductionPolicy || '').toLowerCase().includes(q);
        const matchAuth = (rec.authorizedBy || '').toLowerCase().includes(q);
        return matchName || matchId || matchDept || matchReason || matchPolicy || matchAuth;
      }

      return true;
    });
  }, [allHistoryRecords, statusFilter, departmentFilter, searchTerm]);

  // Summary metrics
  const totalEvents = allHistoryRecords.length;
  const activeCount = allHistoryRecords.filter((r) => isRecordCurrentlyActive(r)).length;
  const totalFinancialDeducted = allHistoryRecords.reduce((sum, r) => sum + (Number(r.deductionAmount) || 0), 0);
  const totalPardons = allHistoryRecords.filter((r) => (Number(r.deductionAmount) === 0 || r.deductionPolicy?.toLowerCase().includes('pardon'))).length;

  // Toggle single accordion row
  const toggleRow = useCallback((id: string) => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand / Collapse all rows
  const handleToggleExpandAll = useCallback(() => {
    if (expandedRecordIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setExpandedRecordIds(new Set());
    } else {
      setExpandedRecordIds(new Set(filteredRecords.map((r) => r.id)));
    }
  }, [expandedRecordIds, filteredRecords]);

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);

    try {
      const recId = recordToDelete.id;
      const sId = recordToDelete.staffId;
      const res = deleteCompanySuspensionRecord(
        recId,
        sId,
        companyName,
        true
      );

      // Immediately filter it out from UI state
      setDeletedRecordIds((prev) => {
        const next = new Set(prev);
        next.add(recId);
        next.add(`active-susp-${sId}`);
        return next;
      });

      if (res.success) {
        let msg = `Suspension log for "${recordToDelete.staffName}" deleted.`;
        if (res.penaltyRemoved) msg += ' Associated payroll fine removed.';
        if (res.staffRestored) msg += ' Staff status restored to Active.';

        setActionNotice(msg);
        setTimeout(() => setActionNotice(null), 5000);
        setRefreshTrigger((prev) => prev + 1);
        if (onRecordsUpdated) onRecordsUpdated(res.updatedStaffList);
      }
    } catch (err) {
      console.error('Error deleting suspension record:', err);
    } finally {
      setIsDeleting(false);
      setRecordToDelete(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = [
      'Log ID',
      'Staff Name',
      'Employee ID',
      'Department',
      'Role',
      'Status',
      'Start Date',
      'End Date',
      'Duration (Days)',
      'Deduction Policy / Fine',
      'Deduction Amount',
      'Calculation Type',
      'Reason / Reference',
      'Authorized By',
      'Logged Date',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.id}"`,
      `"${r.staffName}"`,
      `"${r.employeeId || ''}"`,
      `"${r.department || ''}"`,
      `"${r.role || ''}"`,
      `"${r.status}"`,
      `"${r.startDate || ''}"`,
      `"${r.endDate || 'Indefinite'}"`,
      r.durationDays || 1,
      `"${r.deductionPolicy || ''}"`,
      r.deductionAmount || 0,
      `"${r.calculationType || ''}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${r.authorizedBy || ''}"`,
      `"${r.date || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suspension_audit_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Staff Suspension Audit & History Log</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {filteredRecords.length} Record{filteredRecords.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official disciplinary suspension registry, daily salary deduction tracking, and financial penalty audit trail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Export Log as CSV"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notice / Toast */}
        {actionNotice && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metrics Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-xs shrink-0">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm font-mono text-white">{totalEvents}</div>
              <div className="text-[10px] text-slate-400">Total Logged Cases</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <UserMinus className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm font-mono text-amber-300">{activeCount}</div>
              <div className="text-[10px] text-slate-400">Active Suspensions</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm font-mono text-rose-300">
                {currencySymbol}{totalFinancialDeducted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400">Total Deductions Booked</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm font-mono text-emerald-300">{totalPardons}</div>
              <div className="text-[10px] text-slate-400">Pardoned (No Fine)</div>
            </div>
          </div>
        </div>

        {/* Search, Filters, and Expand/Collapse Controls */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Employee ID, Name, Department, Reason, or Officer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 text-xs rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Dept filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-[11px]">Dept:</span>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d} value={d} className="bg-slate-900 text-white">
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-[11px]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-slate-900 text-white">All Statuses</option>
                <option value="Currently Suspended" className="bg-slate-900 text-white">Active Suspension</option>
                <option value="Concluded" className="bg-slate-900 text-white">Concluded / Ended</option>
                <option value="Restored" className="bg-slate-900 text-white">Restored to Duty</option>
                <option value="Pardoned" className="bg-slate-900 text-white">Pardoned (No Fine)</option>
              </select>
            </div>

            {/* Expand / Collapse All Toggle */}
            {filteredRecords.length > 0 && (
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                title={expandedRecordIds.size === filteredRecords.length ? 'Collapse all dropdown logs' : 'Expand all dropdown logs'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {expandedRecordIds.size === filteredRecords.length ? 'Collapse All' : 'Expand All'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Content Accordion Dropdown List */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2.5">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-800 text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-500 opacity-50" />
              <p className="text-sm font-semibold text-slate-300">No suspension history records found.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Suspension events, daily salary deductions, and pardons will automatically log here when staff are suspended.
              </p>
            </div>
          ) : (
            filteredRecords.map((rec) => {
              const isCurrentlySuspended = isRecordCurrentlyActive(rec);
              const isRestored = rec.status === 'Restored' || rec.type === 'restored';
              const isPardoned = Number(rec.deductionAmount) === 0 || rec.deductionPolicy?.toLowerCase().includes('pardon');
              const isExpanded = expandedRecordIds.has(rec.id);

              return (
                <div
                  key={rec.id}
                  className={`rounded-2xl border transition shadow-sm overflow-hidden ${
                    isExpanded
                      ? 'bg-slate-800/80 border-slate-600/90 ring-1 ring-amber-500/20'
                      : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/70'
                  }`}
                >
                  {/* Collapsed Dropdown Header Row */}
                  <div
                    onClick={() => toggleRow(rec.id)}
                    className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    {/* Left: Avatar & Identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-900/60 text-blue-300 border border-blue-700/60 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {rec.staffName ? rec.staffName.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-white truncate">{rec.staffName}</span>
                          <span className="font-mono text-[11px] text-blue-400 font-semibold">
                            ({rec.employeeId || 'ID Pending'})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {rec.department || 'General'} • {rec.role || 'Staff'}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Status, Duration, and Financial Deductions summary */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      {/* Status Tag */}
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 border ${
                          isCurrentlySuspended
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : isRestored
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        {isCurrentlySuspended ? (
                          <>
                            <UserMinus className="w-3 h-3" />
                            <span>Currently Suspended</span>
                          </>
                        ) : isRestored ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Restored</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3 h-3" />
                            <span>Concluded</span>
                          </>
                        )}
                      </span>

                      {/* Dates / Duration */}
                      <span className="text-[11px] font-mono text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                        {rec.startDate || 'Start'} → {rec.endDate || 'Indefinite'} ({rec.durationDays || 1}d)
                      </span>

                      {/* Fine / Deduction pill */}
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                          isPardoned
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {isPardoned
                          ? 'Pardoned ($0)'
                          : `-${currencySymbol}${Number(rec.deductionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                      </span>

                      {/* Action buttons on the right */}
                      <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Delete Button (Restricted to Admin & Manager) */}
                        {isAuthorizedToDelete && (
                          <button
                            type="button"
                            onClick={() => setRecordToDelete(rec)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                            title="Delete suspension log (Admin/Manager only - also voids deduction)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Chevron dropdown toggle button */}
                        <button
                          type="button"
                          onClick={() => toggleRow(rec.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition cursor-pointer"
                          title={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-amber-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Dropdown Details Section */}
                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-slate-700/60 mt-1 bg-slate-900/50 space-y-3 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-3">
                        {/* Column 1: Suspension Duration */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            Suspension Duration & Period
                          </span>
                          <div className="font-semibold text-slate-200">
                            {rec.startDate} → {rec.endDate || 'Indefinite'}
                          </div>
                          <div className="text-[11px] font-mono text-amber-300 font-bold">
                            {rec.durationDays} Calendar Day{rec.durationDays === 1 ? '' : 's'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Logged: {rec.date || rec.timestamp?.split('T')[0]}
                          </div>
                        </div>

                        {/* Column 2: Deduction Policy Applied */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-rose-400" />
                            Financial Penalty / Deduction Policy
                          </span>
                          <div className="font-bold text-xs text-white">
                            {rec.deductionPolicy}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            {isPardoned ? (
                              <span className="text-emerald-400 font-bold">Pardoned ($0.00 Deduction)</span>
                            ) : (
                              <span className="text-rose-400 font-bold">
                                Total: -{currencySymbol}{Number(rec.deductionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400">
                              ({rec.calculationType === 'daily_pay' ? 'Daily Pay Rate' : rec.calculationType === 'rigid' ? 'Rigid Rate' : 'Catalog Fine'})
                            </span>
                          </div>
                          {rec.dailyRate && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Calculated Rate: {currencySymbol}{rec.dailyRate.toFixed(2)}/day
                            </div>
                          )}
                        </div>

                        {/* Column 3: Reason & Authorization */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-purple-400" />
                            Memo Reason & Officer Authority
                          </span>
                          <div className="text-slate-300 italic" title={rec.reason}>
                            "{rec.reason || 'Disciplinary workforce review'}"
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                            <span className="font-semibold text-slate-300">Authorized by:</span> {rec.authorizedBy || 'HR Management'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            Audit Ref: {rec.id}
                          </div>
                        </div>
                      </div>

                      {/* Row Actions: Delete Log & Open Staff Profile */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        {isAuthorizedToDelete ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecordToDelete(rec);
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-500/20"
                            title="Delete this suspension log from audit trail and void deductions"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Suspension Log</span>
                          </button>
                        ) : <div />}

                        {onSelectStaff && (
                          <button
                            type="button"
                            onClick={() => {
                              const found = staffList.find((s) => s.id === rec.staffId || s.employeeId === rec.employeeId);
                              if (found) onSelectStaff(found);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open Staff Personnel File</span>
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Individual logs are collapsible to optimize screen space. Admins & Managers can delete erroneous logs.</span>
            <span className="sm:hidden">Collapsible logs & Admin audit controls.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Close Audit Log
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setRecordToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Suspension Record?</h3>
                <p className="text-[11px] text-slate-400">Admin & Manager Action</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                Are you sure you want to delete the suspension log for <strong className="text-white">{recordToDelete.staffName}</strong>?
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                <div className="text-slate-400">
                  • <strong>Log Record:</strong> {recordToDelete.startDate} → {recordToDelete.endDate || 'Indefinite'} ({recordToDelete.durationDays || 1} days)
                </div>
                <div className="text-slate-400">
                  • <strong>Payroll Action:</strong> Any associated deduction penalty will be deleted/voided from the payroll ledger.
                </div>
                <div className="text-slate-400">
                  • <strong>Staff Status:</strong> If currently marked as suspended, the employee will be restored to <strong>Active</strong>.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete & Void Fine'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
