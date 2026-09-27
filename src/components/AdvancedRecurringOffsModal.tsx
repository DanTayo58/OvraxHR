import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Settings,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Users,
  Building2,
  Briefcase,
  AlertCircle,
  CalendarCheck2,
  Filter,
  Search,
  Check,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { StaffMember, RecurringOffRule } from '../types';
import { loadCompanyData, saveCompanyData } from '../utils/companyStorage';
import { emitGlobalToast } from '../context/ToastContext';

interface AdvancedRecurringOffsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  departments?: string[];
  companyName?: string;
  isLight?: boolean;
}

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun', full: 'Sunday' },
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' },
];

const RECURRING_OFFS_STORAGE_KEY = 'skima_recurring_offs_v1';

export const AdvancedRecurringOffsModal: React.FC<AdvancedRecurringOffsModalProps> = ({
  isOpen,
  onClose,
  staffList,
  departments = [],
  companyName,
  isLight = false,
}) => {
  // Load Rules from Storage
  const [rules, setRules] = useState<RecurringOffRule[]>(() => {
    return loadCompanyData<RecurringOffRule[]>(
      RECURRING_OFFS_STORAGE_KEY,
      companyName,
      [
        {
          id: 'rule-weekend-sat',
          name: 'Standard Alternate Saturday Rest',
          cycle: 'biweekly',
          daysOfWeek: [6],
          assignmentType: 'department',
          targetDepartments: departments.length > 0 ? [departments[0]] : ['Operations'],
          notes: 'Special alternating weekend off scheduled across operational teams.',
          isEnabled: true,
          createdAt: new Date().toISOString(),
        },
      ]
    );
  });

  // Unique list of departments and roles derived from staff
  const allDepartments = useMemo(() => {
    const set = new Set<string>(departments);
    staffList.forEach((s) => {
      if (s.department) set.add(s.department.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [departments, staffList]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.role) set.add(s.role.trim());
      if (s.jobTitle) set.add(s.jobTitle.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [staffList]);

  // Modal Sub-view: 'list' or 'form'
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formCycle, setFormCycle] = useState<RecurringOffRule['cycle']>('weekly');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([6]);
  const [formAssignmentType, setFormAssignmentType] = useState<RecurringOffRule['assignmentType']>('department');
  const [formSelectedDepts, setFormSelectedDepts] = useState<string[]>([]);
  const [formSelectedRoles, setFormSelectedRoles] = useState<string[]>([]);
  const [formSelectedStaffIds, setFormSelectedStaffIds] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formStaffSearch, setFormStaffSearch] = useState('');

  // Selected Rule to inspect participants
  const [inspectingRule, setInspectingRule] = useState<RecurringOffRule | null>(null);

  // Persist helper
  const updateRules = (nextRules: RecurringOffRule[], toastMsg?: string) => {
    setRules(nextRules);
    saveCompanyData(RECURRING_OFFS_STORAGE_KEY, nextRules, companyName);
    window.dispatchEvent(new CustomEvent('skima_recurring_offs_updated', { detail: nextRules }));
    if (toastMsg) {
      emitGlobalToast(toastMsg, 'success');
    }
  };

  const handleOpenCreate = () => {
    setEditingRuleId(null);
    setFormName('');
    setFormCycle('weekly');
    setFormDaysOfWeek([6]);
    setFormAssignmentType('department');
    setFormSelectedDepts(allDepartments.slice(0, 1));
    setFormSelectedRoles([]);
    setFormSelectedStaffIds([]);
    setFormNotes('');
    setFormStaffSearch('');
    setViewMode('form');
  };

  const handleOpenEdit = (rule: RecurringOffRule) => {
    setEditingRuleId(rule.id);
    setFormName(rule.name);
    setFormCycle(rule.cycle || 'weekly');
    setFormDaysOfWeek(rule.daysOfWeek || []);
    setFormAssignmentType(rule.assignmentType || 'department');
    setFormSelectedDepts(rule.targetDepartments || []);
    setFormSelectedRoles(rule.targetRoles || []);
    setFormSelectedStaffIds(rule.targetStaffIds || []);
    setFormNotes(rule.notes || '');
    setFormStaffSearch('');
    setViewMode('form');
  };

  const handleToggleDay = (dayId: number) => {
    setFormDaysOfWeek((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  // Staff coverage calculation
  const getCoveredStaffCount = (rule: RecurringOffRule): number => {
    if (!rule.isEnabled) return 0;
    if (rule.assignmentType === 'all') {
      return staffList.length;
    }
    if (rule.assignmentType === 'department') {
      const depts = new Set((rule.targetDepartments || []).map((d) => d.toLowerCase()));
      return staffList.filter((s) => s.department && depts.has(s.department.toLowerCase())).length;
    }
    if (rule.assignmentType === 'role') {
      const roles = new Set((rule.targetRoles || []).map((r) => r.toLowerCase()));
      return staffList.filter(
        (s) => (s.role && roles.has(s.role.toLowerCase())) || (s.jobTitle && roles.has(s.jobTitle.toLowerCase()))
      ).length;
    }
    if (rule.assignmentType === 'individual') {
      const ids = new Set(rule.targetStaffIds || []);
      return staffList.filter((s) => ids.has(s.id)).length;
    }
    return 0;
  };

  const getCoveredStaffList = (rule: RecurringOffRule): StaffMember[] => {
    if (rule.assignmentType === 'all') return staffList;
    if (rule.assignmentType === 'department') {
      const depts = new Set((rule.targetDepartments || []).map((d) => d.toLowerCase()));
      return staffList.filter((s) => s.department && depts.has(s.department.toLowerCase()));
    }
    if (rule.assignmentType === 'role') {
      const roles = new Set((rule.targetRoles || []).map((r) => r.toLowerCase()));
      return staffList.filter(
        (s) => (s.role && roles.has(s.role.toLowerCase())) || (s.jobTitle && roles.has(s.jobTitle.toLowerCase()))
      );
    }
    if (rule.assignmentType === 'individual') {
      const ids = new Set(rule.targetStaffIds || []);
      return staffList.filter((s) => ids.has(s.id));
    }
    return [];
  };

  const handleToggleRule = (ruleId: string) => {
    const target = rules.find((r) => r.id === ruleId);
    if (!target) return;
    const nextState = !target.isEnabled;
    const next = rules.map((r) => (r.id === ruleId ? { ...r, isEnabled: nextState } : r));
    updateRules(next, `Recurring off rule "${target.name}" ${nextState ? 'Enabled' : 'Disabled'}`);
  };

  const handleDeleteRule = (ruleId: string) => {
    const target = rules.find((r) => r.id === ruleId);
    const next = rules.filter((r) => r.id !== ruleId);
    updateRules(next, `Removed recurring off rule "${target?.name || ''}"`);
    if (inspectingRule?.id === ruleId) setInspectingRule(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      emitGlobalToast('Please provide a name for this recurring off rule.', 'warning');
      return;
    }
    if (formDaysOfWeek.length === 0) {
      emitGlobalToast('Please select at least one recurring off day.', 'warning');
      return;
    }

    if (formAssignmentType === 'department' && formSelectedDepts.length === 0) {
      emitGlobalToast('Please select at least one department.', 'warning');
      return;
    }
    if (formAssignmentType === 'role' && formSelectedRoles.length === 0) {
      emitGlobalToast('Please select at least one role.', 'warning');
      return;
    }
    if (formAssignmentType === 'individual' && formSelectedStaffIds.length === 0) {
      emitGlobalToast('Please select at least one staff member.', 'warning');
      return;
    }

    if (editingRuleId) {
      const next = rules.map((r) =>
        r.id === editingRuleId
          ? {
              ...r,
              name: formName.trim(),
              cycle: formCycle,
              daysOfWeek: formDaysOfWeek,
              assignmentType: formAssignmentType,
              targetDepartments: formAssignmentType === 'department' ? formSelectedDepts : undefined,
              targetRoles: formAssignmentType === 'role' ? formSelectedRoles : undefined,
              targetStaffIds: formAssignmentType === 'individual' ? formSelectedStaffIds : undefined,
              notes: formNotes.trim(),
              updatedAt: new Date().toISOString(),
            }
          : r
      );
      updateRules(next, `Updated recurring off rule "${formName.trim()}"`);
    } else {
      const newRule: RecurringOffRule = {
        id: `off-rule-${Date.now()}`,
        name: formName.trim(),
        cycle: formCycle,
        daysOfWeek: formDaysOfWeek,
        assignmentType: formAssignmentType,
        targetDepartments: formAssignmentType === 'department' ? formSelectedDepts : undefined,
        targetRoles: formAssignmentType === 'role' ? formSelectedRoles : undefined,
        targetStaffIds: formAssignmentType === 'individual' ? formSelectedStaffIds : undefined,
        notes: formNotes.trim(),
        isEnabled: true,
        createdAt: new Date().toISOString(),
      };
      updateRules([newRule, ...rules], `Created recurring off rule "${formName.trim()}"`);
    }

    setViewMode('list');
    setEditingRuleId(null);
  };

  // Staff search filter in Form
  const filteredStaffListForForm = useMemo(() => {
    if (!formStaffSearch.trim()) return staffList;
    const q = formStaffSearch.toLowerCase();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.employeeId && s.employeeId.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q))
    );
  }, [staffList, formStaffSearch]);

  const handleSelectAllFilteredStaff = () => {
    const ids = new Set(formSelectedStaffIds);
    filteredStaffListForForm.forEach((s) => ids.add(s.id));
    setFormSelectedStaffIds(Array.from(ids));
  };

  const handleClearAllStaff = () => {
    setFormSelectedStaffIds([]);
  };

  const handleToggleStaffId = (id: string) => {
    setFormSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={`w-full max-w-4xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[92vh] ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between border-slate-800/80 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Advanced Leave & Recurring Offs Configuration
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono text-[10px] font-bold border border-teal-500/30">
                  Recurring Non-Logged Offs
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Configure special recurring off policies (e.g. Alternate Saturdays, Departmental Offs, Role Rest). These reflect directly on participants without cluttering the logged leaves ledger.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {viewMode === 'list' && (
            <>
              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Active Policies: {rules.filter((r) => r.isEnabled).length} / {rules.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Configure New Recurring Off</span>
                </button>
              </div>

              {/* Rules List */}
              {rules.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-slate-700 space-y-2">
                  <Clock className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">No Recurring Off Rules Configured</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Add special recurring offs such as alternating Saturdays, specific day off patterns, or departmental non-working schedules.
                  </p>
                  <button
                    onClick={handleOpenCreate}
                    className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Configure First Rule
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {rules.map((rule) => {
                    const coveredCount = getCoveredStaffCount(rule);
                    const isInspecting = inspectingRule?.id === rule.id;

                    return (
                      <div
                        key={rule.id}
                        className={`p-4 rounded-xl border transition space-y-3 relative flex flex-col justify-between ${
                          rule.isEnabled
                            ? isLight
                              ? 'bg-white border-slate-200 shadow-sm'
                              : 'bg-slate-900/90 border-slate-800'
                            : isLight
                            ? 'bg-slate-100/60 border-slate-200 opacity-60'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black text-slate-100">{rule.name}</h4>
                                <span
                                  className={`px-2 py-0.2 text-[9px] font-bold rounded-full uppercase ${
                                    rule.cycle === 'biweekly'
                                      ? 'bg-indigo-500/20 text-indigo-300'
                                      : rule.cycle === 'monthly'
                                      ? 'bg-purple-500/20 text-purple-300'
                                      : 'bg-teal-500/20 text-teal-300'
                                  }`}
                                >
                                  {rule.cycle === 'biweekly'
                                    ? 'Alternate Weeks'
                                    : rule.cycle === 'monthly'
                                    ? 'Monthly'
                                    : 'Weekly'}
                                </span>
                              </div>
                              {rule.notes && (
                                <p className="text-[11px] text-slate-400 line-clamp-1">{rule.notes}</p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleRule(rule.id)}
                              title={rule.isEnabled ? 'Disable rule' : 'Enable rule'}
                              className="text-slate-400 hover:text-white transition"
                            >
                              {rule.isEnabled ? (
                                <ToggleRight className="w-6 h-6 text-teal-400" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-500" />
                              )}
                            </button>
                          </div>

                          {/* Off Days Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold">Off Days:</span>
                            {rule.daysOfWeek.map((dayId) => {
                              const dayObj = DAYS_OF_WEEK.find((d) => d.id === dayId);
                              return (
                                <span
                                  key={dayId}
                                  className="px-2 py-0.5 rounded-md bg-slate-800 text-teal-300 text-[10px] font-mono font-bold border border-slate-700"
                                >
                                  {dayObj?.label}
                                </span>
                              );
                            })}
                          </div>

                          {/* Scope / Selection Target */}
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {rule.assignmentType === 'department' && (
                              <div className="flex items-center gap-1 text-indigo-300">
                                <Building2 className="w-3 h-3" />
                                <span>Dept: {(rule.targetDepartments || []).join(', ') || 'None'}</span>
                              </div>
                            )}
                            {rule.assignmentType === 'role' && (
                              <div className="flex items-center gap-1 text-amber-300">
                                <Briefcase className="w-3 h-3" />
                                <span>Role: {(rule.targetRoles || []).join(', ') || 'None'}</span>
                              </div>
                            )}
                            {rule.assignmentType === 'individual' && (
                              <div className="flex items-center gap-1 text-emerald-300">
                                <Users className="w-3 h-3" />
                                <span>Individual: {(rule.targetStaffIds || []).length} staff assigned</span>
                              </div>
                            )}
                            {rule.assignmentType === 'all' && (
                              <div className="flex items-center gap-1 text-teal-300">
                                <Users className="w-3 h-3" />
                                <span>Organization-wide (All Staff)</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setInspectingRule(isInspecting ? null : rule)}
                            className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                          >
                            <Users className="w-3 h-3" />
                            <span>{coveredCount} Staff Covered</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(rule)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              title="Edit rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inspected Rule Participants Drawer */}
              {inspectingRule && (
                <div className="p-4 rounded-xl border border-teal-800/60 bg-teal-950/20 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-400" />
                      <h4 className="text-xs font-bold text-teal-200">
                        Covered Staff under "{inspectingRule.name}"
                      </h4>
                      <span className="px-2 py-0.2 rounded-full bg-teal-500/20 text-teal-300 font-mono text-[10px]">
                        {getCoveredStaffList(inspectingRule).length} Employees
                      </span>
                    </div>
                    <button
                      onClick={() => setInspectingRule(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {getCoveredStaffList(inspectingRule).map((s) => (
                      <div
                        key={s.id}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs"
                      >
                        {s.avatar ? (
                          <img src={s.avatar} alt={s.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-[10px]">
                            {s.name.charAt(0)}
                          </div>
                        )}
                        <div className="truncate">
                          <p className="font-bold text-slate-200 truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {s.department || 'No Dept'} • {s.role || (s as any).jobTitle || 'Staff'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Form Mode */}
          {viewMode === 'form' && (
            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-black text-slate-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  <span>{editingRuleId ? 'Edit Recurring Off Rule' : 'Configure New Recurring Off Rule'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Back to Rules List
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Operations Alternate Saturday Rest"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Recurrence Cycle</label>
                  <select
                    value={formCycle}
                    onChange={(e) => setFormCycle(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold"
                  >
                    <option value="weekly">Every Week (Standard Weekly Day Off)</option>
                    <option value="biweekly">Alternate Weeks (Every 2 Weeks / Bi-weekly)</option>
                    <option value="monthly">Monthly Recurring Off</option>
                  </select>
                </div>
              </div>

              {/* Day of Week Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Select Recurring Off Days *
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = formDaysOfWeek.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => handleToggleDay(day.id)}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition ${
                          isSelected
                            ? 'bg-teal-600 border-teal-500 text-white shadow-md'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        <span>{day.label}</span>
                        <span className="text-[9px] opacity-75">{day.full.slice(0, 3)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment Scope Type */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Assign Participants By
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'department', label: 'By Department', icon: Building2 },
                    { id: 'role', label: 'By Role / Title', icon: Briefcase },
                    { id: 'individual', label: 'Individual (Bulk Select)', icon: Users },
                    { id: 'all', label: 'All Staff (Org-wide)', icon: ShieldCheck },
                  ].map((scope) => {
                    const Icon = scope.icon;
                    const isSelected = formAssignmentType === scope.id;
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setFormAssignmentType(scope.id as any)}
                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition ${
                          isSelected
                            ? 'bg-teal-950 border-teal-500 text-teal-300 shadow-sm'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{scope.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Departments Selector */}
              {formAssignmentType === 'department' && (
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      Select Departments ({formSelectedDepts.length} selected)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormSelectedDepts(allDepartments)}
                        className="text-[11px] text-teal-400 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormSelectedDepts([])}
                        className="text-[11px] text-slate-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {allDepartments.map((dept) => {
                      const isChecked = formSelectedDepts.includes(dept);
                      return (
                        <label
                          key={dept}
                          className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition ${
                            isChecked
                              ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setFormSelectedDepts([...formSelectedDepts, dept]);
                              else setFormSelectedDepts(formSelectedDepts.filter((d) => d !== dept));
                            }}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                          />
                          <span className="truncate">{dept}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target Roles Selector */}
              {formAssignmentType === 'role' && (
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                      Select Roles ({formSelectedRoles.length} selected)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormSelectedRoles(allRoles)}
                        className="text-[11px] text-teal-400 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormSelectedRoles([])}
                        className="text-[11px] text-slate-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {allRoles.map((role) => {
                      const isChecked = formSelectedRoles.includes(role);
                      return (
                        <label
                          key={role}
                          className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition ${
                            isChecked
                              ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setFormSelectedRoles([...formSelectedRoles, role]);
                              else setFormSelectedRoles(formSelectedRoles.filter((r) => r !== role));
                            }}
                            className="rounded border-slate-700 text-amber-600 focus:ring-0"
                          />
                          <span className="truncate">{role}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Staff Bulk Selector */}
              {formAssignmentType === 'individual' && (
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      Select Staff Members ({formSelectedStaffIds.length} selected)
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                        <input
                          type="text"
                          value={formStaffSearch}
                          onChange={(e) => setFormStaffSearch(e.target.value)}
                          placeholder="Search staff..."
                          className="pl-7 pr-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredStaff}
                        className="text-[11px] text-teal-400 hover:underline font-semibold"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllStaff}
                        className="text-[11px] text-slate-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredStaffListForForm.map((s) => {
                      const isSelected = formSelectedStaffIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleToggleStaffId(s.id)}
                          className={`p-2 rounded-lg border flex items-center gap-2 text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div
                            className="rounded border-slate-700 text-emerald-600 focus:ring-0 shrink-0"
                          />
                          <div className="truncate">
                            <p className="font-bold text-slate-200 truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {s.department || 'General'} • {s.employeeId || 'ID'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Policy / Schedule Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional internal description of why this off cycle was instituted..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder:text-slate-500"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRuleId ? 'Update Rule' : 'Save Recurring Off Rule'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
