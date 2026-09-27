import React, { useState, useEffect } from 'react';
import {
  Calendar,
  UserMinus,
  UserCheck,
  X,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { ManualDeductionRule, StaffMember } from '../types';
import { getStaffSuspensionDetails, logStaffSuspensionHistory, calculateSuspensionDays } from '../utils/staffUtils';

interface EditSuspensionModalProps {
  isOpen: boolean;
  staff: StaffMember | null;
  onClose: () => void;
  onSave: (
    staffId: string,
    startDate: string,
    endDate: string,
    reason: string,
    appliedPenaltyRule?: ManualDeductionRule | null
  ) => void;
  onUnsuspend?: (staff: StaffMember) => void;
  isLight?: boolean;
  companyName?: string;
  currentUserName?: string;
}

export const EditSuspensionModal: React.FC<EditSuspensionModalProps> = ({
  isOpen,
  staff,
  onClose,
  onSave,
  onUnsuspend,
  isLight = false,
  companyName,
  currentUserName = 'HR Management',
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (staff && isOpen) {
      const details = getStaffSuspensionDetails(staff, companyName);
      // Use the actual issuance start date of the suspension; fallback to today only if completely empty
      const existingStart = details.startDate || staff.suspensionStartDate || '';
      const fallbackToday = new Date().toISOString().split('T')[0];
      setStartDate(existingStart || fallbackToday);
      setEndDate(details.endDate || staff.suspensionEndDate || '');
      setReason(details.reason || staff.suspensionReason || '');
    }
  }, [staff, isOpen, companyName]);

  if (!isOpen || !staff) return null;

  const suspensionDays = calculateSuspensionDays(startDate, endDate);

  const handleQuickDuration = (days: number) => {
    const base = startDate ? new Date(startDate) : new Date();
    base.setDate(base.getDate() + (days - 1));
    setEndDate(base.toISOString().split('T')[0]);
  };

  const handleSetIndefinite = () => {
    setEndDate('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Log structured suspension history update
    logStaffSuspensionHistory(
      staff,
      {
        type: staff.status === 'Suspended' ? 'updated' : 'created',
        startDate,
        endDate,
        reason,
        durationDays: suspensionDays,
        authorizedBy: currentUserName,
      },
      companyName
    );

    onSave(staff.id, startDate, endDate, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isLight
              ? 'bg-amber-50/80 border-amber-200 text-amber-950'
              : 'bg-amber-950/30 border-amber-900/50 text-amber-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Edit Suspension Dates
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Adjust suspension timeframe and reference memorandum
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight
                ? 'hover:bg-amber-100 text-slate-500 hover:text-slate-900'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Staff Target Header */}
        <div className={`px-6 py-3.5 border-b flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm font-mono">
              {staff.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>{staff.name}</span>
                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  ({staff.employeeId || staff.id})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {staff.department} • {staff.role}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            {staff.status === 'Suspended' ? 'Currently Suspended' : staff.status}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Date Suspended (From)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-xs font-mono font-bold rounded-xl border outline-none focus:border-amber-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500">Effective start date of suspension</p>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center justify-between">
                <span>Day Suspension Ends (To)</span>
                {endDate && (
                  <button
                    type="button"
                    onClick={handleSetIndefinite}
                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-mono"
                  >
                    Clear (Indefinite)
                  </button>
                )}
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-xs font-mono font-bold rounded-xl border outline-none focus:border-amber-500 ${
                    isLight
                      ? 'bg-white border-amber-400 text-slate-900 shadow-sm'
                      : 'bg-slate-800 border-amber-600 text-white'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                {endDate ? `${suspensionDays} calendar day(s) inclusive` : 'Leave blank if indefinite / TBD'}
              </p>
            </div>
          </div>

          {/* Quick Duration Shortcuts */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Quick End Date Presets:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickDuration(7)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                +7 Days (1 Wk)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDuration(14)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                +14 Days (2 Wks)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDuration(30)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                +30 Days (1 Mo)
              </button>
              <button
                type="button"
                onClick={handleSetIndefinite}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                  !endDate
                    ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                Indefinite / Pending Review
              </button>
            </div>
          </div>

          {/* Reason / Reference Memo */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Suspension Reason / Reference Memo
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Disciplinary investigation, misconduct, policy breach..."
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none focus:border-amber-500 ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-slate-800 border-slate-700 text-white'
              }`}
            />
            <p className="text-[10px] text-slate-500">Official memorandum or incident description</p>
          </div>

          {/* Active Period Summary Box */}
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              isLight
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-amber-950/40 border-amber-900/60 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-bold">Active Suspension Period:</span>{' '}
                <span className="font-mono">
                  {startDate ? startDate : 'Not set'} to {endDate ? endDate : 'Indefinite'}
                </span>
                <span className="ml-1.5 font-bold font-mono text-[11px] opacity-90">
                  ({suspensionDays} calendar day{suspensionDays > 1 ? 's' : ''})
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {onUnsuspend && staff.status === 'Suspended' ? (
              <button
                type="button"
                onClick={() => {
                  onUnsuspend(staff);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="End suspension and restore staff member to Active"
              >
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span>Unsuspend & Restore</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <UserMinus className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
