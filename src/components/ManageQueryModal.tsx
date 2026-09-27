import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  FileQuestion,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Trash2,
  FileText,
  ShieldAlert,
  Calendar,
  UserCheck,
  ChevronRight,
  Download,
  AlertCircle,
  Eye,
  Send,
  Ban,
  Check,
  Award,
} from 'lucide-react';
import {
  StaffMember,
  QueryRecord,
  QueryDocumentFile,
  QueryActionVerdict,
  AppSettings,
  User,
} from '../types';
import {
  loadCompanyQueries,
  saveCompanyQueries,
  getStaffYearlyWarningCount,
} from '../utils/staffUtils';
import { getCompanyCurrencySymbol } from '../utils/payrollUtils';
import { emitGlobalToast } from '../context/ToastContext';

interface ManageQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember;
  companyName: string;
  currentUser?: User;
  settings?: AppSettings;
  isLight?: boolean;
  onStaffUpdated?: (updatedStaff: StaffMember) => void;
  initialQueryId?: string;
}

export const ManageQueryModal: React.FC<ManageQueryModalProps> = ({
  isOpen,
  onClose,
  staff,
  companyName,
  currentUser,
  settings,
  isLight = false,
  onStaffUpdated,
  initialQueryId,
}) => {
  const currencySymbol = getCompanyCurrencySymbol(companyName);
  const currentYear = new Date().getFullYear();

  // All queries for company
  const [allQueries, setAllQueries] = useState<QueryRecord[]>(() =>
    loadCompanyQueries(companyName)
  );

  // Filter queries for this staff
  const staffQueries = useMemo(() => {
    return allQueries
      .filter((q) => q.staffId === staff.id || (staff.employeeId && q.staffId === staff.employeeId))
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [allQueries, staff]);

  // Current active / selected query
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  // Tab view: 'active' (view or manage current selected query) | 'new' (create query) | 'history' (past queries list)
  const [viewMode, setViewMode] = useState<'details' | 'new' | 'history'>('details');

  // New Query Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDeadlineHours, setNewDeadlineHours] = useState<24 | 48>(24);
  const [newQueryFile, setNewQueryFile] = useState<QueryDocumentFile | null>(null);
  const [newResponseFile, setNewResponseFile] = useState<QueryDocumentFile | null>(null);

  // Decision Verdict State for closing a query
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [verdict, setVerdict] = useState<QueryActionVerdict>('pardon');
  const [verdictNotes, setVerdictNotes] = useState('');
  const [fineAmount, setFineAmount] = useState<string>('50');
  const [suspensionStart, setSuspensionStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [suspensionEnd, setSuspensionEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  // Warning Counter calculation
  const currentYearWarnings = useMemo(() => {
    return getStaffYearlyWarningCount(staff.id, currentYear, companyName);
  }, [companyName, staff.id, currentYear, allQueries]);

  // Sync selected query on open
  useEffect(() => {
    if (!isOpen) return;
    const queries = loadCompanyQueries(companyName);
    setAllQueries(queries);

    const thisStaffQueries = queries
      .filter((q) => q.staffId === staff.id || (staff.employeeId && q.staffId === staff.employeeId))
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    if (initialQueryId) {
      const match = thisStaffQueries.find((q) => q.id === initialQueryId);
      if (match) {
        setSelectedQueryId(match.id);
        setViewMode('details');
        return;
      }
    }

    // Default to latest pending query if available, otherwise latest closed or 'new'
    const pending = thisStaffQueries.find((q) => q.status === 'pending');
    if (pending) {
      setSelectedQueryId(pending.id);
      setViewMode('details');
    } else if (thisStaffQueries.length > 0) {
      setSelectedQueryId(thisStaffQueries[0].id);
      setViewMode('details');
    } else {
      setViewMode('new');
    }
  }, [isOpen, companyName, staff, initialQueryId]);

  if (!isOpen) return null;

  const activeQuery = staffQueries.find((q) => q.id === selectedQueryId) || staffQueries[0] || null;

  // File Upload Helper
  const handleFileUpload = (
    file: File,
    onSuccess: (doc: QueryDocumentFile) => void
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      const doc: QueryDocumentFile = {
        name: file.name,
        data: reader.result as string,
        size: file.size,
        uploadDate: new Date().toISOString(),
        uploadedAt: new Date().toISOString(),
      };
      onSuccess(doc);
      emitGlobalToast(`Uploaded "${file.name}"`, 'success');
    };
    reader.onerror = () => {
      emitGlobalToast('Failed to read document file.', 'error');
    };
    reader.readAsDataURL(file);
  };

  // Create new Query
  const handleCreateQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      emitGlobalToast('Please provide a Query Title.', 'warning');
      return;
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + newDeadlineHours * 60 * 60 * 1000);

    const newQuery: QueryRecord = {
      id: `QRY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      staffId: staff.id,
      employeeId: staff.employeeId || staff.id,
      staffName: staff.name,
      department: staff.department || 'Operations',
      title: newTitle.trim(),
      deadlineHours: newDeadlineHours,
      issuedAt: now.toISOString(),
      deadlineAt: deadline.toISOString(),
      status: 'pending',
      queryDocument: newQueryFile || undefined,
      responseDocument: newResponseFile || undefined,
      queryFile: newQueryFile || undefined,
      responseFile: newResponseFile || undefined,
      authorizedBy: currentUser?.name || currentUser?.username || 'HR Administration',
    };

    const updated = [newQuery, ...allQueries];
    saveCompanyQueries(updated, companyName);
    setAllQueries(updated);
    setSelectedQueryId(newQuery.id);
    setViewMode('details');

    // Update staff member status to 'On Query'
    if (staff.status !== 'On Query') {
      const updatedStaff: StaffMember = {
        ...staff,
        status: 'On Query',
      };
      onStaffUpdated?.(updatedStaff);
    }

    // Reset create fields
    setNewTitle('');
    setNewQueryFile(null);
    setNewResponseFile(null);

    emitGlobalToast(
      `Query "${newQuery.title}" created. Staff status marked as "On Query".`,
      'success'
    );
  };

  // Upload Query or Response Document on active query
  const handleAttachActiveDoc = (
    type: 'query' | 'response',
    doc: QueryDocumentFile
  ) => {
    if (!activeQuery) return;
    const updatedQueries = allQueries.map((q) => {
      if (q.id === activeQuery.id) {
        return {
          ...q,
          [type === 'query' ? 'queryDocument' : 'responseDocument']: doc,
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    });
    saveCompanyQueries(updatedQueries, companyName);
    setAllQueries(updatedQueries);
  };

  // Remove Document
  const handleRemoveActiveDoc = (type: 'query' | 'response') => {
    if (!activeQuery) return;
    const updatedQueries = allQueries.map((q) => {
      if (q.id === activeQuery.id) {
        return {
          ...q,
          [type === 'query' ? 'queryDocument' : 'responseDocument']: undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    });
    saveCompanyQueries(updatedQueries, companyName);
    setAllQueries(updatedQueries);
    emitGlobalToast(`Removed ${type} document attachment.`, 'info');
  };

  // Close Query with Disciplinary Verdict Action
  const handleApplyVerdict = () => {
    if (!activeQuery) return;

    if (verdict === 'warning' && currentYearWarnings >= 3) {
      emitGlobalToast(
        `Staff has already reached the maximum cap of 3 warnings for ${currentYear}. Consider fine or suspension.`,
        'warning'
      );
      return;
    }

    const now = new Date();
    const warningNum = verdict === 'warning' ? currentYearWarnings + 1 : undefined;

    const updatedQueries = allQueries.map((q) => {
      if (q.id === activeQuery.id) {
        const closed: QueryRecord = {
          ...q,
          status: 'closed',
          closedAt: now.toISOString(),
          closedBy: currentUser?.name || currentUser?.username || 'HR Administration',
          verdict,
          verdictDetails: {
            notes: verdictNotes.trim() || undefined,
            warningNumber: warningNum,
            fineAmount: verdict === 'fine' ? parseFloat(fineAmount) || 0 : undefined,
            suspensionStart: verdict === 'suspension' ? suspensionStart : undefined,
            suspensionEnd: verdict === 'suspension' ? suspensionEnd : undefined,
          },
        };
        return closed;
      }
      return q;
    });

    saveCompanyQueries(updatedQueries, companyName);
    setAllQueries(updatedQueries);
    setIsActionModalOpen(false);

    // Re-evaluate Staff Status after closing query
    // If verdict is suspension, mark Suspended; if exit, mark Exited; otherwise revert from 'On Query' to 'Active'
    let nextStatus: StaffMember['status'] = 'Active';
    if (verdict === 'suspension') {
      nextStatus = 'Suspended';
    } else if (verdict === 'exit') {
      nextStatus = 'Exited';
    } else {
      // Check if they still have another pending query
      const hasOtherPending = updatedQueries.some(
        (q) =>
          q.id !== activeQuery.id &&
          (q.staffId === staff.id || (staff.employeeId && q.staffId === staff.employeeId)) &&
          q.status === 'pending'
      );
      if (hasOtherPending) {
        nextStatus = 'On Query';
      }
    }

    const updatedStaff: StaffMember = {
      ...staff,
      status: nextStatus,
      suspensionStartTime: verdict === 'suspension' ? suspensionStart : staff.suspensionStartTime,
      suspensionEndTime: verdict === 'suspension' ? suspensionEnd : staff.suspensionEndTime,
      suspensionReason: verdict === 'suspension' ? `Query: ${activeQuery.title}. ${verdictNotes}` : staff.suspensionReason,
      exitDate: verdict === 'exit' ? now.toISOString().split('T')[0] : staff.exitDate,
      exitReason: verdict === 'exit' ? (verdictNotes.trim() || `Disciplinary exit following query: ${activeQuery.title}`) : staff.exitReason,
      exitDepartureType: verdict === 'exit' ? 'Disciplinary Dismissal' : staff.exitDepartureType,
    };
    onStaffUpdated?.(updatedStaff);

    emitGlobalToast(
      `Query closed with verdict: ${verdict.toUpperCase()}. Staff status updated to ${nextStatus}.`,
      'success'
    );
  };

  // Calculate Remaining Time for Active Query
  const timeRemainingInfo = useMemo(() => {
    if (!activeQuery) return null;
    const deadlineMs = new Date(activeQuery.deadlineAt).getTime();
    const nowMs = Date.now();
    const diffMs = deadlineMs - nowMs;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (activeQuery.status === 'closed') {
      return { isExpired: true, text: 'Closed', label: 'Completed', color: 'emerald' };
    }

    if (diffMs <= 0) {
      return { isExpired: true, text: 'Deadline Expired', label: 'Awaiting Action', color: 'rose' };
    }

    const hrs = Math.floor(diffHours);
    const mins = Math.floor((diffHours - hrs) * 60);
    return {
      isExpired: false,
      text: `${hrs}h ${mins}m remaining`,
      label: diffHours <= 1 ? '1 Hour Warning' : `${hrs} hrs left`,
      color: diffHours <= 1 ? 'rose' : diffHours <= 12 ? 'amber' : 'blue',
    };
  }, [activeQuery]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
          isLight
            ? 'bg-white text-slate-800 border-slate-200'
            : 'bg-slate-900 text-slate-100 border-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Staff Disciplinary Query</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                    staff.status === 'On Query'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : staff.status === 'Suspended'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {staff.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {staff.name} • {staff.employeeId || staff.id} • {staff.department || 'Operations'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Year Warnings Badge */}
            <div
              className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 ${
                currentYearWarnings >= 3
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : currentYearWarnings > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={`Warnings in ${currentYear}: ${currentYearWarnings}/3 max`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Warnings ({currentYear}): {currentYearWarnings}/3</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between text-xs font-mono gap-2 ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('details')}
              disabled={staffQueries.length === 0}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'details'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Active Query {activeQuery ? `(${activeQuery.status})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('new')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'new'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileQuestion className="w-3.5 h-3.5" />
              <span>Issue New Query</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('history')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>All Logs ({staffQueries.length})</span>
            </button>
          </div>

          {activeQuery && viewMode === 'details' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Query:</span>
              <select
                value={activeQuery.id}
                onChange={(e) => setSelectedQueryId(e.target.value)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                {staffQueries.map((q) => (
                  <option key={q.id} value={q.id}>
                    [{q.status.toUpperCase()}] {q.title.substring(0, 28)}...
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* VIEW: NEW QUERY CREATION */}
          {viewMode === 'new' && (
            <form onSubmit={handleCreateQuery} className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Digital Disciplinary Query Procedure</span>
                </p>
                <p className="mt-1 text-slate-300">
                  Issuing a query will immediately set <strong>{staff.name}</strong>'s status to{' '}
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                    On Query
                  </span>{' '}
                  and trigger digital reminders. You will be prompted for final action (Fines,
                  Suspension, Official Warning, or Pardon) once the response window concludes.
                </p>
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold font-mono text-slate-300">
                  Query Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Failure to comply with safety protocol / Unauthorized absence"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500'
                  }`}
                />
              </div>

              {/* Deadline Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold font-mono text-slate-300">
                  Response Deadline Duration <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewDeadlineHours(24)}
                    className={`p-3 rounded-xl border font-mono text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                      newDeadlineHours === 24
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold ring-2 ring-amber-500/30'
                        : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-bold">24 Hours</span>
                    <span className="text-[10px] text-slate-400">Standard response window</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewDeadlineHours(48)}
                    className={`p-3 rounded-xl border font-mono text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                      newDeadlineHours === 48
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold ring-2 ring-amber-500/30'
                        : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-bold">48 Hours</span>
                    <span className="text-[10px] text-slate-400">Extended investigation window</span>
                  </button>
                </div>
              </div>

              {/* Dual File Uploads: 1. Upload Query & 2. Upload Response */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* Upload Query Document */}
                <div className="p-3.5 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>1. Upload Query Letter / Notice</span>
                    </span>
                    {newQueryFile && (
                      <button
                        type="button"
                        onClick={() => setNewQueryFile(null)}
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {newQueryFile ? (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1 font-mono">{newQueryFile.name}</span>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-600 rounded-lg hover:border-amber-500 hover:bg-amber-500/5 transition cursor-pointer text-center">
                      <Paperclip className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-300">Attach Query PDF / Image</span>
                      <span className="text-[10px] text-slate-500">Official HR query document</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, setNewQueryFile);
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Upload Staff Response */}
                <div className="p-3.5 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>2. Upload Staff Written Response</span>
                    </span>
                    {newResponseFile && (
                      <button
                        type="button"
                        onClick={() => setNewResponseFile(null)}
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {newResponseFile ? (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1 font-mono">{newResponseFile.name}</span>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-600 rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition cursor-pointer text-center">
                      <Paperclip className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-300">Attach Employee Response</span>
                      <span className="text-[10px] text-slate-500">Optional now, can be uploaded later</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, setNewResponseFile);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (staffQueries.length > 0) setViewMode('details');
                    else onClose();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Issue Query & Notify</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW: ACTIVE QUERY DETAILS & DIGITAL TIMELINE */}
          {viewMode === 'details' && activeQuery && (
            <div className="space-y-4">
              {/* Status & Deadline Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  activeQuery.status === 'closed'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : timeRemainingInfo?.color === 'rose'
                    ? 'bg-rose-500/15 border-rose-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${
                        activeQuery.status === 'closed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      Status: {activeQuery.status}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {activeQuery.deadlineHours}-Hour Window
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white tracking-tight">{activeQuery.title}</h4>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3 flex-wrap">
                    <span>Issued: {new Date(activeQuery.issuedAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>Deadline: {new Date(activeQuery.deadlineAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                      activeQuery.status === 'closed'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : timeRemainingInfo?.color === 'rose'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timeRemainingInfo?.text}</span>
                  </span>

                  {activeQuery.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => setIsActionModalOpen(true)}
                      className="mt-1 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Take Final Action / Close Query</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Verdict Summary if Closed */}
              {activeQuery.status === 'closed' && (
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Closed Action Verdict: {activeQuery.verdict?.toUpperCase()}</span>
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      Closed on {activeQuery.closedAt ? new Date(activeQuery.closedAt).toLocaleDateString() : 'N/A'} by {activeQuery.closedBy}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-300">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono">
                      <span className="text-[10px] text-slate-500 block uppercase">Disciplinary Action</span>
                      <span className="font-bold text-white capitalize">{activeQuery.verdict}</span>
                    </div>

                    {activeQuery.verdict === 'warning' && (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-500 block uppercase">Official Warning Count</span>
                        <span className="font-bold text-amber-400">
                          Warning #{activeQuery.verdictDetails?.warningNumber || 1} of 3 ({currentYear})
                        </span>
                      </div>
                    )}

                    {activeQuery.verdict === 'fine' && (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-500 block uppercase">Fine Applied</span>
                        <span className="font-bold text-rose-400">
                          {currencySymbol}{activeQuery.verdictDetails?.fineAmount || 0}
                        </span>
                      </div>
                    )}

                    {activeQuery.verdict === 'suspension' && (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-500 block uppercase">Suspension Window</span>
                        <span className="font-bold text-amber-300">
                          {activeQuery.verdictDetails?.suspensionStart} to {activeQuery.verdictDetails?.suspensionEnd}
                        </span>
                      </div>
                    )}

                    {activeQuery.verdict === 'exit' && (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-500 block uppercase">Resolution</span>
                        <span className="font-bold text-red-400">Disciplinary Exit / Dismissal</span>
                      </div>
                    )}

                    {activeQuery.verdict === 'pardon' && (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-500 block uppercase">Resolution</span>
                        <span className="font-bold text-emerald-400">Pardoned without Penalty</span>
                      </div>
                    )}
                  </div>

                  {activeQuery.verdictDetails?.notes && (
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300 text-xs">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Verdict Notes</span>
                      <p className="mt-0.5 italic">{activeQuery.verdictDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Dual Files Management for this Query */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* File 1: Query Document */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-amber-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>1. Official Query Notice</span>
                    </span>
                    {activeQuery.queryDocument && (
                      <button
                        type="button"
                        onClick={() => handleRemoveActiveDoc('query')}
                        className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {activeQuery.queryDocument ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-4 h-4 text-amber-400 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate font-mono">
                              {activeQuery.queryDocument.name}
                            </p>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Uploaded {new Date(activeQuery.queryDocument.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <a
                          href={activeQuery.queryDocument.data}
                          download={activeQuery.queryDocument.name}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-bold text-[11px] flex items-center gap-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-5 border border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl hover:bg-amber-500/5 transition cursor-pointer text-center">
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-300">Upload Query Letter</span>
                      <span className="text-[10px] text-slate-500">PDF, JPG, PNG or DOC</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, (doc) => handleAttachActiveDoc('query', doc));
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* File 2: Response Document */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-blue-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>2. Employee Written Response</span>
                    </span>
                    {activeQuery.responseDocument && (
                      <button
                        type="button"
                        onClick={() => handleRemoveActiveDoc('response')}
                        className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {activeQuery.responseDocument ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate font-mono">
                              {activeQuery.responseDocument.name}
                            </p>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Uploaded {new Date(activeQuery.responseDocument.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <a
                          href={activeQuery.responseDocument.data}
                          download={activeQuery.responseDocument.name}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-[11px] flex items-center gap-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-5 border border-dashed border-slate-700 hover:border-blue-500/80 rounded-xl hover:bg-blue-500/5 transition cursor-pointer text-center">
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-300">Upload Staff Response</span>
                      <span className="text-[10px] text-slate-500">PDF, JPG, PNG or DOC</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, (doc) => handleAttachActiveDoc('response', doc));
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: PAST HISTORY LOG OF QUERIES */}
          {viewMode === 'history' && (
            <div className="space-y-3">
              {staffQueries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <FileQuestion className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">No disciplinary queries logged for this staff member.</p>
                </div>
              ) : (
                staffQueries.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => {
                      setSelectedQueryId(q.id);
                      setViewMode('details');
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      selectedQueryId === q.id
                        ? 'bg-amber-500/10 border-amber-500/50'
                        : isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/80'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                            q.status === 'closed'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {q.status}
                        </span>
                        <h5 className="text-xs font-bold text-white truncate">{q.title}</h5>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                        <span>Issued: {new Date(q.issuedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Deadline: {q.deadlineHours}h</span>
                        {q.verdict && (
                          <>
                            <span>•</span>
                            <span className="text-teal-400 font-bold">Action: {q.verdict.toUpperCase()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        {q.queryDocument ? '📄 1' : '0'}/{q.responseDocument ? '1' : '0'} docs
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between text-xs ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <span className="text-slate-400 font-mono text-[11px]">
            Digital Disciplinary Log • Max 3 Warnings / Year
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>

      {/* SUB-MODAL: DISCIPLINARY VERDICT ACTIONS MODAL (Fines / Suspension / Warning / Pardon) */}
      {isActionModalOpen && activeQuery && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsActionModalOpen(false);
          }}
        >
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl p-5 border space-y-4 ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold tracking-tight">Select Next Disciplinary Action</h4>
              </div>
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              The query for <strong>{staff.name}</strong> will be marked as{' '}
              <span className="text-emerald-400 font-bold font-mono">CLOSED</span>. Choose the formal
              disciplinary verdict to conclude this case:
            </p>

            {/* Verdict Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Official Warning */}
              <button
                type="button"
                onClick={() => setVerdict('warning')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  verdict === 'warning'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Official Warning</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      currentYearWarnings >= 3
                        ? 'bg-rose-500/20 text-rose-300 font-bold'
                        : 'bg-amber-500/20 text-amber-400 font-bold'
                    }`}
                  >
                    {currentYearWarnings}/3 Max
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Logs warning #{Math.min(3, currentYearWarnings + 1)} on staff record.
                </span>
              </button>

              {/* 2. Fine / Penalty */}
              <button
                type="button"
                onClick={() => setVerdict('fine')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  verdict === 'fine'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Impose Fine</span>
                  <span className="text-[10px] font-mono text-rose-400 font-bold">Payroll Deduction</span>
                </div>
                <span className="text-[10px] text-slate-400">Apply a monetary disciplinary fine.</span>
              </button>

              {/* 3. Suspension */}
              <button
                type="button"
                onClick={() => setVerdict('suspension')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  verdict === 'suspension'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 ring-2 ring-purple-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Suspension</span>
                  <span className="text-[10px] font-mono text-purple-400 font-bold">Status: Suspended</span>
                </div>
                <span className="text-[10px] text-slate-400">Relieve staff of duty for set period.</span>
              </button>

              {/* 4. Exit / Termination */}
              <button
                type="button"
                onClick={() => setVerdict('exit')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  verdict === 'exit'
                    ? 'bg-red-600/20 border-red-500 text-red-300 ring-2 ring-red-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Exit / Dismissal</span>
                  <span className="text-[10px] font-mono text-red-400 font-bold">Status: Exited</span>
                </div>
                <span className="text-[10px] text-slate-400">Formal disciplinary exit.</span>
              </button>

              {/* 5. Pardon */}
              <button
                type="button"
                onClick={() => setVerdict('pardon')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  verdict === 'pardon'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Pardon</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">Clear Record</span>
                </div>
                <span className="text-[10px] text-slate-400">Close query with formal pardon.</span>
              </button>
            </div>

            {/* Sub-inputs depending on Verdict */}
            {verdict === 'exit' && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 space-y-1.5">
                <div className="flex items-center gap-2 text-red-400 text-xs font-bold font-mono">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Disciplinary Termination Notice</span>
                </div>
                <p className="text-[11px] text-red-200/80">
                  Selecting &quot;Exit&quot; will formally close this query and set {staff.name}&apos;s profile status to &quot;Exited&quot; with departure reason &quot;Disciplinary Dismissal&quot;.
                </p>
              </div>
            )}
            {verdict === 'fine' && (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <label className="block text-xs font-bold font-mono text-slate-300">
                  Fine Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            {verdict === 'suspension' && (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
                <span className="text-xs font-bold font-mono text-purple-300 block">
                  Suspension Effective Range
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={suspensionStart}
                      onChange={(e) => setSuspensionStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={suspensionEnd}
                      onChange={(e) => setSuspensionEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {verdict === 'warning' && currentYearWarnings >= 3 && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  <strong>Warning Limit Reached:</strong> {staff.name} already has 3 warnings in{' '}
                  {currentYear}. Further disciplinary action like fine or suspension is strongly recommended.
                </span>
              </div>
            )}

            {/* Notes input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold font-mono text-slate-300">
                Resolution / Verdict Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Enter justification, mitigation details, or executive notes..."
                value={verdictNotes}
                onChange={(e) => setVerdictNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsActionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyVerdict}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Verdict & Close Query</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
