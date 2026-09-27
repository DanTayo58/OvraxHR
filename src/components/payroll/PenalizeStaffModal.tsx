import React, { useState, useMemo } from 'react';
import { X, Zap, Search, AlertCircle, Calendar, User, DollarSign, Percent } from 'lucide-react';
import { BookedPenalty, ManualDeductionRule, PayrollConfig, StaffMember } from '../../types';

interface PenalizeStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  config: PayrollConfig;
  initialStaff?: StaffMember;
  initialRule?: ManualDeductionRule;
  onConfirm: (penaltyData: Omit<BookedPenalty, 'id'>) => void;
  currentUserName?: string;
}

export const PenalizeStaffModal: React.FC<PenalizeStaffModalProps> = ({
  isOpen,
  onClose,
  staffList,
  config,
  initialStaff,
  initialRule,
  onConfirm,
  currentUserName,
}) => {
  const activeStaff = useMemo(() => staffList.filter((s) => s.status !== 'Exited'), [staffList]);

  const [staffSearch, setStaffSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    initialStaff?.id || activeStaff[0]?.id || ''
  );

  const selectedStaff = useMemo(
    () => activeStaff.find((s) => s.id === selectedStaffId) || activeStaff[0],
    [activeStaff, selectedStaffId]
  );

  const rules = config?.manualDeductionRules || [];
  const currencySymbol = config?.currencySymbol || '$';
  const [selectedRuleId, setSelectedRuleId] = useState<string>(
    initialRule?.id || rules[0]?.id || ''
  );

  const activeRule = useMemo(() => {
    return rules.find((r) => r.id === selectedRuleId) || rules[0] || null;
  }, [rules, selectedRuleId]);

  const calculationType = activeRule?.type || 'fixed';
  const baseRate = activeRule?.defaultValue ?? 20;

  const [multiplier, setMultiplier] = useState<number>(1);

  const [reason, setReason] = useState<string>(
    initialRule?.name || activeRule?.name || 'Late Attendance Penalty'
  );

  const [incurredDate, setIncurredDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // Update form fields when rule selection changes
  const handleRuleChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setMultiplier(1);
    const r = rules.find((item) => item.id === ruleId);
    if (r) {
      setReason(r.name);
    }
  };

  const effectiveMultiplier = Math.max(1, multiplier || 1);
  const totalPenaltyAmount = baseRate * effectiveMultiplier;

  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return activeStaff;
    const q = staffSearch.toLowerCase();
    return activeStaff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.employeeId && s.employeeId.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q))
    );
  }, [activeStaff, staffSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (baseRate <= 0) return;

    onConfirm({
      staffId: selectedStaff.id,
      employeeId: selectedStaff.employeeId || '',
      staffName: selectedStaff.name,
      department: selectedStaff.department || '',
      penaltyRuleId: selectedRuleId,
      ruleId: selectedRuleId,
      ruleName: activeRule?.name || reason,
      reason: reason.trim() || 'Workplace Infraction Penalty',
      type: calculationType,
      value: totalPenaltyAmount,
      baseValue: baseRate,
      multiplier: effectiveMultiplier,
      status: 'Active',
      incurredDate: incurredDate || new Date().toISOString().split('T')[0],
      incurredBy: currentUserName || 'Admin',
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Book Staff Penalty / Deduction
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Incur a penalty dynamically derived from configured rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
          <form id="penalize-staff-form" onSubmit={handleSubmit} className="space-y-4">
          {/* STEP 1: SELECT STAFF */}
          <div className="space-y-2">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">
              1. Select Staff Member *
            </label>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, ID, role, or department..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs outline-none"
              />
            </div>

            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              {filteredStaff.length === 0 ? (
                <div className="p-3 text-center text-slate-400">No staff found</div>
              ) : (
                filteredStaff.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={`w-full p-2 text-left flex items-center justify-between transition cursor-pointer ${
                      selectedStaff?.id === staff.id
                        ? 'bg-amber-100/80 dark:bg-amber-950/70 border-l-4 border-amber-500 text-amber-950 dark:text-amber-100'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{staff.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {staff.employeeId || 'ID: --'} • {staff.role || 'Staff'} • {staff.department || 'General'}
                      </div>
                    </div>
                    {staff.estimatedMonthlySalary && (
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {currencySymbol}{staff.estimatedMonthlySalary.toLocaleString()}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* STEP 2: SELECT PENALTY TEMPLATE RULE */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">
              2. Penalty Rule (Derived from Manual Deductions Catalog) *
            </label>
            <select
              value={selectedRuleId}
              onChange={(e) => handleRuleChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs outline-none cursor-pointer"
            >
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name} (Fine: {rule.type === 'percentage'
                    ? `${rule.defaultValue}% of Base`
                    : `${currencySymbol}${rule.defaultValue.toLocaleString()}`})
                </option>
              ))}
            </select>
            {activeRule && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Standard Catalog Fine: <strong className="text-slate-800 dark:text-slate-200">{calculationType === 'percentage' ? `${baseRate}% of Base Pay` : `${currencySymbol}${baseRate.toLocaleString()}`}</strong> per violation.
              </p>
            )}
          </div>

          {/* STEP 3: MULTIPLIER, INCIDENT DATE & REASON */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Multiplier Field (Default: 1) */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>Multiplier (Times Fined) *</span>
                <span className="text-[10px] font-mono text-slate-400">
                  Default: 1
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={multiplier}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    setMultiplier(isNaN(parsed) || parsed < 1 ? 1 : parsed);
                  }}
                  className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-xs">
                  ×
                </span>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-mono font-semibold">
                fine * {effectiveMultiplier} = {calculationType === 'percentage'
                  ? `${baseRate}% × ${effectiveMultiplier} = ${totalPenaltyAmount}%`
                  : `${currencySymbol}${baseRate.toLocaleString()} × ${effectiveMultiplier} = ${currencySymbol}${totalPenaltyAmount.toLocaleString()}`}
              </p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Incident Date *
              </label>
              <input
                type="date"
                required
                value={incurredDate}
                onChange={(e) => setIncurredDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Infraction / Incident Reason *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Late arrival 45 mins on Aug 28, Unexcused shift absence"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs"
              />
            </div>
          </div>

          {/* Impact Preview */}
          {selectedStaff && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span>Employee: {selectedStaff.name}</span>
                <span className="font-mono text-rose-600 dark:text-rose-400 text-xs">
                  Total Deduction: -
                  {calculationType === 'percentage'
                    ? `${totalPenaltyAmount}% (${currencySymbol}${((Number(selectedStaff.estimatedMonthlySalary || 0) * totalPenaltyAmount) / 100).toFixed(2)})`
                    : `${currencySymbol}${totalPenaltyAmount.toLocaleString()}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-amber-500/20 font-mono">
                <span className="text-slate-600 dark:text-slate-400">
                  Calculation Breakdown:
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  {activeRule?.name || reason} * {effectiveMultiplier} times fined ({calculationType === 'percentage'
                    ? `${baseRate}% × ${effectiveMultiplier} = -${totalPenaltyAmount}%`
                    : `${currencySymbol}${baseRate.toLocaleString()} × ${effectiveMultiplier} = -${currencySymbol}${totalPenaltyAmount.toLocaleString()}`})
                </span>
              </div>
              <p className="text-[10px] opacity-80 pt-0.5">
                Will be deducted as a single consolidated fine on the upcoming payroll run ({effectiveMultiplier} {effectiveMultiplier === 1 ? 'time' : 'times'} fined), then reset to Settled.
              </p>
            </div>
          )}

          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-semibold text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="penalize-staff-form"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            Confirm & Book Penalty
          </button>
        </div>
      </div>
    </div>
  );
};
